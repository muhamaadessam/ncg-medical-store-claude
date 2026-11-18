import type { ValidationIssue } from '@ncg/shared';
import type { z } from 'zod';
import { HttpError } from './errors';

export function toValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

export function validationError(
  details: ValidationIssue[],
  message = 'Please fix the highlighted fields',
) {
  return new HttpError(400, 'VALIDATION_ERROR', message, details);
}

/** Parse request data with a shared zod schema; throws a 400 with field details on failure. */
export function parseOrThrow<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) throw validationError(toValidationIssues(result.error));
  return result.data;
}
