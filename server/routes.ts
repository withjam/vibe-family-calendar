import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, updateEventSchema, insertCalendarSourceSchema, updateCalendarSourceSchema } from "@shared/schema";
import { calendarSyncService } from "./calendar-sync";
import { GoogleOAuthService } from "./google-oauth";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const googleOAuthService = new GoogleOAuthService();
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
      
      // If creating event in an OAuth-enabled calendar, sync to Google Calendar
      if (validatedData.sourceCalendar) {
        const calendarSource = await storage.getCalendarSourceByName(validatedData.sourceCalendar);
        
        if (calendarSource?.hasOAuthCredentials && calendarSource.oauthRefreshToken && calendarSource.googleCalendarId) {
          try {
            googleOAuthService.setCredentials(calendarSource.oauthRefreshToken);
            
            const googleEvent = await googleOAuthService.createEvent(
              calendarSource.googleCalendarId,
              {
                title: validatedData.title,
                description: validatedData.description,
                location: validatedData.location,
                startTime: validatedData.startTime.toISOString(),
                endTime: validatedData.endTime?.toISOString(),
                isAllDay: validatedData.isAllDay,
                reminders: validatedData.reminders
              }
            );
            
            // Store the Google event ID for future updates/deletions
            validatedData.externalId = googleEvent.id;
            
          } catch (oauthError) {
            console.error('Failed to create event in Google Calendar:', oauthError);
            // Continue with local creation even if Google sync fails
          }
        }
      }
      
      const event = await storage.createEvent(validatedData);
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
      
      // Get original event to check if it has external sync
      const originalEvent = await storage.getEvent(id);
      if (!originalEvent) {
        return res.status(404).json({ message: "Event not found" });
      }

      // If updating an OAuth-enabled calendar event, sync to Google Calendar
      if (originalEvent.sourceCalendar && originalEvent.externalId) {
        const calendarSource = await storage.getCalendarSourceByName(originalEvent.sourceCalendar);
        
        if (calendarSource?.hasOAuthCredentials && calendarSource.oauthRefreshToken && calendarSource.googleCalendarId) {
          try {
            googleOAuthService.setCredentials(calendarSource.oauthRefreshToken);
            
            await googleOAuthService.updateEvent(
              calendarSource.googleCalendarId,
              originalEvent.externalId,
              {
                title: validatedData.title || originalEvent.title,
                description: validatedData.description || originalEvent.description,
                location: validatedData.location || originalEvent.location,
                startTime: validatedData.startTime?.toISOString() || originalEvent.startTime.toISOString(),
                endTime: validatedData.endTime?.toISOString() || originalEvent.endTime?.toISOString(),
                isAllDay: validatedData.isAllDay !== undefined ? validatedData.isAllDay : originalEvent.isAllDay,
                reminders: validatedData.reminders || originalEvent.reminders
              }
            );
          } catch (oauthError) {
            console.error('Failed to update event in Google Calendar:', oauthError);
            // Continue with local update even if Google sync fails
          }
        }
      }

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

      // Get event to check if it has external sync
      const event = await storage.getEvent(id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // If deleting an OAuth-enabled calendar event, delete from Google Calendar
      if (event.sourceCalendar && event.externalId) {
        const calendarSource = await storage.getCalendarSourceByName(event.sourceCalendar);
        
        if (calendarSource?.hasOAuthCredentials && calendarSource.oauthRefreshToken && calendarSource.googleCalendarId) {
          try {
            googleOAuthService.setCredentials(calendarSource.oauthRefreshToken);
            await googleOAuthService.deleteEvent(calendarSource.googleCalendarId, event.externalId);
          } catch (oauthError) {
            console.error('Failed to delete event from Google Calendar:', oauthError);
            // Continue with local deletion even if Google sync fails
          }
        }
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

  // Generate OAuth URL for calendar source
  app.post("/api/calendar-sources/:id/oauth-url", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid calendar source ID" });
      }

      const authUrl = googleOAuthService.getAuthUrl(id);
      res.json({ authUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate OAuth URL" });
    }
  });

  // Handle OAuth callback
  app.get("/api/oauth/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.status(400).json({ message: "Missing authorization code or state" });
      }

      const calendarSourceId = parseInt(state as string);
      if (isNaN(calendarSourceId)) {
        return res.status(400).json({ message: "Invalid state parameter" });
      }

      // Exchange code for tokens
      const tokens = await googleOAuthService.exchangeCodeForTokens(code as string);
      
      if (!tokens.refresh_token) {
        throw new Error("No refresh token received. User may need to revoke and re-authorize.");
      }
      
      // Get user's calendars to find the calendar ID
      googleOAuthService.setCredentials(tokens.refresh_token);
      const userCalendars = await googleOAuthService.getUserCalendars();
      const primaryCalendar = userCalendars.find(cal => cal.primary) || userCalendars[0];
      
      if (!primaryCalendar) {
        throw new Error("No calendars found for user");
      }

      // Update calendar source with OAuth credentials
      await storage.updateCalendarSource(calendarSourceId, {
        hasOAuthCredentials: true,
        oauthRefreshToken: tokens.refresh_token, // In production, this should be encrypted
        googleCalendarId: primaryCalendar.id
      });

      // Return a success page that can close the popup and notify the parent window
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>OAuth Success</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-align: center; 
                padding: 50px;
                background: #f8f9fa;
              }
              .success {
                background: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
                padding: 20px;
                border-radius: 8px;
                margin: 20px auto;
                max-width: 400px;
              }
            </style>
          </head>
          <body>
            <div class="success">
              <h2>✅ Authorization Successful!</h2>
              <p>Your Google Calendar has been connected successfully.</p>
              <p>You can now close this window and return to the calendar app.</p>
            </div>
            <script>
              // Try to close the popup automatically
              setTimeout(() => {
                if (window.opener) {
                  window.opener.postMessage({ type: 'oauth-success' }, '*');
                }
                window.close();
              }, 2000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>OAuth Error</title>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-align: center; 
                padding: 50px;
                background: #f8f9fa;
              }
              .error {
                background: #f8d7da;
                color: #721c24;
                border: 1px solid #f5c6cb;
                padding: 20px;
                border-radius: 8px;
                margin: 20px auto;
                max-width: 400px;
              }
            </style>
          </head>
          <body>
            <div class="error">
              <h2>❌ Authorization Failed</h2>
              <p>There was an error connecting your Google Calendar.</p>
              <p>Please close this window and try again.</p>
            </div>
            <script>
              setTimeout(() => {
                if (window.opener) {
                  window.opener.postMessage({ type: 'oauth-error' }, '*');
                }
                window.close();
              }, 2000);
            </script>
          </body>
        </html>
      `);
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
