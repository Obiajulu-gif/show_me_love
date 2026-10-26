import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

declare global {
  var __smlSql: Sql | undefined;
}

/**
 * The business database: Neon in production (pooled URL with sslmode=require),
 * any Postgres or a local PGlite socket in development. Lazy, so builds and
 * pages that never touch the database need no DATABASE_URL.
 */
export function db(): Sql {
  if (!globalThis.__smlSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new DbMissing();
    // prepare:false is required by transaction poolers (Neon / PgBouncer). The
    // local PGlite socket server interleaves parallel connections badly, so a
    // local database gets one connection (queries just queue).
    const local = /@(127\.0\.0\.1|localhost):/.test(url);
    globalThis.__smlSql = postgres(url, { prepare: false, max: local ? 1 : 3, idle_timeout: 20 });
  }
  return globalThis.__smlSql;
}

export class DbMissing extends Error {
  constructor() {
    super("DATABASE_URL is not set: business accounts need a database (see README).");
  }
}

/** Tests point the module at their own database. */
export function setTestDb(sql: Sql | undefined) {
  globalThis.__smlSql = sql;
}
