import { z } from 'zod';

export const createReplyParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createReplyBodySchema = z
  .object({
    content: z.string().trim().min(1),
  })
  .strict();

export const deleteReplyParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  replyId: z.coerce.number().int().positive(),
});

export type CreateReplyParams = z.infer<typeof createReplyParamsSchema>;
export type CreateReplyBody = z.infer<typeof createReplyBodySchema>;
export type DeleteReplyParams = z.infer<typeof deleteReplyParamsSchema>;
