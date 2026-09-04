import { db, pool } from '../../src/db/index.js';
import { likes, posts, replies, users } from '../../src/db/schema.js';

export async function cleanDatabase(): Promise<void> {
  await db.delete(likes);
  await db.delete(replies);
  await db.delete(posts);
  await db.delete(users);
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
