import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import type {
  CreateUserData,
  UserPublic,
  UserRecord,
  UsersRepository,
} from './users.repository.js';

export class DrizzleUsersRepository implements UsersRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    return user ?? null;
  }

  async create(data: CreateUserData): Promise<UserPublic> {
    const [user] = await db
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        password: data.password,
        token: data.token,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
      });

    return user;
  }

  async updateToken(userId: number, token: string): Promise<void> {
    await db.update(users).set({ token }).where(eq(users.id, userId));
  }
}
