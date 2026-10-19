// Instrument direct generated talent-table reads in a disposable, already-patched
// gcsim source tree. This tool is intentionally conservative: it does not infer
// a table from an attack name or from the coefficient's numeric value.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"go/ast"
	"go/constant"
	"go/format"
	"go/parser"
	"go/token"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

const sourceHostImport = "github.com/genshinsim/gcsim/pkg/core/sourcehost"

type table struct {
	TableID   string `json:"tableId"`
	TablePath string `json:"tablePath"`
	TableLine int    `json:"tableLine"`
	Symbol    string `json:"symbol"`
	Values    any    `json:"values"`
	dims      int
}

type site struct {
	SiteID             string             `json:"siteId"`
	Path               string             `json:"path"`
	Line               int                `json:"line"`
	Column             int                `json:"column"`
	TableID            string             `json:"tableId"`
	IndexExpressions   []string           `json:"indexExpressions"`
	TalentLevelIndices []talentLevelIndex `json:"talentLevelIndices,omitempty"`
	RangeSource        *rangeSource       `json:"rangeSource,omitempty"`
	Reason             string             `json:"reason,omitempty"`
}

type rangeSource struct {
	Path          string `json:"path"`
	Expression    string `json:"expression"`
	RowVariable   string `json:"rowVariable"`
	IndexVariable string `json:"indexVariable"`
	IndexPosition int    `json:"indexPosition"`
	Line          int    `json:"line"`
}

type rangeBinding struct {
	loop       *ast.RangeStmt
	table      table
	root       string
	outer      []ast.Expr
	key        string
	row        string
	prefix     string
	indexTexts []string
	source     rangeSource
}

type talentLevelIndex struct {
	Position int    `json:"position"`
	Kind     string `json:"kind"`
}

type report struct {
	SchemaVersion    int    `json:"schemaVersion"`
	CoordinateSystem string `json:"coordinateSystem"`
	Instrumented     []site `json:"instrumented"`
	Skipped          []site `json:"skipped"`
}

type registry struct {
	SchemaVersion   int              `json:"schemaVersion"`
	Tables          []table          `json:"tables"`
	ExpressionSites []expressionSite `json:"expressionSites,omitempty"`
}

type formulaNode struct {
	Kind  string        `json:"kind"`
	Value *float64      `json:"value,omitempty"`
	Key   string        `json:"key,omitempty"`
	Terms []formulaNode `json:"terms,omitempty"`
	Left  *formulaNode  `json:"left,omitempty"`
	Right *formulaNode  `json:"right,omitempty"`
}

type expressionSite struct {
	SiteID      string      `json:"siteId"`
	Path        string      `json:"path"`
	Line        int         `json:"line"`
	Column      int         `json:"column"`
	Expression  formulaNode `json:"expression"`
	TermSiteIDs []string    `json:"termSiteIds"`
}

type expressionLeaf struct {
	value   ast.Expr
	row     site
	table   table
	indices []ast.Expr
	base    string
	binding *rangeBinding
}

type edit struct {
	start, end int
	text       string
}

