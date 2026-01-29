export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function searchWeb(query: string, count: number = 5): Promise<{ results: SearchResult[]; fromWeb: boolean }> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    return {
      fromWeb: false,
      results: [
        { title: "Web search unavailable", url: "", snippet: `Add BRAVE_API_KEY environment variable to enable live web enrichment. Query: "${query}"` },
      ],
    };
  }

  try {
    const params = new URLSearchParams({ q: query, count: String(count) });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Brave API ${res.status}`);
    const data = await res.json();
    const results: SearchResult[] = (data.web?.results || []).map((r: Record<string, string>) => ({
      title: r.title,
      url: r.url,
      snippet: r.description || '',
    }));
    return { results, fromWeb: true };
  } catch (e) {
    console.error('Web search error:', e);
    return { results: [], fromWeb: false };
  }
}

export async function enrichCompany(companyName: string): Promise<string> {
  const queries = [
    `${companyName} company overview business model`,
    `${companyName} financial results revenue`,
    `${companyName} competitors market analysis`,
    `${companyName} recent news 2024`,
  ];

  let enrichment = '## Web Research Results\n\n';
  let anyFromWeb = false;

  for (const q of queries) {
    const { results, fromWeb } = await searchWeb(q, 3);
    if (fromWeb) anyFromWeb = true;
    enrichment += `### Search: "${q}"\n`;
    for (const r of results) {
      enrichment += `- **${r.title}**${r.url ? ` ([link](${r.url}))` : ''}: ${r.snippet}\n`;
    }
    enrichment += '\n';
  }

  if (!anyFromWeb) {
    enrichment = '⚠️ Web enrichment unavailable (no BRAVE_API_KEY). Analysis based on provided input only.\n';
  }

  return enrichment;
}
