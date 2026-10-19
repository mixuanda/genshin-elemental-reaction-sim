// Static, standard-library-only extraction from caller-verified Git blobs.
// It parses source text; it never compiles or executes upstream code.
package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path"
	"sort"
	"strconv"
	"strings"
)

type input struct {
	SourceRoot string `json:"sourceRoot"`
	Files []string `json:"files"`
	Packages []struct { PackagePath string `json:"packagePath"`; DirectFiles []string `json:"directFiles"` } `json:"packages"`
}
type location struct { Path string `json:"path"`; Line int `json:"line"` }
type parameter struct { Key string `json:"key"`; Source location `json:"source"` }
type action struct {
	Kind string `json:"kind"`; Status string `json:"status"`; Source location `json:"source"`
	Method string `json:"method"`; Parameters []parameter `json:"parameters"`; ParameterScope string `json:"parameterScope"`
}
type normalChain struct { Length *int `json:"length"`; Source *location `json:"source,omitempty"` }
type capabilities struct { SchemaVersion int `json:"schemaVersion"`; Actions []action `json:"actions"`; NormalChain normalChain `json:"normalChain"` }
type output struct { Packages []struct { PackagePath string `json:"packagePath"`; ActionCapabilities capabilities `json:"actionCapabilities"` } `json:"packages"`; UsedFiles []string `json:"usedFiles"` }
type fileData struct { path, pkg string; f *ast.File; imports map[string]string }
type methodData struct { key, receiver, name, path string; line int; decl *ast.FuncDecl; file *fileData }
type typeData struct { key, pkg, name, path string; line int; embedded []string }
type context struct {
	fset *token.FileSet; files []*fileData; byPackage map[string][]*fileData
	methods map[string]*methodData; types map[string]*typeData; used map[string]bool
}
var actionMethods = []struct{ kind, method string }{
	{"skill", "Skill"}, {"burst", "Burst"}, {"attack", "Attack"}, {"charge", "ChargeAttack"},
	{"aim", "Aimed"}, {"low_plunge", "LowPlungeAttack"}, {"high_plunge", "HighPlungeAttack"},
	{"dash", "Dash"}, {"jump", "Jump"},
}
const importPrefix = "github.com/genshinsim/gcsim/"