func main() {
	root := flag.String("source-root", "", "writable gcsim source after patches and overlays")
	registryOut := flag.String("registry-out", "", "generated table registry JSON path")
	reportOut := flag.String("report-out", "", "instrumented and skipped site report JSON path")
	flag.Parse()
	if *root == "" || *registryOut == "" || *reportOut == "" || flag.NArg() != 0 {
		fatal(fmt.Errorf("required: --source-root DIR --registry-out FILE --report-out FILE"))
	}
	characters := filepath.Join(*root, "internal", "characters")
	paths := []string{}
	if err := filepath.WalkDir(characters, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		paths = append(paths, path)
		return nil
	}); err != nil {
		fatal(err)
	}
	sort.Strings(paths)
	fset := token.NewFileSet()
	files := map[string]*ast.File{}
	contents := map[string][]byte{}
	for _, path := range paths {
		data, err := os.ReadFile(path)
		if err != nil {
			fatal(err)
		}
		file, err := parser.ParseFile(fset, path, data, 0)
		if err != nil {
			fatal(fmt.Errorf("parse %s: %w", path, err))
		}
		files[path] = file
		contents[path] = data
	}
	tables := findTables(*root, fset, files)
	constants := findNumericConstants(files)
	result := report{SchemaVersion: 1, CoordinateSystem: "patched pre-instrumentation Go source; not upstream-original", Instrumented: []site{}, Skipped: []site{}}
	used := map[string]table{}
	expressionSites := []expressionSite{}
	for _, path := range paths {
		if strings.Contains(filepath.Base(path), ".dm.go") {
			continue
		}
		rel, err := filepath.Rel(*root, path)
		if err != nil {
			fatal(err)
		}
		rel = filepath.ToSlash(rel)
		data := contents[path]
		file := files[path]
		changes := []edit{}
		rangeDone := map[token.Pos]bool{}
		for _, declaration := range file.Decls {
			fn, ok := declaration.(*ast.FuncDecl)
			if !ok || fn.Body == nil {
				continue
			}
			receiver := receiverName(fn)
			ast.Inspect(fn.Body, func(node ast.Node) bool {
				assignment, ok := node.(*ast.AssignStmt)
				if !ok {
					return true
				}
				variable, mult, literalAssignment := attackMultiplierAssignment(assignment)
				if mult == nil {
					return true
				}
				pos := fset.Position(mult.Pos())
				row := site{SiteID: fmt.Sprintf("%s:%d:%d", rel, pos.Line, pos.Column), Path: rel, Line: pos.Line, Column: pos.Column, IndexExpressions: []string{}}
				base, indices := indexChain(mult)
				for _, index := range indices {
					row.IndexExpressions = append(row.IndexExpressions, string(data[offset(fset, index.Pos()):offset(fset, index.End())]))
				}
				t, found := tables[filepath.Dir(path)+"#"+base]
				if found {
					row.TableID = t.TableID
				}
				switch {
				case !found:
					row.Reason = "Mult is not a direct index of a numeric generated table"
				case receiver == "":
					row.Reason = "no character receiver for synchronous frame"
				case len(indices) != t.dims:
					row.Reason = "index depth differs from generated table dimension"
				case generatedSymbolShadowed(fn, base):
					row.Reason = "generated table symbol is shadowed locally"
				case !literalAssignment && !visibleAttackInfoVariable(fn, assignment, variable):
					row.Reason = "Mult assignment target is not a visible local AttackInfo literal or copy"
				case laterMultWrite(fn, assignment.End(), variable):
					row.Reason = "local AttackInfo.Mult has a later write in the function"
				case !hasImportBlock(file):
					row.Reason = "file has no import block"
				}
				if row.Reason != "" {
					result.Skipped = append(result.Skipped, row)
					return true
				}
				receipt := fmt.Sprintf("sourceHostTalentRead_%d_%d", pos.Line, pos.Column)
				expr := base
				for i, idx := range indices {
					indexText := string(data[offset(fset, idx.Pos()):offset(fset, idx.End())])
					if kind, wrapped := directTalentLevelIndex(idx, receiver, receipt, i); kind != "" {
						indexText = wrapped
						row.TalentLevelIndices = append(row.TalentLevelIndices, talentLevelIndex{Position: i, Kind: kind})
					}
					if i+1 == len(indices) {
						expr = fmt.Sprintf("sourcehost.TalentCoefficient(&%s, %s, %s, %s.Core.F, %q, %q)", receipt, expr, indexText, receiver, t.TableID, row.SiteID)
					} else {
						expr = fmt.Sprintf("sourcehost.TalentIndex(&%s, %s, %s)", receipt, expr, indexText)
					}
				}
				after := "\n" + receipt + ".ActorIndex = " + variable + ".ActorIndex\n"
				if !literalAssignment {
					after += variable + ".SourceHostTalentExpressionRead = nil\n"
				}
				after += variable + ".SourceHostTalentTableRead = &" + receipt
				changes = append(changes,
					edit{offset(fset, assignment.Pos()), offset(fset, assignment.Pos()), "var " + receipt + " info.SourceHostTalentTableRead\n"},
					edit{offset(fset, mult.Pos()), offset(fset, mult.End()), expr},
					edit{offset(fset, assignment.End()), offset(fset, assignment.End()), after},
				)
				used[t.TableID] = t
				result.Instrumented = append(result.Instrumented, row)
				return true
			})
			// A range value is a row of the generated table, not a new table.
			// Bind it through its lexical range statement and carry the actual
			// outer index and implicit iteration key into a per-read receipt.
			ast.Inspect(fn.Body, func(node ast.Node) bool {
				assignment, ok := node.(*ast.AssignStmt)
				if !ok || len(assignment.Lhs) != 1 || len(assignment.Rhs) != 1 {
					return true
				}
				variable, mult, literalAssignment := attackMultiplierAssignment(assignment)
				if mult == nil {
					return true
				}
				base, finalIndices := indexChain(mult)
				if base == "" || len(finalIndices) == 0 {
					return true
				}
				if _, direct := tables[filepath.Dir(path)+"#"+base]; direct {
					return true
				}
				pos := fset.Position(mult.Pos())
				row := site{SiteID: fmt.Sprintf("%s:%d:%d", rel, pos.Line, pos.Column), Path: rel, Line: pos.Line, Column: pos.Column, IndexExpressions: []string{}}
				binding, reason, recognized := findRangeBinding(fn.Body, assignment, base, finalIndices, receiver, rel, data, fset, tables, filepath.Dir(path))
				if !recognized {
					return true
				}
				if reason == "" && !literalAssignment && !visibleAttackInfoVariable(fn, assignment, variable) {
					reason = "Mult assignment target is not a visible local AttackInfo literal or copy"
				}
				if reason == "" && laterMultWrite(fn, assignment.End(), variable) {
					reason = "local AttackInfo.Mult has a later write in the function"
				}
				if reason == "" && !hasImportBlock(file) {
					reason = "file has no import block"
				}
				if reason != "" {
					row.Reason = reason
					replaceOrAppendSkipped(&result, row)
					return true
				}
				row.TableID = binding.table.TableID
				row.RangeSource = &binding.source
				row.IndexExpressions = append(row.IndexExpressions, binding.indexTexts...)
				row.IndexExpressions = append(row.IndexExpressions, binding.key)
				for i, idx := range binding.outer {
					if kind, _ := directTalentLevelIndex(idx, receiver, binding.prefix, i); kind != "" {
						row.TalentLevelIndices = append(row.TalentLevelIndices, talentLevelIndex{Position: i, Kind: kind})
					}
				}
				for _, idx := range finalIndices {
					row.IndexExpressions = append(row.IndexExpressions, string(data[offset(fset, idx.Pos()):offset(fset, idx.End())]))
				}
				receipt := fmt.Sprintf("sourceHostTalentRead_%d_%d", pos.Line, pos.Column)
				if !rangeDone[binding.loop.Pos()] {
					prefixExpr := binding.root
					for i, idx := range binding.outer {
						indexText := binding.indexTexts[i]
						if _, wrapped := directTalentLevelIndex(idx, receiver, binding.prefix, i); wrapped != "" {
							indexText = wrapped
						}
						prefixExpr = fmt.Sprintf("sourcehost.TalentIndex(&%s, %s, %s)", binding.prefix, prefixExpr, indexText)
					}
					prefixExpr = fmt.Sprintf("sourcehost.TalentRangeRows(&%s, %s, &%s.Core.F)", binding.prefix, prefixExpr, receiver)
					changes = append(changes,
						edit{offset(fset, binding.loop.Pos()), offset(fset, binding.loop.Pos()), "var " + binding.prefix + " info.SourceHostTalentTableRead\n"},
						edit{offset(fset, binding.loop.X.Pos()), offset(fset, binding.loop.X.End()), prefixExpr},
					)
					rangeDone[binding.loop.Pos()] = true
				}
				expr := base
				for i, idx := range finalIndices {
					position := len(binding.outer) + 1 + i
					indexText := string(data[offset(fset, idx.Pos()):offset(fset, idx.End())])
					if kind, wrapped := directTalentLevelIndex(idx, receiver, receipt, position); kind != "" {
						indexText = wrapped
						row.TalentLevelIndices = append(row.TalentLevelIndices, talentLevelIndex{Position: position, Kind: kind})
					}
					if i+1 == len(finalIndices) {
						expr = fmt.Sprintf("sourcehost.TalentCoefficient(&%s, %s, %s, %s.Core.F, %q, %q)", receipt, expr, indexText, receiver, binding.table.TableID, row.SiteID)
					} else {
						expr = fmt.Sprintf("sourcehost.TalentIndex(&%s, %s, %s)", receipt, expr, indexText)
					}
				}
				after := "\n" + receipt + ".ActorIndex = " + variable + ".ActorIndex\n"
				if !literalAssignment {
					after += variable + ".SourceHostTalentExpressionRead = nil\n"
				}
				after += variable + ".SourceHostTalentTableRead = &" + receipt
				changes = append(changes,
					edit{offset(fset, assignment.Pos()), offset(fset, assignment.Pos()), receipt + " := sourcehost.TalentRangeReceipt(&" + binding.prefix + ", " + binding.key + ")\n"},
					edit{offset(fset, mult.Pos()), offset(fset, mult.End()), expr},
					edit{offset(fset, assignment.End()), offset(fset, assignment.End()), after},
				)
				used[binding.table.TableID] = binding.table
				removeSkippedSite(&result, row.SiteID)
				result.Instrumented = append(result.Instrumented, row)
				return true
			})
			// Compound expressions retain the original Go operator tree and
			// constant subexpressions. Only proven generated-table leaves are
			// wrapped, then the already evaluated final scalar is observed.
			ast.Inspect(fn.Body, func(node ast.Node) bool {
				assignment, ok := node.(*ast.AssignStmt)
				if !ok || len(assignment.Lhs) != 1 || len(assignment.Rhs) != 1 {
					return true
				}
				variable, mult, literalAssignment := attackMultiplierAssignment(assignment)
				if mult == nil {
					return true
				}
				switch mult.(type) {
				case *ast.BinaryExpr, *ast.UnaryExpr, *ast.ParenExpr:
				default:
					return true
				}
				if !potentialTalentTableLeaf(fn.Body, assignment, mult, tables, filepath.Dir(path)) {
					return true
				}
				pos := fset.Position(mult.Pos())
				rootSiteID := fmt.Sprintf("%s:%d:%d", rel, pos.Line, pos.Column)
				row := site{SiteID: rootSiteID, Path: rel, Line: pos.Line, Column: pos.Column, IndexExpressions: []string{}}
				var reason string
				if receiver == "" {
					reason = "compound talent expression has no character receiver"
				}
				if reason == "" && !literalAssignment && !visibleAttackInfoVariable(fn, assignment, variable) {
					reason = "compound Mult target is not a visible local AttackInfo literal or copy"
				}
				if reason == "" && laterMultWrite(fn, assignment.End(), variable) {
					reason = "local AttackInfo.Mult has a later write in the function"
				}
				if reason == "" && !hasImportBlock(file) {
					reason = "file has no import block"
				}
				var formula formulaNode
				var leaves []expressionLeaf
				if reason == "" {
					formula, leaves, reason = parseTalentExpression(mult, fn, assignment, receiver, rel, rootSiteID, filepath.Dir(path), data, fset, tables, constants)
				}
				if reason != "" {
					row.Reason = reason
					replaceOrAppendSkipped(&result, row)
					return true
				}
				receipt := fmt.Sprintf("sourceHostTalentExpression_%d_%d", pos.Line, pos.Column)
				before := receipt + " := info.SourceHostTalentExpressionRead{Reads: make([]info.SourceHostTalentTableRead, " + strconv.Itoa(len(leaves)) + ")}\n"
				termSiteIDs := make([]string, 0, len(leaves))
				leafEdits := []edit{}
				for i, leaf := range leaves {
					termSiteIDs = append(termSiteIDs, leaf.row.SiteID)
					readRef := fmt.Sprintf("%s.Reads[%d]", receipt, i)
					if leaf.binding != nil {
						binding := leaf.binding
						if !rangeDone[binding.loop.Pos()] {
							prefixExpr := binding.root
							for j, idx := range binding.outer {
								indexText := binding.indexTexts[j]
								if _, wrapped := directTalentLevelIndex(idx, receiver, binding.prefix, j); wrapped != "" {
									indexText = wrapped
								}
								prefixExpr = fmt.Sprintf("sourcehost.TalentIndex(&%s, %s, %s)", binding.prefix, prefixExpr, indexText)
							}
							prefixExpr = fmt.Sprintf("sourcehost.TalentRangeRows(&%s, %s, &%s.Core.F)", binding.prefix, prefixExpr, receiver)
							changes = append(changes,
								edit{offset(fset, binding.loop.Pos()), offset(fset, binding.loop.Pos()), "var " + binding.prefix + " info.SourceHostTalentTableRead\n"},
								edit{offset(fset, binding.loop.X.Pos()), offset(fset, binding.loop.X.End()), prefixExpr},
							)
							rangeDone[binding.loop.Pos()] = true
						}
						before += readRef + " = sourcehost.TalentRangeReceipt(&" + binding.prefix + ", " + binding.key + ")\n"
					}
					leafExpr := leaf.base
					indexOffset := 0
					if leaf.binding != nil {
						indexOffset = len(leaf.binding.outer) + 1
					}
					for j, idx := range leaf.indices {
						indexText := string(data[offset(fset, idx.Pos()):offset(fset, idx.End())])
						if _, wrapped := directTalentLevelIndex(idx, receiver, readRef, indexOffset+j); wrapped != "" {
							indexText = wrapped
						}
						if j+1 == len(leaf.indices) {
							leafExpr = fmt.Sprintf("sourcehost.TalentCoefficient(&%s, %s, %s, %s.Core.F, %q, %q)", readRef, leafExpr, indexText, receiver, leaf.table.TableID, leaf.row.SiteID)
						} else {
							leafExpr = fmt.Sprintf("sourcehost.TalentIndex(&%s, %s, %s)", readRef, leafExpr, indexText)
						}
					}
					leafEdits = append(leafEdits, edit{offset(fset, leaf.value.Pos()) - offset(fset, mult.Pos()), offset(fset, leaf.value.End()) - offset(fset, mult.Pos()), leafExpr})
					used[leaf.table.TableID] = leaf.table
					result.Instrumented = append(result.Instrumented, leaf.row)
				}
				original := string(data[offset(fset, mult.Pos()):offset(fset, mult.End())])
				sort.Slice(leafEdits, func(i, j int) bool { return leafEdits[i].start > leafEdits[j].start })
				for _, replacement := range leafEdits {
					original = original[:replacement.start] + replacement.text + original[replacement.end:]
				}
				wrapped := fmt.Sprintf("sourcehost.TalentExpression(&%s, %s, &%s.Core.F, %q)", receipt, original, receiver, rootSiteID)
				after := "\n" + receipt + ".ActorIndex = " + variable + ".ActorIndex\n"
				for i := range leaves {
					after += fmt.Sprintf("%s.Reads[%d].ActorIndex = %s.ActorIndex\n", receipt, i, receipt)
				}
				if !literalAssignment {
					after += variable + ".SourceHostTalentTableRead = nil\n"
				}
				after += variable + ".SourceHostTalentExpressionRead = &" + receipt
				changes = append(changes,
					edit{offset(fset, assignment.Pos()), offset(fset, assignment.Pos()), before},
					edit{offset(fset, mult.Pos()), offset(fset, mult.End()), wrapped},
					edit{offset(fset, assignment.End()), offset(fset, assignment.End()), after},
				)
				expressionSites = append(expressionSites, expressionSite{SiteID: rootSiteID, Path: rel, Line: pos.Line, Column: pos.Column, Expression: formula, TermSiteIDs: termSiteIDs})
				removeSkippedSite(&result, rootSiteID)
				return true
			})
		}
		if len(changes) == 0 {
			continue
		}
		if !importsSourcehost(file) {
			for _, declaration := range file.Decls {
				gen, ok := declaration.(*ast.GenDecl)
				if !ok || gen.Tok != token.IMPORT || gen.Lparen == token.NoPos {
					continue
				}
				at := offset(fset, gen.Rparen)
				changes = append(changes, edit{at, at, "\t\"" + sourceHostImport + "\"\n"})
				break
			}
		}
		sort.Slice(changes, func(i, j int) bool { return changes[i].start > changes[j].start })
		for _, change := range changes {
			data = append(append(append([]byte{}, data[:change.start]...), change.text...), data[change.end:]...)
		}
		formatted, err := format.Source(data)
		if err != nil {
			fatal(fmt.Errorf("format %s: %w", rel, err))
		}
		if err := os.WriteFile(path, formatted, 0o644); err != nil {
			fatal(err)
		}
	}
	reg := registry{SchemaVersion: 1, Tables: []table{}, ExpressionSites: expressionSites}
	for _, t := range used {
		reg.Tables = append(reg.Tables, t)
	}
	sort.Slice(reg.Tables, func(i, j int) bool { return reg.Tables[i].TableID < reg.Tables[j].TableID })
	sort.Slice(reg.ExpressionSites, func(i, j int) bool { return reg.ExpressionSites[i].SiteID < reg.ExpressionSites[j].SiteID })
	sort.Slice(result.Instrumented, func(i, j int) bool { return result.Instrumented[i].SiteID < result.Instrumented[j].SiteID })
	sort.Slice(result.Skipped, func(i, j int) bool { return result.Skipped[i].SiteID < result.Skipped[j].SiteID })
	writeJSON(*registryOut, reg)
	writeJSON(*reportOut, result)
}

