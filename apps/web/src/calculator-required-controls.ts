import type {CalculatorFieldRequirement} from './calculator-requirements';

export interface InlineCalculatorRequirement {
  field: CalculatorFieldRequirement;
  required: boolean;
}

/** Relocate the existing input, never clone its state or invent an answer.
 * Answered fields remain editable for this exact selection, including while a
 * numeric answer is being typed. Every input keeps its original ID/listeners.
 */
export function createCalculatorRequiredControls(root: HTMLElement) {
  const moved: {label: HTMLLabelElement; marker: Comment; selector: string}[] = [];
  const known = new Map<string,CalculatorFieldRequirement>();
  let selection = '';
  let focusSelector: string | null = null;
  let relocating = false;

  function restore(): void {
    relocating = true;
    try {
      if (moved.length) focusSelector = moved.find(row => row.label.contains(root.ownerDocument.activeElement))?.selector ?? null;
      for (const {label,marker} of moved.splice(0)) {
        if (root.contains(marker)) marker.replaceWith(label);
        else label.remove();
      }
    } finally {
      relocating = false;
    }
  }

  function fields(key: string, required: readonly CalculatorFieldRequirement[]): InlineCalculatorRequirement[] {
    if (selection !== key) {known.clear();selection=key;}
    for (const field of required) known.set(field.id,field);
    // Conditional fields can cease to exist after an action/scope change.
    for (const [id,field] of known) if (!root.querySelector(field.controlSelector)) known.delete(id);
    const pending = new Set(required.map(field=>field.id));
    return [...known.values()].map(field=>({field,required:pending.has(field.id)}));
  }

  function mount(rows: readonly InlineCalculatorRequirement[]): void {
    relocating = true;
    try {
      rows.forEach(({field},index)=>{
        const host=root.querySelector<HTMLElement>(`[data-calculator-inline-control="${index}"]`);
        const control=root.querySelector<HTMLElement>(field.controlSelector);
        const label=control?.closest('label');
        // A composite editor needs its own adapter; do not steal sibling inputs.
        if (!host || !label || !root.contains(label) || control?.matches(':disabled') || label.querySelectorAll('input,select,textarea').length!==1) return;
        const marker=root.ownerDocument.createComment('calculator-condition-original-position');
        label.before(marker);host.append(label);
        moved.push({label,marker,selector:field.controlSelector});
        const fallback=host.parentElement?.querySelector<HTMLElement>('[data-calculator-requirement]');
        if (fallback) fallback.hidden=true;
      });
      if (focusSelector) root.querySelector<HTMLElement>(focusSelector)?.focus({preventScroll:true});
      focusSelector=null;
    } finally {
      relocating = false;
    }
  }

  return {restore,fields,mount,isRelocating:()=>relocating,hasActiveControl:()=>focusSelector!==null};
}
