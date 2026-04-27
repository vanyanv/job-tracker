export interface BraveResult {
  url: string;
  title: string;
  description: string;
}

export interface BraveSearchOpts {
  q: string;
  apiKey: string;
  count?: number;
  freshness?: "pd" | "pw" | "pm" | "py";
  country?: string;
}

export async function braveSearch(opts: BraveSearchOpts): Promise<BraveResult[]> {
  const params = new URLSearchParams({
    q: opts.q,
    count: String(opts.count ?? 20),
  });
  if (opts.freshness) params.set("freshness", opts.freshness);
  if (opts.country) params.set("country", opts.country);

  const url = `https://api.search.brave.com/res/v1/web/search?${params.toString()}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": opts.apiKey,
      },
    });
    if (!res.ok) {
      console.warn(`[brave] HTTP ${res.status} q=${opts.q}`);
      return [];
    }
    const data = (await res.json()) as { web?: { results?: BraveResult[] } };
    return data.web?.results ?? [];
  } catch (err) {
    console.warn(`[brave] error q=${opts.q}: ${String(err)}`);
    return [];
  }
}
