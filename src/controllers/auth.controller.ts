import type { Request, Response } from 'express';
import { DrizzleUsersRepository } from '../repositories/drizzle-users.repository.js';
import { loginBodySchema, registerBodySchema } from '../schemas/auth.schemas.js';
import { AuthService } from '../services/auth.service.js';
import { validate } from '../utils/validate.js';

const authService = new AuthService(new DrizzleUsersRepository());

function toAuthResponse(token: string, user: { id: number; name: string; email: string }) {
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  };
}

export async function registerController(req: Request, res: Response): Promise<void> {
  const body = validate(registerBodySchema, req.body);
  const { token, user } = await authService.register(body);

  res.status(201).json(toAuthResponse(token, user));
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const body = validate(loginBodySchema, req.body);
  const { token, user } = await authService.login(body);

  res.status(200).json(toAuthResponse(token, user));
}
