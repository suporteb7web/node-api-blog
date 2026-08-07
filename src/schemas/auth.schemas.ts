import { z } from 'zod';

export const registerBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().toLowerCase(),
  password: z.string().min(6),
});

export const loginBodySchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(6),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
