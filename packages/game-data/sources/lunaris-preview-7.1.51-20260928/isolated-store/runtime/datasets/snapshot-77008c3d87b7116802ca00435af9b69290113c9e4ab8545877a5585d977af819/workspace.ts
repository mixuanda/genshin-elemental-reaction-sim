// Immutable isolated dataset workspace.
export { default as catalog } from "./catalog.json";
export { default as index } from "./catalog-index.json";
export { default as supplemental } from "./supplemental.json";
import evidence from "./evidence-v1.json";
export { evidence };
export const metadata = evidence.metadata;
