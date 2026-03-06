import { describe, expect, test } from 'bun:test';
import { buildRawRequests } from '../src/capture';

describe('buildRawRequests with cdp bodies', () => {
  test('uses cdp-captured body when page request tracking misses it', () => {
    const requests = buildRawRequests(
      [
        {
          url: 'https://www.perplexity.ai/rest/autosuggest/list-autosuggest',
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          timestamp: Date.now(),
          resourceType: 'fetch',
        },
      ],
      new Map([
        ['https://www.perplexity.ai/rest/autosuggest/list-autosuggest', JSON.stringify({ results: [] })],
      ]),
      new Map(),
      new Map([
        ['https://www.perplexity.ai/rest/autosuggest/list-autosuggest', JSON.stringify({ query: 'OpenAI follow up' })],
      ]),
    );

    expect(requests[0].request_body).toBe(JSON.stringify({ query: 'OpenAI follow up' }));
  });
});
