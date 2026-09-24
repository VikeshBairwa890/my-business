import { database } from './db.mjs';
const db = await database();
try { await db.migrate(); console.log('Schema migration complete.'); } finally { await db.close(); }
