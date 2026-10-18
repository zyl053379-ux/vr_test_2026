CREATE TABLE `panel_slots` (
	`label` text PRIMARY KEY NOT NULL,
	`expert_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `panel_slots_expert_id_unique` ON `panel_slots` (`expert_id`);