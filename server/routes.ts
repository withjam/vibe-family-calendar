import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, updateEventSchema, insertCalendarSourceSchema, updateCalendarSourceSchema } from "@shared/schema";
import { calendarSyncService } from "./calendar-sync";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all events
  app.get("/api/events", async (req, res) => {
    try {
      const events = await storage.getAllEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // Get events by date range
  app.get("/api/events/range", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "Start date and end date are required" });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      const events = await storage.getEventsByDateRange(start, end);
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events by date range" });
    }
  });

  // Get single event
  app.get("/api/events/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }

      const event = await storage.getEvent(id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // Create new event
  app.post("/api/events", async (req, res) => {
    try {
      const validatedData = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(validatedData);
      
      // Note: Events created in imported calendars are stored locally only
      // Google Calendar and other external calendars don't support write-back via iCal URLs
      // This is a limitation of read-only iCal feeds - they don't accept new events
      // To add events to Google Calendar, users would need OAuth integration
      
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  // Update event
  app.patch("/api/events/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }

      const validatedData = updateEventSchema.parse(req.body);
      const event = await storage.updateEvent(id, validatedData);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  // Delete event
  app.delete("/api/events/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }

      const deleted = await storage.deleteEvent(id);
      if (!deleted) {
        return res.status(404).json({ message: "Event not found" });
      }

      res.json({ message: "Event deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Search events
  app.get("/api/events/search/:query", async (req, res) => {
    try {
      const { query } = req.params;
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ message: "Search query is required" });
      }

      const events = await storage.searchEvents(query);
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to search events" });
    }
  });

  // Calendar sources routes
  app.get("/api/calendar-sources", async (req, res) => {
    try {
      const sources = await storage.getAllCalendarSources();
      res.json(sources);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch calendar sources" });
    }
  });

  app.post("/api/calendar-sources", async (req, res) => {
    try {
      const validatedData = insertCalendarSourceSchema.parse(req.body);
      const source = await storage.createCalendarSource(validatedData);
      res.status(201).json(source);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid calendar source data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create calendar source" });
    }
  });

  app.patch("/api/calendar-sources/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid calendar source ID" });
      }

      const validatedData = updateCalendarSourceSchema.parse(req.body);
      const source = await storage.updateCalendarSource(id, validatedData);
      
      if (!source) {
        return res.status(404).json({ message: "Calendar source not found" });
      }

      res.json(source);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid calendar source data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update calendar source" });
    }
  });

  app.delete("/api/calendar-sources/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid calendar source ID" });
      }

      // Get the source to know what events to clean up
      const source = await storage.getCalendarSource(id);
      if (!source) {
        return res.status(404).json({ message: "Calendar source not found" });
      }

      // Delete all events from this source
      await storage.deleteEventsBySource(source.name);
      
      // Delete the source itself
      const deleted = await storage.deleteCalendarSource(id);
      if (!deleted) {
        return res.status(404).json({ message: "Calendar source not found" });
      }

      res.json({ message: "Calendar source and associated events deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete calendar source" });
    }
  });

  // Sync specific calendar
  app.post("/api/calendar-sources/:id/sync", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid calendar source ID" });
      }

      const source = await storage.getCalendarSource(id);
      if (!source) {
        return res.status(404).json({ message: "Calendar source not found" });
      }

      if (!source.isActive) {
        return res.status(400).json({ message: "Calendar source is not active" });
      }

      // Delete existing events from this source
      await storage.deleteEventsBySource(source.name);

      // Sync new events
      const events = await calendarSyncService.syncCalendar(source);
      const createdEvents = await storage.bulkCreateEvents(events);

      // Update last synced time
      await storage.updateCalendarSource(id, { 
        lastSynced: new Date() 
      });

      res.json({ 
        message: `Successfully synced ${createdEvents.length} events from ${source.name}`,
        eventsCount: createdEvents.length 
      });
    } catch (error) {
      console.error("Error syncing calendar:", error);
      res.status(500).json({ 
        message: "Failed to sync calendar", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Sync all active calendars
  app.post("/api/calendar-sources/sync-all", async (req, res) => {
    try {
      const sources = await storage.getAllCalendarSources();
      const activeSources = sources.filter(source => source.isActive);
      
      let totalEvents = 0;
      const results = [];

      for (const source of activeSources) {
        try {
          // Delete existing events from this source
          await storage.deleteEventsBySource(source.name);

          // Sync new events
          const events = await calendarSyncService.syncCalendar(source);
          const createdEvents = await storage.bulkCreateEvents(events);
          
          // Update last synced time
          await storage.updateCalendarSource(source.id, { 
            lastSynced: new Date() 
          });

          totalEvents += createdEvents.length;
          results.push({
            source: source.name,
            eventsCount: createdEvents.length,
            success: true
          });
        } catch (error) {
          console.error(`Error syncing ${source.name}:`, error);
          results.push({
            source: source.name,
            eventsCount: 0,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }

      res.json({ 
        message: `Sync completed for ${activeSources.length} calendars`,
        totalEvents,
        results 
      });
    } catch (error) {
      console.error("Error syncing all calendars:", error);
      res.status(500).json({ message: "Failed to sync calendars" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
