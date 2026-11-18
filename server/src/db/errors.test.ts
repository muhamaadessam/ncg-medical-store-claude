import { describe, expect, it } from 'vitest';
import { DB_ERRNO, dbErrno, isDbError } from './errors';

describe('db errors', () => {
  it('reads errno directly or from a wrapped cause', () => {
    expect(dbErrno({ errno: 1062 })).toBe(1062);
    expect(dbErrno(new Error('wrapped', { cause: { errno: 4025 } }))).toBe(4025);
    expect(dbErrno(new Error('plain'))).toBeUndefined();
    expect(dbErrno(null)).toBeUndefined();
  });

  it('matches MySQL and MariaDB variants', () => {
    expect(isDbError({ errno: 3819 }, DB_ERRNO.CHECK_VIOLATION)).toBe(true);
    expect(isDbError({ errno: 4025 }, DB_ERRNO.CHECK_VIOLATION)).toBe(true);
    expect(isDbError({ errno: 1451 }, DB_ERRNO.ROW_IS_REFERENCED)).toBe(true);
    expect(isDbError({ errno: 1062 }, DB_ERRNO.DUP_ENTRY)).toBe(true);
    expect(isDbError({ errno: 1062 }, DB_ERRNO.ROW_IS_REFERENCED)).toBe(false);
  });
});
