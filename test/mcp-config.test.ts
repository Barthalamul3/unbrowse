import { describe, expect, test } from 'bun:test';
import { buildYoloAuthOptions, normalizeBaseUrl, shouldAttemptYoloAuth } from '../src/mcp/config';

describe('mcp yolo config helpers', () => {
  test('normalizes base url by trimming trailing slash', () => {
    expect(normalizeBaseUrl('http://localhost:6969/')).toBe('http://localhost:6969');
  });

  test('attempts yolo auth only for http urls when enabled', () => {
    expect(shouldAttemptYoloAuth(true, 'https://example.com')).toBe(true);
    expect(shouldAttemptYoloAuth(false, 'https://example.com')).toBe(false);
    expect(shouldAttemptYoloAuth(true, 'not-a-url')).toBe(false);
  });

  test('builds default chrome-profile yolo auth options', () => {
    expect(buildYoloAuthOptions({})).toEqual({ chrome_profile: 'Default' });
  });

  test('prefers explicit chrome profile over default', () => {
    expect(buildYoloAuthOptions({ chromeProfile: 'Profile 3' })).toEqual({ chrome_profile: 'Profile 3' });
  });

  test('passes firefox profile when requested', () => {
    expect(buildYoloAuthOptions({ firefoxProfile: 'abcd.default-release' })).toEqual({ chrome_profile: 'Default', firefox_profile: 'abcd.default-release' });
  });
});
