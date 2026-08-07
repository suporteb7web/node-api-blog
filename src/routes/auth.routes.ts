import { Router } from 'express';
import { loginController, registerController } from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.post('/api/auth/register', registerController);
authRouter.post('/api/auth/login', loginController);
