CREATE TABLE `submissions` (
	`expert_id` text PRIMARY KEY NOT NULL,
	`submitted_at` text NOT NULL,
	`snapshot` text NOT NULL,
	`is_current` integer DEFAULT 1 NOT NULL
);
