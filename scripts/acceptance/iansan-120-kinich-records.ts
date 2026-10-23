import { createHash } from "node:crypto";
import { createReadStream, openSync, closeSync, writeSync } from "node:fs";

/** One formula record per line; consumers must stream lines, not JSON.parse the whole file. */
export function writeIansanFormulaRecords(path: string, rows: Iterable<unknown>): void {
  const fd = openSync(path, "wx");
  try { for (const row of rows) { writeSync(fd, JSON.stringify(row)); writeSync(fd, "\n"); } }
  finally { closeSync(fd); }
}

export async function iansanFileIdentity(path: string) {
  const hash = createHash("sha256"); let bytes = 0;
  for await (const chunk of createReadStream(path)) { hash.update(chunk); bytes += chunk.length; }
  return { bytes, sha256: hash.digest("hex") };
}
