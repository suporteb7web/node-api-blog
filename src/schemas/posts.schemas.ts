import { z } from 'zod';

export const createPostBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1),
  premium: z.boolean().optional(),
});

export const postIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export const updatePostBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).optional(),
    premium: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => data.title !== undefined || data.content !== undefined || data.premium !== undefined,
    {
      message: 'At least one of title, content or premium must be provided',
    },
  );

export type CreatePostBody = z.infer<typeof createPostBodySchema>;
export type PostIdParams = z.infer<typeof postIdParamsSchema>;
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
export type UpdatePostBody = z.infer<typeof updatePostBodySchema>;