func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }
func writeJSON(path string, value any) {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		fatal(err)
	}
	data = append(data, '\n')
	if err := os.WriteFile(path, data, 0o644); err != nil {
		fatal(err)
	}
}
func offset(fset *token.FileSet, pos token.Pos) int { return fset.Position(pos).Offset }

func findTables(root string, fset *token.FileSet, files map[string]*ast.File) map[string]table {
	out := map[string]table{}
	for path, file := range files {
		if !strings.Contains(filepath.Base(path), ".dm.go") {
			continue
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			fatal(err)
		}
		rel = filepath.ToSlash(rel)
		for _, declaration := range file.Decls {
			gen, ok := declaration.(*ast.GenDecl)
			if !ok || gen.Tok != token.VAR {
				continue
			}
			for _, spec := range gen.Specs {
				v, ok := spec.(*ast.ValueSpec)
				if !ok || len(v.Names) != 1 || len(v.Values) != 1 {
					continue
				}
				literal, ok := v.Values[0].(*ast.CompositeLit)
				if !ok {
					continue
				}
				dims := floatSliceDimensions(literal.Type)
				if dims < 1 || dims > 3 {
					continue
				}
				values, valid := numericValues(literal, dims)
				if !valid {
					continue
				}
				name := v.Names[0].Name
				out[filepath.Dir(path)+"#"+name] = table{TableID: rel + "#" + name, TablePath: rel, TableLine: fset.Position(v.Pos()).Line, Symbol: name, Values: values, dims: dims}
			}
		}
	}
	return out
}

