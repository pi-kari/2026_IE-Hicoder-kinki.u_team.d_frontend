import { z } from "zod";

export const BookCreateSchema = z.object({
	user_id: z.number(),
	book_title: z.string(),
	status: z.string(),
	book_page: z.number(),
});

export const BookResponseSchema = z.object({
	book_id: z.number(),
	book_title: z.string(),
});

export const ValidationErrorSchema = z.object({
	loc: z.array(z.union([z.string(), z.number()])),
	msg: z.string(),
	type: z.string(),
	input: z.unknown().optional(),
	ctx: z.object({}).optional(),
});

export const HTTPValidationErrorSchema = z.object({
	detail: z.array(ValidationErrorSchema).optional(),
});

export const ProgressResponseSchema = z.object({
	book_id: z.number(),
	reading_history: z.array(z.string()),
	progress: z.number(),
	tree_ratio: z.number(),
	tree_state: z.number(),
});

export const ProgressUpdateSchema = z.object({
	book_id: z.number(),
	pages_read: z.number(),
});

export const ResponseTreeStateSchema = z.object({
	book_id: z.number(),
	tree_state: z.number(),
});

export const UserCreateSchema = z.object({
	username: z.string(),
	user_mail_address: z.union([z.string(), z.unknown()]).optional(),
});

export const UserNameUpdateSchema = z.object({
	username: z.string(),
});

export const UserResponseSchema = z.object({
	user_id: z.number(),
	username: z.string(),
	user_mail_address: z.union([z.string(), z.unknown()]).optional(),
});
