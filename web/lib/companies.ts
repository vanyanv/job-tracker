const SUFFIX = /[\s,.]*\b(inc|incorporated|llc|ltd|corp|corporation|co)\.?\s*$/i;

export function normalizeCompany(raw: string): string {
  let v = raw.trim();
  let prev = "";
  while (prev !== v) {
    prev = v;
    v = v.replace(SUFFIX, "").trim();
  }
  return v.toLowerCase();
}
