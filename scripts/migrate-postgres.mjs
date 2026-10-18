import {readFile} from 'node:fs/promises';
import {neon} from '@neondatabase/serverless';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL missing');
const sql=neon(process.env.DATABASE_URL);const schema=await readFile(new URL('../db/postgres.sql',import.meta.url),'utf8');
await sql.transaction(schema.split(';').map(s=>s.trim()).filter(Boolean).map(s=>sql.query(s)));console.log('PostgreSQL schema ready; no existing records deleted');
