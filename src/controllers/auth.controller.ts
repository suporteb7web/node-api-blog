import type { Request, Response } from 'express';
import { toAuthResponseDto } from '../dtos/auth/auth-response.dto.js';
import { DrizzleUsersRepository } from '../repositories/drizzle-users.repository.js';
import { loginBodySchema, registerBodySchema } from '../schemas/auth.schemas.js';
import { LoginUseCase } from '../use-cases/auth/login.js';
import { RegisterUseCase } from '../use-cases/auth/register.js';
import { validate } from '../utils/validate.js';

const usersRepository = new DrizzleUsersRepository();

const register = new RegisterUseCase(usersRepository);
const login = new LoginUseCase(usersRepository);

export async function registerController(req: Request, res: Response): Promise<void> {
  const body = validate(registerBodySchema, req.body);
  const { token, user } = await register.execute({ data: body });

  res.status(201).json(toAuthResponseDto(token, user));
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const body = validate(loginBodySchema, req.body);
  const { token, user } = await login.execute({ data: body });

  res.status(200).json(toAuthResponseDto(token, user));
}
