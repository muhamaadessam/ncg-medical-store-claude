/**
 * MySQL / MariaDB server error numbers. Match on `errno`, not `code`: mysql2 names codes after
 * MySQL, so a MariaDB-only errno (e.g. 4025) gets an unrelated MySQL code name.
 */
export const DB_ERRNO = {
  DUP_ENTRY: 1062,
  /** Delete/update of a parent row that is still referenced (FK RESTRICT). */
  ROW_IS_REFERENCED: [1451, 1217],
  /** Insert/update of a child row whose parent does not exist. */
  NO_REFERENCED_ROW: [1452, 1216],
  /** CHECK constraint failed: MySQL 8 = 3819, MariaDB = 4025. */
  CHECK_VIOLATION: [3819, 4025],
} as const;

/** Server errno from a mysql2 error, also when wrapped by drizzle (`cause`). */
export function dbErrno(err: unknown): number | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 3 && typeof current === 'object' && current !== null; depth++) {
    const { errno, cause } = current as { errno?: unknown; cause?: unknown };
    if (typeof errno === 'number') return errno;
    current = cause;
  }
  return undefined;
}

export function isDbError(err: unknown, errno: number | readonly number[]): boolean {
  const actual = dbErrno(err);
  if (actual === undefined) return false;
  return typeof errno === 'number' ? actual === errno : errno.includes(actual);
}
