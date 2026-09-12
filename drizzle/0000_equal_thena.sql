CREATE TABLE "books_list" (
	"book_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"book_title" varchar NOT NULL,
	"status" varchar DEFAULT '積読' NOT NULL,
	"book_pages" integer NOT NULL,
	"total_progress" integer DEFAULT 0 NOT NULL,
	"tree_ratio" integer DEFAULT 0 NOT NULL,
	"tree_state" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress" (
	"progress_id" uuid PRIMARY KEY NOT NULL,
	"book_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"username" varchar NOT NULL,
	"user_mail_address" varchar,
	"number_of_books" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "books_list" ADD CONSTRAINT "books_list_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_book_id_books_list_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books_list"("book_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_books_list_user_id" ON "books_list" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_books_list_book_title" ON "books_list" USING btree ("book_title");--> statement-breakpoint
CREATE INDEX "ix_progress_book_id" ON "progress" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "ix_progress_user_id" ON "progress" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ix_users_user_mail_address" ON "users" USING btree ("user_mail_address");