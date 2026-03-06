import { describe, expect, test } from 'bun:test';
import {
  buildPerplexityNavigatePayload,
  buildPerplexityNavigateResponse,
  DEFAULT_PERPLEXITY_AB_TEST,
} from '../src/mcp/perplexity';

describe('Perplexity navigate response', () => {
  test('adds top-hit metadata for successful navigate responses', () => {
    const payload = buildPerplexityNavigatePayload('  OpenAI  ', { cacheKey: 'abc-123', country: 'us' });
    const response = buildPerplexityNavigateResponse(
      'https://suggest.perplexity.ai/search/v3/navigate',
      payload,
      {
        status: 200,
        ok: true,
        headers: { 'content-type': 'application/json' },
        result: {
          hits: [
            {
              url: 'https://openai.com',
              domain: 'openai.com',
              title: 'OpenAI',
              snippet: 'AI research and products',
            },
          ],
          search_engine: 'navigate_clf',
          provider: 'v2',
        },
      },
    );

    expect(payload).toEqual({
      query: 'OpenAI',
      cache_key: 'abc-123',
      provider: 'v2',
      user_identity: {
        lang: 'en-US',
        country: 'US',
        ab_active_tests: [DEFAULT_PERPLEXITY_AB_TEST],
      },
    });
    expect(response.hit_count).toBe(1);
    expect(response.top_hit).toEqual({
      url: 'https://openai.com',
      domain: 'openai.com',
      title: 'OpenAI',
      snippet: 'AI research and products',
    });
    expect(response.search_engine).toBe('navigate_clf');
  });

  test('omits top-hit metadata when the response is not a hits payload', () => {
    const payload = buildPerplexityNavigatePayload('OpenAI', { cacheKey: 'abc-123' });
    const response = buildPerplexityNavigateResponse(
      'https://suggest.perplexity.ai/search/v3/navigate',
      payload,
      {
        status: 429,
        ok: false,
        headers: { 'content-type': 'application/json' },
        result: { error: 'rate_limited' },
      },
    );

    expect(response.hit_count).toBeUndefined();
    expect(response.top_hit).toBeUndefined();
    expect(response.result).toEqual({ error: 'rate_limited' });
  });
});
