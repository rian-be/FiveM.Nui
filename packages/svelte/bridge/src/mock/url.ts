/**
 * Checks whether a given URL matches a targeted FiveM NUI endpoint:
 * `https://<resourceName>/<callback>` or `https://cfx-nui-<resourceName>/<callback>`.
 * Rejects localhost, IP addresses, ports, and external domains.
 */
export function isNuiUrl(url: string, targetResource: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.port) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.includes('.')) {
      return false;
    }

    const expected = targetResource.toLowerCase();
    return host === expected || host === `cfx-nui-${expected}`;
  } catch {
    return false;
  }
}

/**
 * Extracts and safely decodes the resource name and callback endpoint from a NUI URL.
 */
export function parseNuiUrl(url: string): { resourceName: string; callbackName: string } {
  const urlParts = url.replace('https://', '').split('/');
  const resourceName = urlParts[0];
  let callbackName = urlParts[1] ?? 'nui';
  try {
    callbackName = decodeURIComponent(callbackName);
  } catch {
    // malformed URI sequence, keep raw callbackName
  }
  return { resourceName, callbackName };
}
