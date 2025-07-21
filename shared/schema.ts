import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }),
  location: text("location"),
  category: text("category").notNull().default("personal"),
  isAllDay: boolean("is_all_day").notNull().default(false),
  reminders: text("reminders").array(),
  sourceCalendar: text("source_calendar"), // Track which calendar this event came from
  externalId: text("external_id"), // Store external calendar event ID for sync
});

export const calendarSources = pgTable("calendar_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull(), // 'ical', 'google', 'webcal'
  isActive: boolean("is_active").notNull().default(true),
  lastSynced: timestamp("last_synced", { withTimezone: true }),
  syncInterval: integer("sync_interval").notNull().default(3600), // in seconds
  color: text("color").default("#3b82f6"), // Calendar display color
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
}).extend({
  startTime: z.union([
    z.string().transform((val) => new Date(val)),
    z.date()
  ]),
  endTime: z.union([
    z.string().transform((val) => new Date(val)),
    z.date()
  ]).nullable().optional(),
  sourceCalendar: z.string().nullable().optional(),
  externalId: z.string().nullable().optional(),
});

export const updateEventSchema = insertEventSchema.partial();

export const insertCalendarSourceSchema = createInsertSchema(calendarSources).omit({
  id: true,
  lastSynced: true,
});

export const updateCalendarSourceSchema = insertCalendarSourceSchema.partial().extend({
  lastSynced: z.date().nullable().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type UpdateEvent = z.infer<typeof updateEventSchema>;
export type Event = typeof events.$inferSelect;
export type CalendarSource = typeof calendarSources.$inferSelect;
export type InsertCalendarSource = z.infer<typeof insertCalendarSourceSchema>;
export type UpdateCalendarSource = z.infer<typeof updateCalendarSourceSchema>;
