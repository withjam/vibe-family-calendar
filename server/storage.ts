import { users, events, calendarSources, type User, type InsertUser, type Event, type InsertEvent, type UpdateEvent, type CalendarSource, type InsertCalendarSource, type UpdateCalendarSource } from "@shared/schema";

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
  createCalendarSource(source: InsertCalendarSource): Promise<CalendarSource>;
  updateCalendarSource(id: number, source: UpdateCalendarSource): Promise<CalendarSource | undefined>;
  deleteCalendarSource(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private events: Map<number, Event>;
  private calendarSources: Map<number, CalendarSource>;
  private currentUserId: number;
  private currentEventId: number;
  private currentCalendarSourceId: number;

  constructor() {
    this.users = new Map();
    this.events = new Map();
    this.calendarSources = new Map();
    this.currentUserId = 1;
    this.currentEventId = 1;
    this.currentCalendarSourceId = 1;
    
    // Add some initial events for demonstration
    this.initializeEvents();
  }

  private initializeEvents() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const sampleEvents: InsertEvent[] = [
      {
        title: "Team Meeting",
        description: "Weekly team sync and project updates",
        startTime: new Date(currentYear, currentMonth, 1, 9, 0),
        endTime: new Date(currentYear, currentMonth, 1, 10, 0),
        location: "Conference Room A",
        category: "work",
        isAllDay: false,
        reminders: ["30 minutes before"],
      },
      {
        title: "Doctor Appointment",
        description: "Annual checkup with Dr. Smith",
        startTime: new Date(currentYear, currentMonth, 2, 14, 30),
        endTime: new Date(currentYear, currentMonth, 2, 15, 30),
        location: "Downtown Medical Center",
        category: "health",
        isAllDay: false,
        reminders: ["1 hour before"],
      },
      {
        title: "Sarah's Soccer Practice",
        description: "Weekly soccer practice for Sarah's team. Remember to bring water bottle, cleats, and shin guards.",
        startTime: new Date(currentYear, currentMonth, 2, 16, 0),
        endTime: new Date(currentYear, currentMonth, 2, 17, 30),
        location: "Riverside Park Soccer Fields",
        category: "sports",
        isAllDay: false,
        reminders: ["30 minutes before"],
      },
      {
        title: "Book Club",
        description: "Monthly book discussion meeting",
        startTime: new Date(currentYear, currentMonth, 4, 19, 0),
        endTime: new Date(currentYear, currentMonth, 4, 21, 0),
        location: "Local Library",
        category: "personal",
        isAllDay: false,
        reminders: [],
      },
      {
        title: "Family BBQ",
        description: "Weekend family gathering with BBQ",
        startTime: new Date(currentYear, currentMonth, 11, 12, 0),
        endTime: new Date(currentYear, currentMonth, 11, 16, 0),
        location: "Backyard",
        category: "family",
        isAllDay: false,
        reminders: ["1 day before"],
      },
    ];

    sampleEvents.forEach(event => {
      this.createEvent(event);
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllEvents(): Promise<Event[]> {
    return Array.from(this.events.values()).sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }

  async getEvent(id: number): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getEventsByDateRange(startDate: Date, endDate: Date): Promise<Event[]> {
    const events = Array.from(this.events.values());
    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate >= startDate && eventDate <= endDate;
    }).sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = this.currentEventId++;
    const event: Event = { 
      ...insertEvent, 
      id,
      description: insertEvent.description || null,
      location: insertEvent.location || null,
      endTime: insertEvent.endTime || null,
      category: insertEvent.category || "personal",
      isAllDay: insertEvent.isAllDay || false,
      reminders: insertEvent.reminders || null,
      sourceCalendar: insertEvent.sourceCalendar || null,
      externalId: insertEvent.externalId || null
    };
    this.events.set(id, event);
    return event;
  }

  async updateEvent(id: number, updateEvent: UpdateEvent): Promise<Event | undefined> {
    const existingEvent = this.events.get(id);
    if (!existingEvent) {
      return undefined;
    }
    
    const updatedEvent: Event = { ...existingEvent, ...updateEvent };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: number): Promise<boolean> {
    return this.events.delete(id);
  }

  async searchEvents(query: string): Promise<Event[]> {
    const lowerQuery = query.toLowerCase();
    const events = Array.from(this.events.values());
    
    return events.filter(event => 
      event.title.toLowerCase().includes(lowerQuery) ||
      (event.description && event.description.toLowerCase().includes(lowerQuery)) ||
      (event.location && event.location.toLowerCase().includes(lowerQuery))
    ).sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }

  async bulkCreateEvents(events: InsertEvent[]): Promise<Event[]> {
    const createdEvents: Event[] = [];
    for (const insertEvent of events) {
      const event = await this.createEvent(insertEvent);
      createdEvents.push(event);
    }
    return createdEvents;
  }

  async deleteEventsBySource(sourceCalendar: string): Promise<boolean> {
    const eventsToDelete = Array.from(this.events.entries())
      .filter(([_, event]) => event.sourceCalendar === sourceCalendar)
      .map(([id, _]) => id);
    
    let deletedAny = false;
    for (const id of eventsToDelete) {
      if (this.events.delete(id)) {
        deletedAny = true;
      }
    }
    return deletedAny;
  }

  // Calendar source methods
  async getAllCalendarSources(): Promise<CalendarSource[]> {
    return Array.from(this.calendarSources.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getCalendarSource(id: number): Promise<CalendarSource | undefined> {
    return this.calendarSources.get(id);
  }

  async createCalendarSource(insertSource: InsertCalendarSource): Promise<CalendarSource> {
    const id = this.currentCalendarSourceId++;
    const source: CalendarSource = {
      ...insertSource,
      id,
      color: insertSource.color || "#3b82f6",
      isActive: insertSource.isActive ?? true,
      syncInterval: insertSource.syncInterval || 3600,
      lastSynced: null,
    };
    this.calendarSources.set(id, source);
    return source;
  }

  async updateCalendarSource(id: number, updateSource: UpdateCalendarSource): Promise<CalendarSource | undefined> {
    const existingSource = this.calendarSources.get(id);
    if (!existingSource) {
      return undefined;
    }
    
    const updatedSource: CalendarSource = { ...existingSource, ...updateSource };
    this.calendarSources.set(id, updatedSource);
    return updatedSource;
  }

  async deleteCalendarSource(id: number): Promise<boolean> {
    return this.calendarSources.delete(id);
  }
}

export const storage = new MemStorage();