// Only explicit, untyped, same-package numeric constants are admitted. Go's
// exact constant evaluator folds their source expression before conversion to
// the float64 used by the attack coefficient.
func findNumericConstants(files map[string]*ast.File) map[string]constant.Value {
	out := map[string]constant.Value{}
	for path, file := range files {
		for _, declaration := range file.Decls {
			gen, ok := declaration.(*ast.GenDecl)
			if !ok || gen.Tok != token.CONST {
				continue
			}
			for _, spec := range gen.Specs {
				valueSpec, ok := spec.(*ast.ValueSpec)
				if !ok || valueSpec.Type != nil || len(valueSpec.Names) != 1 || len(valueSpec.Values) != 1 {
					continue
				}
				value, valid := exactGoConstant(valueSpec.Values[0])
				if valid {
					out[filepath.Dir(path)+"#"+valueSpec.Names[0].Name] = value
				}
			}
		}
	}
	return out
}

func floatSliceDimensions(expr ast.Expr) int {
	dims := 0
	for {
		array, ok := expr.(*ast.ArrayType)
		if !ok || array.Len != nil {
			break
		}
		dims++
		expr = array.Elt
	}
	name, ok := expr.(*ast.Ident)
	if !ok || name.Name != "float64" {
		return 0
	}
	return dims
}
func numericValues(literal *ast.CompositeLit, depth int) (any, bool) {
	if depth == 1 {
		values := make([]float64, 0, len(literal.Elts))
		for _, element := range literal.Elts {
			value, ok := numericLiteral(element)
			if !ok {
				return nil, false
			}
			values = append(values, value)
		}
		return values, true
	}
	values := make([]any, 0, len(literal.Elts))
	for _, element := range literal.Elts {
		child, ok := element.(*ast.CompositeLit)
		if !ok {
			return nil, false
		}
		value, valid := numericValues(child, depth-1)
		if !valid {
			return nil, false
		}
		values = append(values, value)
	}
	return values, true
}
func numericLiteral(expr ast.Expr) (float64, bool) {
	sign := 1.0
	if unary, ok := expr.(*ast.UnaryExpr); ok && unary.Op == token.SUB {
		sign = -1
		expr = unary.X
	}
	lit, ok := expr.(*ast.BasicLit)
	if !ok || (lit.Kind != token.FLOAT && lit.Kind != token.INT) {
		return 0, false
	}
	value, err := strconv.ParseFloat(lit.Value, 64)
	return sign * value, err == nil
}

