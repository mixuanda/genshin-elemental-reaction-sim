/** Object property insertion order is not part of a JSON request's identity.
 * All fields and array positions are: frames, actors, input and provenance must
 * agree, including opaque metadata. Inputs here have been parsed as JSON/schema.
 */
export function sourceHostRequestsEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left)) {
    if (!Array.isArray(right) || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index++) if (!sourceHostRequestsEqual(left[index], right[index])) return false;
    return true;
  }
  if (Array.isArray(right)) return false;
  const leftRecord = left as Record<string, unknown>, rightRecord = right as Record<string, unknown>;
  const keys = Object.keys(leftRecord);
  if (keys.length !== Object.keys(rightRecord).length) return false;
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(rightRecord, key)
    || !sourceHostRequestsEqual(leftRecord[key], rightRecord[key])) return false;
  return true;
}
