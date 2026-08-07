import type { Request, Response } from 'express';
import { loginBodySchema, registerBodySchema } from '../schemas/auth.schemas.js';
import * as authService from '../services/auth.service.js';
import { validate } from '../utils/validate.js';

export async function registerController(req: Request, res: Response): Promise<void> {
  const body = validate(registerBodySchema, req.body);
  const result = await authService.register(body);

  res.status(201).json(result);
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const body = validate(loginBodySchema, req.body);
  const result = await authService.login(body);

  res.status(200).json(result);
}
