import { z } from 'zod';

export const likePostParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type LikePostParams = z.infer<typeof likePostParamsSchema>;
