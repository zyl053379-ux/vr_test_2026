// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const experts = sqliteTable('experts', { id: text('id').primaryKey(), tokenHash: text('token_hash').notNull().unique(), label: text('label').notNull().unique(), sequence: text('sequence').notNull(), createdAt: text('created_at').notNull() });
export const reviews = sqliteTable('reviews', { id: text('id').primaryKey(), expertId: text('expert_id').notNull(), material: text('material').notNull(), scores: text('scores').notNull(), comments: text('comments').notNull(), extra: text('extra').notNull(), submittedAt: text('submitted_at').notNull(), watched: integer('watched').notNull() }, t => [uniqueIndex('review_expert_material').on(t.expertId,t.material)]);
export const profiles = sqliteTable('profiles', {expertId:text('expert_id').primaryKey(),data:text('data').notNull(),updatedAt:text('updated_at').notNull()});
export const panelSlots = sqliteTable('panel_slots', {label:text('label').primaryKey(),expertId:text('expert_id').notNull().unique(),createdAt:text('created_at').notNull()});
export const submissions = sqliteTable('submissions', {expertId:text('expert_id').primaryKey(),submittedAt:text('submitted_at').notNull(),snapshot:text('snapshot').notNull(),isCurrent:integer('is_current').notNull().default(1)});
