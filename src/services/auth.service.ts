import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { AppError } from '../errors/app-error.js';
import type { LoginBody, RegisterBody } from '../schemas/auth.schemas.js';

function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export async function register(input: RegisterBody) {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });

  if (existing) {
    throw new AppError(409, 'CONFLICT', 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const token = generateSessionToken();

  const [user] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      password: passwordHash,
      token,
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
    });

  return {
    token,
    user,
  };
}

export async function login(input: LoginBody) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password);

  if (!passwordMatches) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
  }

  const token = generateSessionToken();

  await db.update(users).set({ token }).where(eq(users.id, user.id));

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  };
}
