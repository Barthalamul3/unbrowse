import { describe, expect, test } from 'bun:test';
import { extractEndpoints } from '../src/reverse-engineer';
import type { RawRequest } from '../src/capture';

describe('extractEndpoints request bodies', () => {
  test('preserves parsed POST JSON bodies for unsafe endpoints', () => {
    const requests: RawRequest[] = [
      {
        url: 'https://www.perplexity.ai/rest/autosuggest/list-autosuggest',
        method: 'POST',
        request_headers: { 'content-type': 'application/json' },
        request_body: JSON.stringify({ query: 'OpenAI', version: '2.18', source: 'default' }),
        response_status: 200,
        response_headers: { 'content-type': 'application/json' },
        response_body: JSON.stringify({ results: [{ text: 'OpenAI' }] }),
        timestamp: new Date('2026-03-06T00:00:00Z').toISOString(),
      },
    ];

    const endpoints = extractEndpoints(requests, [], { pageUrl: 'https://www.perplexity.ai/' });

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].body).toEqual({ query: 'OpenAI', version: '2.18', source: 'default' });
  });
});
