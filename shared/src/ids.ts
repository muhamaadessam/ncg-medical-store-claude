/**
 * UUID check without zod, so the shop's main bundle does not pull in zod. Matches what
 * `z.uuid()` accepts (RFC 9562 versions 1-8, plus the nil and max UUIDs).
 */
const UUID_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|0{8}-0{4}-0{4}-0{4}-0{12}|f{8}-f{4}-f{4}-f{4}-f{12})$/i;

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value);
