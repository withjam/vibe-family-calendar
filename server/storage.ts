import { users, events, calendarSources, type User, type InsertUser, type Event, type InsertEvent, type UpdateEvent, type CalendarSource, type InsertCalendarSource, type UpdateCalendarSource } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, or, ilike } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Event methods
  getAllEvents(): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  getEventsByDateRange(startDate: Date, endDate: Date): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, event: UpdateEvent): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<boolean>;
  searchEvents(query: string): Promise<Event[]>;
  bulkCreateEvents(events: InsertEvent[]): Promise<Event[]>;
  deleteEventsBySource(sourceCalendar: string): Promise<boolean>;
  
  // Calendar source methods
  getAllCalendarSources(): Promise<CalendarSource[]>;
  getCalendarSource(id: number): Promise<CalendarSource | undefined>;
  getCalendarSourceByName(name: string): Promise<CalendarSource | undefined>;
  createCalendarSource(source: InsertCalendarSource): Promise<CalendarSource>;
  updateCalendarSource(id: number, source: UpdateCalendarSource): Promise<CalendarSource | undefined>;
  deleteCalendarSource(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Event methods
  async getAllEvents(): Promise<Event[]> {
    return await db.select().from(events);
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event || undefined;
  }

  async getEventsByDateRange(startDate: Date, endDate: Date): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .where(
        and(
          lte(events.startTime, endDate),
          or(
            gte(events.endTime, startDate),
            gte(events.startTime, startDate) // For events without end time
          )
        )
      );
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db
      .insert(events)
      .values(insertEvent)
      .returning();
    return event;
  }

  async updateEvent(id: number, updateEvent: UpdateEvent): Promise<Event | undefined> {
    const [event] = await db
      .update(events)
      .set(updateEvent)
      .where(eq(events.id, id))
      .returning();
    return event || undefined;
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, id));
    return result.rowCount > 0;
  }

  async searchEvents(query: string): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .where(
        or(
          ilike(events.title, `%${query}%`),
          ilike(events.description, `%${query}%`)
        )
      );
  }

  async bulkCreateEvents(insertEvents: InsertEvent[]): Promise<Event[]> {
    if (insertEvents.length === 0) return [];
    
    const createdEvents = await db
      .insert(events)
      .values(insertEvents)
      .returning();
    return createdEvents;
  }

  async deleteEventsBySource(sourceCalendar: string): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.sourceCalendar, sourceCalendar));
    return result.rowCount > 0;
  }

  // Calendar source methods
  async getAllCalendarSources(): Promise<CalendarSource[]> {
    return await db.select().from(calendarSources);
  }

  async getCalendarSource(id: number): Promise<CalendarSource | undefined> {
    const [source] = await db.select().from(calendarSources).where(eq(calendarSources.id, id));
    return source || undefined;
  }

  async getCalendarSourceByName(name: string): Promise<CalendarSource | undefined> {
    const [source] = await db.select().from(calendarSources).where(eq(calendarSources.name, name));
    return source || undefined;
  }

  async createCalendarSource(insertSource: InsertCalendarSource): Promise<CalendarSource> {
    const [source] = await db
      .insert(calendarSources)
      .values(insertSource)
      .returning();
    return source;
  }

  async updateCalendarSource(id: number, updateSource: UpdateCalendarSource): Promise<CalendarSource | undefined> {
    const [source] = await db
      .update(calendarSources)
      .set(updateSource)
      .where(eq(calendarSources.id, id))
      .returning();
    return source || undefined;
  }

  async deleteCalendarSource(id: number): Promise<boolean> {
    const result = await db.delete(calendarSources).where(eq(calendarSources.id, id));
    return result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();