// A complete literal replaces both the attack value and its previous receipts,
// whether declared with := or reassigned with =. A field write must additionally
// prove its visible AttackInfo binding and clear the other receipt kind.
func attackMultiplierAssignment(assignment *ast.AssignStmt) (string, ast.Expr, bool) {
	if len(assignment.Lhs) != 1 || len(assignment.Rhs) != 1 ||
		(assignment.Tok != token.DEFINE && assignment.Tok != token.ASSIGN) {
		return "", nil, false
	}
	if name, ok := assignment.Lhs[0].(*ast.Ident); ok && name.Name != "_" {
		if literal, ok := assignment.Rhs[0].(*ast.CompositeLit); ok && isAttackInfo(literal.Type) {
			return name.Name, multiplierField(literal), true
		}
	}
	if selector, ok := assignment.Lhs[0].(*ast.SelectorExpr); ok && assignment.Tok == token.ASSIGN && selector.Sel.Name == "Mult" {
		if name, ok := selector.X.(*ast.Ident); ok {
			return name.Name, assignment.Rhs[0], false
		}
	}
	return "", nil, false
}

func isAttackInfo(expr ast.Expr) bool {
	sel, ok := expr.(*ast.SelectorExpr)
	if !ok || sel.Sel.Name != "AttackInfo" {
		return false
	}
	id, ok := sel.X.(*ast.Ident)
	return ok && id.Name == "info"
}
func multiplierField(literal *ast.CompositeLit) ast.Expr {
	for _, element := range literal.Elts {
		kv, ok := element.(*ast.KeyValueExpr)
		if !ok {
			continue
		}
		key, ok := kv.Key.(*ast.Ident)
		if ok && key.Name == "Mult" {
			return kv.Value
		}
	}
	return nil
}
func indexChain(expr ast.Expr) (string, []ast.Expr) {
	indices := []ast.Expr{}
	for {
		index, ok := expr.(*ast.IndexExpr)
		if !ok {
			break
		}
		indices = append([]ast.Expr{index.Index}, indices...)
		expr = index.X
	}
	name, ok := expr.(*ast.Ident)
	if !ok {
		return "", indices
	}
	return name.Name, indices
}
func receiverName(fn *ast.FuncDecl) string {
	if fn.Recv == nil || len(fn.Recv.List) != 1 || len(fn.Recv.List[0].Names) != 1 {
		return ""
	}
	return fn.Recv.List[0].Names[0].Name
}

func directTalentLevelIndex(index ast.Expr, receiver, receipt string, position int) (string, string) {
	call, ok := index.(*ast.CallExpr)
	if !ok || len(call.Args) != 0 || call.Ellipsis != token.NoPos {
		return "", ""
	}
	selector, ok := call.Fun.(*ast.SelectorExpr)
	if !ok {
		return "", ""
	}
	owner, ok := selector.X.(*ast.Ident)
	if !ok || owner.Name != receiver {
		return "", ""
	}
	var kind string
	switch selector.Sel.Name {
	case "TalentLvlAttack":
		kind = "attack"
	case "TalentLvlSkill":
		kind = "skill"
	case "TalentLvlBurst":
		kind = "burst"
	default:
		return "", ""
	}
	return kind, fmt.Sprintf("%s.SourceHost%s(&%s, %d)", receiver, selector.Sel.Name, receipt, position)
}

func ancestorPath(root, target ast.Node) []ast.Node {
	stack := []ast.Node{}
	var result []ast.Node
	ast.Inspect(root, func(node ast.Node) bool {
		if node == nil {
			stack = stack[:len(stack)-1]
			return true
		}
		stack = append(stack, node)
		if node == target {
			result = append([]ast.Node{}, stack...)
		}
		return true
	})
	return result
}

