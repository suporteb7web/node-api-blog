import express, { Router } from 'express';
import { stripeWebhookController } from '../controllers/webhook.controller.js';

export const webhookRouter = Router();

webhookRouter.post(
  '/api/webhook/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookController,
);
