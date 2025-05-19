import { pgTable, serial, varchar, boolean, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const frequencyEnum = pgEnum('subscription_frequency', ["hourly", "daily"]);

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  city: varchar('city', { length: 100 }).notNull(),
  frequency: frequencyEnum('frequency').notNull(),
  confirmed: boolean('confirmed').default(false).notNull(),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()).notNull(),
});

export const tokenTypeEnum = pgEnum('token_type', ["confirmation", "unsubscribe"]);

export const tokens = pgTable('tokens', {
  id: serial('id').primaryKey(),
  subscriptionId: integer('subscription_id').references(() => subscriptions.id, { onDelete: 'cascade' }).notNull(),
  token: varchar('token', { length: 128 }).notNull().unique(),
  type: tokenTypeEnum('type').notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).$onUpdate(() => new Date()).notNull(),
});