func findRangeBinding(root ast.Node, assignment *ast.AssignStmt, rowVariable string, final []ast.Expr,
	receiver, sourcePath string, data []byte, fset *token.FileSet, tables map[string]table, packageDir string) (rangeBinding, string, bool) {
	path := ancestorPath(root, assignment)
	var owner *ast.RangeStmt
	ownerPosition := -1
	for i := len(path) - 1; i >= 0; i-- {
		loop, ok := path[i].(*ast.RangeStmt)
		if !ok {
			continue
		}
		value, ok := loop.Value.(*ast.Ident)
		if ok && value.Name == rowVariable {
			owner, ownerPosition = loop, i
			break
		}
	}
	if owner == nil {
		return rangeBinding{}, "", false
	}
	if receiver == "" {
		return rangeBinding{}, "range-local read has no character receiver", true
	}
	for _, node := range path[ownerPosition+1:] {
		if _, nested := node.(*ast.RangeStmt); nested {
			return rangeBinding{}, "range-local read crosses a nested range", true
		}
	}
	key, keyOK := owner.Key.(*ast.Ident)
	value, valueOK := owner.Value.(*ast.Ident)
	if owner.Tok != token.DEFINE || !keyOK || key.Name == "_" || !valueOK || value.Name == "_" {
		return rangeBinding{}, "range key/value are not distinct local := identifiers", true
	}
	if key.Name == value.Name {
		return rangeBinding{}, "range key and row identifiers coincide", true
	}
	tableRoot, outer := indexChain(owner.X)
	t, found := tables[packageDir+"#"+tableRoot]
	if !found {
		return rangeBinding{}, "range source is not a numeric generated table", true
	}
	if len(outer)+1+len(final) != t.dims {
		return rangeBinding{}, "range table dimension does not match outer, iteration and final indices", true
	}
	if generatedSymbolShadowedNode(root, tableRoot) {
		return rangeBinding{}, "generated range table symbol is shadowed locally", true
	}
	if rangeVariableWritten(owner, key.Name, value.Name) {
		return rangeBinding{}, "range key or row is shadowed or written in its body", true
	}
	position := fset.Position(owner.Pos())
	outerText := []string{}
	for _, index := range outer {
		outerText = append(outerText, string(data[offset(fset, index.Pos()):offset(fset, index.End())]))
	}
	return rangeBinding{
		loop: owner, table: t, root: tableRoot, outer: outer,
		key: key.Name, row: value.Name,
		prefix:     fmt.Sprintf("sourceHostTalentRange_%d_%d", position.Line, position.Column),
		indexTexts: outerText,
		source: rangeSource{
			Path: sourcePath, Expression: string(data[offset(fset, owner.X.Pos()):offset(fset, owner.X.End())]),
			RowVariable: value.Name, IndexVariable: key.Name, IndexPosition: len(outer), Line: position.Line,
		},
	}, "", true
}

func generatedSymbolShadowedNode(root ast.Node, symbol string) bool {
	shadowed := false
	ast.Inspect(root, func(node ast.Node) bool {
		switch v := node.(type) {
		case *ast.AssignStmt:
			if v.Tok == token.DEFINE {
				for _, lhs := range v.Lhs {
					if id, ok := lhs.(*ast.Ident); ok && id.Name == symbol {
						shadowed = true
					}
				}
			}
		case *ast.RangeStmt:
			if v.Tok == token.DEFINE {
				for _, lhs := range []ast.Expr{v.Key, v.Value} {
					if id, ok := lhs.(*ast.Ident); ok && id.Name == symbol {
						shadowed = true
					}
				}
			}
		case *ast.ValueSpec:
			for _, name := range v.Names {
				if name.Name == symbol {
					shadowed = true
				}
			}
		case *ast.Field:
			for _, name := range v.Names {
				if name.Name == symbol {
					shadowed = true
				}
			}
		}
		return !shadowed
	})
	return shadowed
}

func rangeVariableWritten(loop *ast.RangeStmt, key, row string) bool {
	written := false
	ast.Inspect(loop.Body, func(node ast.Node) bool {
		switch v := node.(type) {
		case *ast.AssignStmt:
			for _, lhs := range v.Lhs {
				if writesRangeVariable(lhs, key, row) {
					written = true
				}
			}
		case *ast.IncDecStmt:
			if writesRangeVariable(v.X, key, row) {
				written = true
			}
		case *ast.RangeStmt:
			if v.Tok == token.DEFINE {
				for _, lhs := range []ast.Expr{v.Key, v.Value} {
					if writesRangeVariable(lhs, key, row) {
						written = true
					}
				}
			}
		case *ast.ValueSpec:
			for _, name := range v.Names {
				if name.Name == key || name.Name == row {
					written = true
				}
			}
		case *ast.Field:
			for _, name := range v.Names {
				if name.Name == key || name.Name == row {
					written = true
				}
			}
		}
		return !written
	})
	return written
}
func writesRangeVariable(expr ast.Expr, key, row string) bool {
	for {
		switch v := expr.(type) {
		case *ast.Ident:
			return v.Name == key || v.Name == row
		case *ast.IndexExpr:
			expr = v.X
		case *ast.SelectorExpr:
			expr = v.X
		case *ast.StarExpr:
			expr = v.X
		default:
			return false
		}
	}
}

// Accept by-value AttackInfo parameters and visible local literals/copies.
// A block's earlier direct statements supply local definitions; branches and
// unrelated scopes cannot supply a binding.
func visibleAttackInfoVariable(fn *ast.FuncDecl, target *ast.AssignStmt, variable string) bool {
	path := ancestorPath(fn.Body, target)
	known := map[string]bool{}
	for _, field := range fn.Type.Params.List {
		for _, name := range field.Names {
			known[name.Name] = isAttackInfo(field.Type)
		}
	}
	for i, node := range path {
		block, ok := node.(*ast.BlockStmt)
		if !ok || i+1 >= len(path) {
			continue
		}
		child := path[i+1]
		for _, statement := range block.List {
			if statement.Pos() >= child.Pos() {
				break
			}
			assignment, ok := statement.(*ast.AssignStmt)
			if !ok || len(assignment.Lhs) != 1 || len(assignment.Rhs) != 1 {
				continue
			}
			name, ok := assignment.Lhs[0].(*ast.Ident)
			if !ok {
				continue
			}
			if assignment.Tok != token.DEFINE && assignment.Tok != token.ASSIGN {
				continue
			}
			if literal, ok := assignment.Rhs[0].(*ast.CompositeLit); ok && isAttackInfo(literal.Type) {
				known[name.Name] = true
			} else if source, ok := assignment.Rhs[0].(*ast.Ident); ok {
				known[name.Name] = known[source.Name]
			} else {
				known[name.Name] = false
			}
		}
	}
	return known[variable]
}

