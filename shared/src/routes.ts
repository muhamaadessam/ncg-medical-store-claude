/**
 * Paths the React app serves (keep in sync with client/src/routes.tsx; a client test checks it).
 * The server answers these with index.html + 200, and every other non-API path with the same
 * index.html (so the React "Page not found" still renders) but HTTP 404, not a soft 404.
 */
export const CLIENT_ROUTE_PATTERNS: readonly RegExp[] = [
  /^\/$/,
  /^\/cart\/?$/,
  /^\/products\/[^/]+\/?$/,
  /^\/admin(?:\/.*)?$/,
];

export function isClientRoute(pathname: string): boolean {
  return CLIENT_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}
