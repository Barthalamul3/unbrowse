import { describe, expect, test } from 'bun:test';
import { buildPerplexityNavigatePayload, DEFAULT_PERPLEXITY_AB_TEST } from '../src/mcp/perplexity';

describe('Perplexity navigate payload', () => {
  test('builds payload with required defaults', () => {
    const payload = buildPerplexityNavigatePayload('OpenAI', { cacheKey: 'abc-123' });

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
  });

  test('allows lang and country overrides', () => {
    const payload = buildPerplexityNavigatePayload('OpenAI', {
      cacheKey: 'abc-123',
      lang: 'en-GB',
      country: 'GB',
    });

    expect(payload.user_identity.lang).toBe('en-GB');
    expect(payload.user_identity.country).toBe('GB');
  });

  test('rejects blank queries after trimming', () => {
    expect(() => buildPerplexityNavigatePayload('   ', { cacheKey: 'abc-123' })).toThrow('Enter a search query before running Perplexity navigate search.');
  });

});
