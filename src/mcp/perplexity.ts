export const DEFAULT_PERPLEXITY_AB_TEST = 'sapi-ranking-navigate-cfg={"mode":"prefer_dynamodb","num_results":1,"force_first_pos":false,"force_snippet":false,"allow_missing_pages":false,"force_hm":false,"allow_fuzzy_match":true,"fuzzy_match_min_relevance":0.6,"use_nn_query_prefilter":true}';

export type PerplexityNavigatePayload = {
  query: string;
  cache_key: string;
  provider: 'v2';
  user_identity: {
    lang: string;
    country: string;
    ab_active_tests: string[];
  };
};

export type PerplexityNavigateHit = {
  url?: string;
  domain?: string;
  title?: string;
  snippet?: string;
};

export type PerplexityNavigateApiResult = {
  hits?: PerplexityNavigateHit[];
  search_engine?: string;
  provider?: string;
};

export type PerplexityNavigateHttpResult = {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  result: unknown;
};

function normalizeQuery(query: string): string {
  const value = query.trim();
  if (!value) throw new Error('Enter a search query before running Perplexity navigate search.');
  return value;
}

function normalizeLang(lang?: string): string {
  const value = lang?.trim();
  return value || 'en-US';
}

function normalizeCountry(country?: string): string {
  const value = country?.trim();
  return value ? value.toUpperCase() : 'US';
}

function asNavigateApiResult(result: unknown): PerplexityNavigateApiResult | null {
  if (!result || typeof result !== 'object') return null;
  return result as PerplexityNavigateApiResult;
}

export function buildPerplexityNavigatePayload(
  query: string,
  options: { cacheKey: string; lang?: string; country?: string },
): PerplexityNavigatePayload {
  return {
    query: normalizeQuery(query),
    cache_key: options.cacheKey,
    provider: 'v2',
    user_identity: {
      lang: normalizeLang(options.lang),
      country: normalizeCountry(options.country),
      ab_active_tests: [DEFAULT_PERPLEXITY_AB_TEST],
    },
  };
}

export function buildPerplexityNavigateResponse(
  endpoint: string,
  payload: PerplexityNavigatePayload,
  httpResult: PerplexityNavigateHttpResult,
) {
  const response = { endpoint, payload, ...httpResult };
  const parsed = asNavigateApiResult(httpResult.result);
  const hits = Array.isArray(parsed?.hits) ? parsed.hits : null;

  if (!hits) return response;

  return {
    ...response,
    hit_count: hits.length,
    top_hit: hits[0],
    search_engine: parsed?.search_engine,
    provider: parsed?.provider,
  };
}
