import { readFile, mkdir } from 'node:fs/promises';
export async function database(options = {}) {
  if (options.embedded || process.env.DATABASE_DRIVER === 'pglite') {
    if (process.env.NODE_ENV === 'production') throw new Error('Embedded database is development-only. Use DATABASE_URL.');
    const { PGlite } = await import('@electric-sql/pglite');
    const path = options.path ?? process.env.PGLITE_PATH ?? 'memory://';
    if(path !== 'memory://') await mkdir(path,{recursive:true});
    const db = new PGlite(path);
    await db.waitReady;
    return { query: (q,p) => db.query(q,p), transaction: fn => db.transaction(fn),
      migrate: async () => db.exec(await readFile(new URL('./schema.sql', import.meta.url),'utf8')), close: () => db.close() };
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. See .env.example.');
  const { Pool, types } = await import('pg');
  // Keep business dates as dates; never shift them through a server timezone.
  types.setTypeParser(1082, value => value);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  return { query: (q,p) => pool.query(q,p), transaction: async fn => {
    const c = await pool.connect();
    try { await c.query('BEGIN'); const result = await fn(c); await c.query('COMMIT'); return result; }
    catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }, migrate: async () => pool.query(await readFile(new URL('./schema.sql', import.meta.url),'utf8')), close: () => pool.end() };
}
