export const DEFAULT_BASE_URL = "http://localhost:6969";
export const DEFAULT_CHROME_PROFILE = "Default";

export function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function shouldAttemptYoloAuth(enabled: boolean, url?: string): boolean {
  if (!enabled || !url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function buildYoloAuthOptions(options: {
  chromeProfile?: string;
  firefoxProfile?: string;
}): Record<string, string> {
  const payload: Record<string, string> = {
    chrome_profile: options.chromeProfile || DEFAULT_CHROME_PROFILE,
  };

  if (options.firefoxProfile) {
    payload.firefox_profile = options.firefoxProfile;
  }

  return payload;
}