func main() {
	var in input
	if err := json.NewDecoder(os.Stdin).Decode(&in); err != nil { fatal(err) }
	ctx := &context{fset: token.NewFileSet(), byPackage: map[string][]*fileData{}, methods: map[string]*methodData{}, types: map[string]*typeData{}, used: map[string]bool{}}
	seen := map[string]bool{}
	for _, p := range in.Files {
		if seen[p] || !strings.HasSuffix(p, ".go") || strings.HasSuffix(p, "_test.go") { continue }
		if strings.HasPrefix(p, "/") || strings.Contains(p, "..") { fatal(fmt.Errorf("untrusted source path %q", p)) }
		seen[p] = true
		f, err := parser.ParseFile(ctx.fset, path.Join(in.SourceRoot, p), nil, 0)
		if err != nil { fatal(fmt.Errorf("parse %s: %w", p, err)) }
		fd := &fileData{path: p, pkg: path.Dir(p), f: f, imports: map[string]string{}}
		for _, imp := range f.Imports {
			value, err := strconv.Unquote(imp.Path.Value); if err != nil { continue }
			if !strings.HasPrefix(value, importPrefix) { continue }
			alias := path.Base(value); if imp.Name != nil { alias = imp.Name.Name }
			fd.imports[alias] = strings.TrimPrefix(value, importPrefix)
		}
		ctx.files = append(ctx.files, fd); ctx.byPackage[fd.pkg] = append(ctx.byPackage[fd.pkg], fd)
	}
	for _, fd := range ctx.files { ctx.index(fd) }
	var out output
	for _, pkg := range in.Packages {
		row := struct { PackagePath string `json:"packagePath"`; ActionCapabilities capabilities `json:"actionCapabilities"` }{PackagePath: pkg.PackagePath, ActionCapabilities: ctx.extract(pkg.PackagePath, pkg.DirectFiles)}
		out.Packages = append(out.Packages, row)
	}
	for p := range ctx.used { out.UsedFiles = append(out.UsedFiles, p) }; sort.Strings(out.UsedFiles)
	if err := json.NewEncoder(os.Stdout).Encode(out); err != nil { fatal(err) }
}
func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }
func loc(c *context, p string, pos token.Pos) location { return location{Path: p, Line: c.fset.Position(pos).Line} }
func typeName(x ast.Expr) string { switch v := x.(type) { case *ast.Ident: return v.Name; case *ast.StarExpr: return typeName(v.X) }; return "" }
func (c *context) embeddedKey(fd *fileData, x ast.Expr) string {
	switch v := x.(type) {
	case *ast.StarExpr: return c.embeddedKey(fd, v.X)
	case *ast.Ident: return fd.pkg + ":" + v.Name
	case *ast.SelectorExpr:
		if pkg := fd.imports[typeName(v.X)]; pkg != "" { return pkg + ":" + v.Sel.Name }
	}; return ""
}
func (c *context) index(fd *fileData) {
	for _, decl := range fd.f.Decls {
		switch d := decl.(type) {
		case *ast.GenDecl:
			if d.Tok != token.TYPE { continue }
			for _, spec := range d.Specs { ts, ok := spec.(*ast.TypeSpec); if !ok { continue }; st, ok := ts.Type.(*ast.StructType); if !ok { continue }
				t := &typeData{key: fd.pkg + ":" + ts.Name.Name, pkg: fd.pkg, name: ts.Name.Name, path: fd.path, line: c.fset.Position(ts.Pos()).Line}
				for _, field := range st.Fields.List { if len(field.Names) == 0 { if key := c.embeddedKey(fd, field.Type); key != "" { t.embedded = append(t.embedded, key) } } }
				c.types[t.key] = t
			}
		case *ast.FuncDecl:
			if d.Recv == nil || len(d.Recv.List) != 1 { continue }
			receiver := typeName(d.Recv.List[0].Type); if receiver == "" { continue }
			key := fd.pkg + ":" + receiver + "." + d.Name.Name
			c.methods[key] = &methodData{key: key, receiver: fd.pkg + ":" + receiver, name: d.Name.Name, path: fd.path, line: c.fset.Position(d.Pos()).Line, decl: d, file: fd}
		}
	}
}
func (c *context) resolve(typeKey, method string, visited map[string]bool) (*methodData, bool) {
	if visited[typeKey] { return nil, false }; visited[typeKey] = true
	if m := c.methods[typeKey + "." + method]; m != nil { return m, true }
	t := c.types[typeKey]; if t == nil { return nil, false }
	var found *methodData
	for _, embedded := range t.embedded {
		m, ok := c.resolve(embedded, method, visited); if !ok { continue }
		if found != nil && found.key != m.key { return nil, false }; found = m
	}
	return found, found != nil
}
func (c *context) root(pkg string, direct []string) *typeData {
	if t := c.types[pkg+":char"]; t != nil { return t }
	var found *typeData
	for _, f := range direct { for _, t := range c.types { if t.path != f { continue }; if found != nil { return nil }; found = t } }
	return found
}
func (c *context) extract(pkg string, direct []string) capabilities {
	result := capabilities{SchemaVersion: 1, Actions: []action{}, NormalChain: normalChain{Length: nil}}
	root := c.root(pkg, direct)
	for _, spec := range actionMethods {
		a := action{Kind: spec.kind, Status: "unresolved", Method: spec.method, Parameters: []parameter{}, ParameterScope: "resolved-method-and-forwarded-same-receiver-helpers"}
		if root != nil {
			a.Source = location{Path: root.path, Line: root.line}; c.used[root.path] = true
			if method, ok := c.resolve(root.key, spec.method, map[string]bool{}); ok {
				seen := map[string]bool{}
				for method != nil && !seen[method.key] {
					seen[method.key] = true; a.Method = method.name; a.Source = location{Path: method.path, Line: method.line}; c.used[method.path] = true
					if baseError(method) { a.Status = "unsupported"; break }
					delegated, isDelegate := c.pureDelegate(method)
					if !isDelegate { a.Status = "implemented"; a.Parameters = c.parameters(method); break }
					method = delegated
				}
			}
		}
		result.Actions = append(result.Actions, a)
	}
	if root != nil { result.NormalChain = c.normalChain(root) }
	return result
}
func baseError(m *methodData) bool {
	if m.decl.Body == nil || len(m.decl.Body.List) != 1 { return false }
	ret, ok := m.decl.Body.List[0].(*ast.ReturnStmt); if !ok { return false }
	for _, expr := range ret.Results { call, ok := expr.(*ast.CallExpr); if !ok { continue }; selector, ok := call.Fun.(*ast.SelectorExpr); if !ok || selector.Sel.Name != "Errorf" { continue }
		for _, arg := range call.Args { lit, ok := arg.(*ast.BasicLit); if !ok || lit.Kind != token.STRING { continue }; value, _ := strconv.Unquote(lit.Value); if strings.Contains(value, "not implemented") { return true } }
	}; return false
}
func (c *context) pureDelegate(m *methodData) (*methodData, bool) {
	if m.decl.Body == nil || len(m.decl.Body.List) != 1 || m.decl.Recv == nil || len(m.decl.Recv.List[0].Names) == 0 { return nil, false }
	ret, ok := m.decl.Body.List[0].(*ast.ReturnStmt); if !ok || len(ret.Results) != 1 { return nil, false }
	call, ok := ret.Results[0].(*ast.CallExpr); if !ok { return nil, false }
	outer, ok := call.Fun.(*ast.SelectorExpr); if !ok { return nil, false }
	inner, ok := outer.X.(*ast.SelectorExpr); if !ok { return nil, false }
	owner, ok := inner.X.(*ast.Ident); if !ok || owner.Name != m.decl.Recv.List[0].Names[0].Name { return nil, false }
	t := c.types[m.receiver]; if t == nil { return nil, true }
	for _, embedded := range t.embedded { if next := c.types[embedded]; next != nil && next.name == inner.Sel.Name {
		method, ok := c.resolve(embedded, outer.Sel.Name, map[string]bool{}); if ok { return method, true }
	} }
	return nil, true
}
func (c *context) parameters(m *methodData) []parameter {
	seenMethods := map[string]bool{}; found := map[string]parameter{}
	var walk func(*methodData, string)
	walk = func(current *methodData, mapName string) {
		if current == nil || seenMethods[current.key+":"+mapName] || current.decl.Body == nil { return }
		seenMethods[current.key+":"+mapName] = true; c.used[current.path] = true
		receiverName := ""; if current.decl.Recv != nil && len(current.decl.Recv.List) > 0 && len(current.decl.Recv.List[0].Names) > 0 { receiverName = current.decl.Recv.List[0].Names[0].Name }
		ast.Inspect(current.decl.Body, func(n ast.Node) bool {
			switch v := n.(type) {
			case *ast.IndexExpr:
				id, ok := v.X.(*ast.Ident); if !ok || id.Name != mapName { break }; lit, ok := v.Index.(*ast.BasicLit); if !ok || lit.Kind != token.STRING { break }
				key, err := strconv.Unquote(lit.Value); if err == nil && key != "" { p := parameter{Key: key, Source: loc(c, current.path, v.Pos())}; if _, exists := found[key]; !exists { found[key] = p } }
			case *ast.CallExpr:
				sel, ok := v.Fun.(*ast.SelectorExpr); if !ok { break }; id, ok := sel.X.(*ast.Ident); if !ok || id.Name != receiverName { break }
				helper, ok := c.resolve(current.receiver, sel.Sel.Name, map[string]bool{}); if !ok || helper.key == current.key { break }
				argIndex := -1; for i, arg := range v.Args { if a, ok := arg.(*ast.Ident); ok && a.Name == mapName { argIndex = i; break } }; if argIndex < 0 { break }
				position := 0; for _, field := range helper.decl.Type.Params.List { for _, name := range field.Names { if position == argIndex { walk(helper, name.Name) }; position++ } }
			}
			return true
		})
	}
	for _, field := range m.decl.Type.Params.List { if _, ok := field.Type.(*ast.MapType); ok { for _, name := range field.Names { walk(m, name.Name) } } }
	result := make([]parameter, 0, len(found)); for _, p := range found { result = append(result, p) }
	sort.Slice(result, func(i,j int) bool { return result[i].Key < result[j].Key }); return result
}
func (c *context) normalChain(root *typeData) normalChain {
	visitedTypes, visitedPackages := map[string]bool{}, map[string]bool{}
	var found *normalChain; conflict, dynamic := false, false
	var inspectType func(*typeData)
	inspectType = func(current *typeData) {
		if current == nil || visitedTypes[current.key] { return }; visitedTypes[current.key] = true
		if !visitedPackages[current.pkg] {
			visitedPackages[current.pkg] = true
			for _, fd := range c.byPackage[current.pkg] {
				ast.Inspect(fd.f, func(n ast.Node) bool {
					assign, ok := n.(*ast.AssignStmt); if !ok { return true }
					for i, lhs := range assign.Lhs {
						sel, ok := lhs.(*ast.SelectorExpr); if !ok || sel.Sel.Name != "NormalHitNum" { continue }
						if i >= len(assign.Rhs) { dynamic = true; continue }
						value, ok := c.integer(fd, assign.Rhs[i]); if !ok { dynamic = true; continue }
						v := normalChain{Length: &value}; source := loc(c, fd.path, assign.Pos()); v.Source = &source
						if found != nil && *found.Length != value { conflict = true }; if found == nil { found = &v }
					}; return true
				})
			}
		}
		for _, embedded := range current.embedded { inspectType(c.types[embedded]) }
	}
	inspectType(root)
	if conflict || dynamic || found == nil { return normalChain{Length:nil} }
	c.used[found.Source.Path] = true; return *found
}
func (c *context) integer(fd *fileData, x ast.Expr) (int, bool) {
	if lit, ok := x.(*ast.BasicLit); ok && lit.Kind == token.INT { v, err := strconv.ParseInt(lit.Value, 0, 64); return int(v), err == nil && v > 0 }
	id, ok := x.(*ast.Ident); if !ok { return 0, false }
	for _, file := range c.byPackage[fd.pkg] { for _, decl := range file.f.Decls { gen, ok := decl.(*ast.GenDecl); if !ok || gen.Tok != token.CONST { continue }
		for _, spec := range gen.Specs { value, ok := spec.(*ast.ValueSpec); if !ok { continue }; for i, name := range value.Names { if name.Name == id.Name && i < len(value.Values) { return c.integer(file, value.Values[i]) } } }
	} }; return 0, false
}
