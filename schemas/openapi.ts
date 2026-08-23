import { z } from 'zod';

export const BookCreateSchema = z.object({
  user_id: z.number(),
  book_title: z.string(),
  status: z.string(),
  book_page: z.number()
});

export const BookResponseSchema = z.object({
  book_id: z.number(),
  book_title: z.string()
});

export const HTTPValidationErrorSchema = z.object({
  detail: z.array(ValidationErrorSchema).optional()
});

export const ProgressResponseSchema = z.object({
  book_id: z.number(),
  progress: z.number(),
  reading_history: z.union([z.object({
    
  }), z.array(z.unknown()), z.unknown()]).optional()
});

export const UserCreateSchema = z.object({
  username: z.string(),
  user_mail_address: z.union([z.string(), z.unknown()]).optional()
});

export const UserNameUpdateSchema = z.object({
  username: z.string()
});

export const UserResponseSchema = z.object({
  user_id: z.number(),
  username: z.string(),
  user_mail_address: z.union([z.string(), z.unknown()]).optional()
});

export const ValidationErrorSchema = z.object({
  loc: z.array(z.union([z.string(), z.number()])),
  msg: z.string(),
  type: z.string(),
  input: z.unknown().optional(),
  ctx: z.object({
    
  }).optional()
});