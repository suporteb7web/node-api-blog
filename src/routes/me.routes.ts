import { Router } from 'express';
import {
  createCheckoutController,
  getMeController,
  updateAvatarController,
} from '../controllers/me.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { uploadImage } from '../middlewares/upload.js';

export const meRouter = Router();

meRouter.get('/api/me', requireAuth, getMeController);
meRouter.put('/api/me/avatar', requireAuth, uploadImage, updateAvatarController);
meRouter.post('/api/me/checkout', requireAuth, createCheckoutController);
