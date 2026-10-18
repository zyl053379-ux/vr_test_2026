CREATE TABLE `experts` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`label` text NOT NULL,
	`sequence` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experts_token_hash_unique` ON `experts` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `experts_label_unique` ON `experts` (`label`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`expert_id` text NOT NULL,
	`material` text NOT NULL,
	`scores` text NOT NULL,
	`comments` text NOT NULL,
	`extra` text NOT NULL,
	`submitted_at` text NOT NULL,
	`watched` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_expert_material` ON `reviews` (`expert_id`,`material`);