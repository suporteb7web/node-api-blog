import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error.js';

export function validate<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request data', [
      ...result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    ]);
  }

  return result.data;
}
