import { describe, expect, test } from 'bun:test';
import { buildRawRequests } from '../src/capture';

describe('buildRawRequests', () => {
  test('attaches request bodies captured from page requests', () => {
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
      new Map([
        ['https://www.perplexity.ai/rest/autosuggest/list-autosuggest', JSON.stringify({ query: 'OpenAI', version: '2.18', source: 'default' })],
      ]),
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].request_body).toBe(JSON.stringify({ query: 'OpenAI', version: '2.18', source: 'default' }));
  });
});
