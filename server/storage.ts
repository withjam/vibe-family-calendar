import { users, events, type User, type InsertUser, type Event, type InsertEvent, type UpdateEvent } from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private events: Map<number, Event>;
  private currentUserId: number;
  private currentEventId: number;

  constructor() {
    this.users = new Map();
    this.events = new Map();
    this.currentUserId = 1;
    this.currentEventId = 1;
    
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
    const event: Event = { ...insertEvent, id };
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
}

export const storage = new MemStorage();