func removeSkippedSite(result *report, siteID string) {
	for i, row := range result.Skipped {
		if row.SiteID == siteID {
			result.Skipped = append(result.Skipped[:i], result.Skipped[i+1:]...)
			return
		}
	}
}
func replaceOrAppendSkipped(result *report, row site) {
	for i := range result.Skipped {
		if result.Skipped[i].SiteID == row.SiteID {
			result.Skipped[i].Reason = row.Reason
			return
		}
	}
	result.Skipped = append(result.Skipped, row)
}

func exactGoConstant(expr ast.Expr) (constant.Value, bool) {
	switch v := expr.(type) {
	case *ast.ParenExpr:
		return exactGoConstant(v.X)
	case *ast.BasicLit:
		if v.Kind != token.INT && v.Kind != token.FLOAT {
			return nil, false
		}
		value := constant.MakeFromLiteral(v.Value, v.Kind, 0)
		return value, value.Kind() != constant.Unknown
	case *ast.UnaryExpr:
		if v.Op != token.ADD && v.Op != token.SUB {
			return nil, false
		}
		value, ok := exactGoConstant(v.X)
		if !ok {
			return nil, false
		}
		return constant.UnaryOp(v.Op, value, 0), true
	case *ast.BinaryExpr:
		if v.Op != token.ADD && v.Op != token.SUB && v.Op != token.MUL && v.Op != token.QUO {
			return nil, false
		}
		left, leftOK := exactGoConstant(v.X)
		right, rightOK := exactGoConstant(v.Y)
		if !leftOK || !rightOK {
			return nil, false
		}
		return constant.BinaryOp(left, v.Op, right), true
	}
	return nil, false
}

func exactGoConstantWithSymbols(expr ast.Expr, fn *ast.FuncDecl, packageDir string,
	constants map[string]constant.Value) (constant.Value, bool) {
	if value, ok := exactGoConstant(expr); ok {
		return value, true
	}
	switch v := expr.(type) {
	case *ast.Ident:
		if generatedSymbolShadowed(fn, v.Name) {
			return nil, false
		}
		value, ok := constants[packageDir+"#"+v.Name]
		return value, ok
	case *ast.ParenExpr:
		return exactGoConstantWithSymbols(v.X, fn, packageDir, constants)
	case *ast.UnaryExpr:
		if v.Op != token.ADD && v.Op != token.SUB {
			return nil, false
		}
		value, ok := exactGoConstantWithSymbols(v.X, fn, packageDir, constants)
		if !ok {
			return nil, false
		}
		return constant.UnaryOp(v.Op, value, 0), true
	case *ast.BinaryExpr:
		if v.Op != token.ADD && v.Op != token.SUB && v.Op != token.MUL && v.Op != token.QUO {
			return nil, false
		}
		left, leftOK := exactGoConstantWithSymbols(v.X, fn, packageDir, constants)
		right, rightOK := exactGoConstantWithSymbols(v.Y, fn, packageDir, constants)
		if !leftOK || !rightOK {
			return nil, false
		}
		return constant.BinaryOp(left, v.Op, right), true
	}
	return nil, false
}

func constantFormula(value constant.Value) (formulaNode, bool) {
	if value == nil || value.Kind() == constant.Unknown {
		return formulaNode{}, false
	}
	number, _ := constant.Float64Val(constant.ToFloat(value))
	if math.IsNaN(number) || math.IsInf(number, 0) {
		return formulaNode{}, false
	}
	return formulaNode{Kind: "constant", Value: &number}, true
}

func potentialTalentTableLeaf(root ast.Node, assignment *ast.AssignStmt, expr ast.Expr,
	tables map[string]table, packageDir string) bool {
	found := false
	ast.Inspect(expr, func(node ast.Node) bool {
		index, ok := node.(*ast.IndexExpr)
		if !ok {
			return true
		}
		base, _ := indexChain(index)
		if _, direct := tables[packageDir+"#"+base]; direct {
			found = true
			return false
		}
		for _, ancestor := range ancestorPath(root, assignment) {
			loop, ok := ancestor.(*ast.RangeStmt)
			if !ok {
				continue
			}
			if value, ok := loop.Value.(*ast.Ident); ok && value.Name == base {
				found = true
				return false
			}
		}
		return true
	})
	return found
}

