const ALIASES: Record<string, string> = {
  "react.js": "react",
  reactjs: "react",
  nodejs: "node",
  "node.js": "node",
  golang: "go",
  postgres: "postgresql",
  pg: "postgresql",
  k8s: "kubernetes",
  ts: "typescript",
  js: "javascript",
  py: "python",
  "next.js": "nextjs",
};

export function normalizeStackTag(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  return ALIASES[v] ?? v;
}

export function normalizeStackTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const n = normalizeStackTag(t);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= 8) break;
  }
  return out;
}
