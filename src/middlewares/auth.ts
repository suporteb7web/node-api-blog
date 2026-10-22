import { eq } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { AppError } from '../errors/app-error.js';
import type { AuthUser } from '../types/auth.js';

async function authenticateBearer(header: string): Promise<AuthUser> {
  if (!header.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
  }

  const token = header.slice('Bearer '.length).trim();

  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.token, token),
    columns: {
      id: true,
      name: true,
      email: true,
      premium: true,
    },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
  }

  return user;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  if (!header) {
    throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
  }

  req.user = await authenticateBearer(header);
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  if (!header) {
    next();
    return;
  }

  req.user = await authenticateBearer(header);
  next();
}