func parseTalentExpression(expr ast.Expr, fn *ast.FuncDecl, assignment *ast.AssignStmt,
	receiver, sourcePath, siteID, packageDir string, data []byte, fset *token.FileSet,
	tables map[string]table, constants map[string]constant.Value) (formulaNode, []expressionLeaf, string) {
	leaves := []expressionLeaf{}
	var walk func(ast.Expr) (formulaNode, string)
	walk = func(current ast.Expr) (formulaNode, string) {
		if value, ok := exactGoConstantWithSymbols(current, fn, packageDir, constants); ok {
			if node, valid := constantFormula(value); valid {
				return node, ""
			}
			return formulaNode{}, "Go constant cannot be represented as a finite float64"
		}
		switch v := current.(type) {
		case *ast.ParenExpr:
			return walk(v.X)
		case *ast.UnaryExpr:
			if v.Op != token.ADD && v.Op != token.SUB {
				return formulaNode{}, "unsupported unary operator in talent expression"
			}
			child, reason := walk(v.X)
			if reason != "" {
				return formulaNode{}, reason
			}
			if v.Op == token.ADD {
				return child, ""
			}
			minus := -1.0
			return formulaNode{Kind: "multiply", Terms: []formulaNode{{Kind: "constant", Value: &minus}, child}}, ""
		case *ast.BinaryExpr:
			var kind string
			switch v.Op {
			case token.ADD:
				kind = "add"
			case token.SUB:
				kind = "subtract"
			case token.MUL:
				kind = "multiply"
			case token.QUO:
				kind = "divide"
			default:
				return formulaNode{}, "unsupported binary operator in talent expression"
			}
			left, reason := walk(v.X)
			if reason != "" {
				return formulaNode{}, reason
			}
			right, reason := walk(v.Y)
			if reason != "" {
				return formulaNode{}, reason
			}
			if kind == "add" || kind == "multiply" {
				return formulaNode{Kind: kind, Terms: []formulaNode{left, right}}, ""
			}
			return formulaNode{Kind: kind, Left: &left, Right: &right}, ""
		case *ast.IndexExpr:
			base, indices := indexChain(v)
			if base == "" || len(indices) == 0 {
				return formulaNode{}, "table leaf is not a direct indexed identifier"
			}
			position := fset.Position(v.Pos())
			term := len(leaves)
			row := site{SiteID: fmt.Sprintf("%s#term%d", siteID, term), Path: sourcePath,
				Line: position.Line, Column: position.Column, IndexExpressions: []string{}}
			leaf := expressionLeaf{value: v, indices: indices, base: base}
			if direct, found := tables[packageDir+"#"+base]; found {
				if len(indices) != direct.dims {
					return formulaNode{}, "generated table leaf index depth differs from dimension"
				}
				if generatedSymbolShadowed(fn, base) {
					return formulaNode{}, "generated table leaf symbol is shadowed locally"
				}
				leaf.table = direct
				for _, idx := range indices {
					row.IndexExpressions = append(row.IndexExpressions, string(data[offset(fset, idx.Pos()):offset(fset, idx.End())]))
				}
			} else {
				binding, reason, recognized := findRangeBinding(fn.Body, assignment, base, indices, receiver, sourcePath, data, fset, tables, packageDir)
				if !recognized {
					return formulaNode{}, "table leaf is neither generated nor a bound range row"
				}
				if reason != "" {
					return formulaNode{}, reason
				}
				leaf.table = binding.table
				leaf.binding = &binding
				row.RangeSource = &binding.source
				row.IndexExpressions = append(row.IndexExpressions, binding.indexTexts...)
				row.IndexExpressions = append(row.IndexExpressions, binding.key)
				for i, idx := range binding.outer {
					if kind, _ := directTalentLevelIndex(idx, receiver, binding.prefix, i); kind != "" {
						row.TalentLevelIndices = append(row.TalentLevelIndices, talentLevelIndex{Position: i, Kind: kind})
					}
				}
				for _, idx := range indices {
					row.IndexExpressions = append(row.IndexExpressions, string(data[offset(fset, idx.Pos()):offset(fset, idx.End())]))
				}
			}
			row.TableID = leaf.table.TableID
			indexOffset := 0
			if leaf.binding != nil {
				indexOffset = len(leaf.binding.outer) + 1
			}
			for i, idx := range indices {
				if kind, _ := directTalentLevelIndex(idx, receiver, "", indexOffset+i); kind != "" {
					row.TalentLevelIndices = append(row.TalentLevelIndices, talentLevelIndex{Position: indexOffset + i, Kind: kind})
				}
			}
			leaf.row = row
			leaves = append(leaves, leaf)
			return formulaNode{Kind: "variable", Key: fmt.Sprintf("term%d", term)}, ""
		default:
			return formulaNode{}, "talent expression contains a dynamic field, call or unsupported term"
		}
	}
	node, reason := walk(expr)
	if reason != "" {
		return formulaNode{}, nil, reason
	}
	if len(leaves) == 0 {
		return formulaNode{}, nil, "talent expression has no generated table leaf"
	}
	return node, leaves, ""
}
func generatedSymbolShadowed(fn *ast.FuncDecl, symbol string) bool {
	shadowed := false
	ast.Inspect(fn.Body, func(node ast.Node) bool {
		switch v := node.(type) {
		case *ast.AssignStmt:
			if v.Tok == token.DEFINE {
				for _, lhs := range v.Lhs {
					if id, ok := lhs.(*ast.Ident); ok && id.Name == symbol {
						shadowed = true
					}
				}
			}
		case *ast.RangeStmt:
			if v.Tok == token.DEFINE {
				for _, lhs := range []ast.Expr{v.Key, v.Value} {
					if id, ok := lhs.(*ast.Ident); ok && id.Name == symbol {
						shadowed = true
					}
				}
			}
		case *ast.ValueSpec:
			for _, name := range v.Names {
				if name.Name == symbol {
					shadowed = true
				}
			}
		case *ast.Field:
			for _, name := range v.Names {
				if name.Name == symbol {
					shadowed = true
				}
			}
		}
		return !shadowed
	})
	return shadowed
}
func laterMultWrite(fn *ast.FuncDecl, after token.Pos, variable string) bool {
	wrote := false
	ast.Inspect(fn.Body, func(node ast.Node) bool {
		if node == nil || node.Pos() <= after {
			return true
		}
		switch v := node.(type) {
		case *ast.AssignStmt:
			for _, lhs := range v.Lhs {
				if isMultSelector(lhs, variable) {
					wrote = true
				}
			}
		case *ast.IncDecStmt:
			if isMultSelector(v.X, variable) {
				wrote = true
			}
		}
		return !wrote
	})
	return wrote
}
func isMultSelector(expr ast.Expr, variable string) bool {
	sel, ok := expr.(*ast.SelectorExpr)
	if !ok || sel.Sel.Name != "Mult" {
		return false
	}
	id, ok := sel.X.(*ast.Ident)
	return ok && id.Name == variable
}
func hasImportBlock(file *ast.File) bool {
	for _, declaration := range file.Decls {
		if gen, ok := declaration.(*ast.GenDecl); ok && gen.Tok == token.IMPORT && gen.Lparen != token.NoPos {
			return true
		}
	}
	return false
}
func importsSourcehost(file *ast.File) bool {
	for _, imp := range file.Imports {
		path, err := strconv.Unquote(imp.Path.Value)
		if err == nil && path == sourceHostImport {
			return true
		}
	}
	return false
}
