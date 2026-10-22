import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';

export async function markUserPremium(userId: number): Promise<void> {
  await db.update(users).set({ premium: true }).where(eq(users.id, userId));
}
