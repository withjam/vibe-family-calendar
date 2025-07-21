import ICAL from "ical.js";
import fetch from "node-fetch";
import type { InsertEvent, CalendarSource } from "@shared/schema";

export interface CalendarSyncService {
  syncCalendar(source: CalendarSource): Promise<InsertEvent[]>;
  parseICalData(icalData: string, sourceCalendar: string): Promise<InsertEvent[]>;
}

export class CalendarSyncServiceImpl implements CalendarSyncService {
  
  async syncCalendar(source: CalendarSource): Promise<InsertEvent[]> {
    try {
      console.log(`Syncing calendar: ${source.name} from ${source.url}`);
      
      // Fetch calendar data
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
      }
      
      const icalData = await response.text();
      
      // Parse and convert to events
      const events = await this.parseICalData(icalData, source.name);
      
      console.log(`Successfully parsed ${events.length} events from ${source.name}`);
      return events;
      
    } catch (error) {
      console.error(`Error syncing calendar ${source.name}:`, error);
      throw error;
    }
  }

  async parseICalData(icalData: string, sourceCalendar: string): Promise<InsertEvent[]> {
    try {
      // Parse the iCal data
      const jcalData = ICAL.parse(icalData);
      const vcalendar = new ICAL.Component(jcalData);
      
      const events: InsertEvent[] = [];
      const vevents = vcalendar.getAllSubcomponents('vevent');
      
      for (const vevent of vevents) {
        try {
          const event = this.convertVEventToEvent(vevent, sourceCalendar);
          if (event) {
            events.push(event);
          }
        } catch (error) {
          console.warn(`Error parsing individual event:`, error);
          // Continue with other events
        }
      }
      
      return events;
      
    } catch (error) {
      console.error("Error parsing iCal data:", error);
      throw new Error("Failed to parse calendar data");
    }
  }

  private convertVEventToEvent(vevent: any, sourceCalendar: string): InsertEvent | null {
    try {
      const summary = vevent.getFirstPropertyValue('summary');
      const dtstart = vevent.getFirstPropertyValue('dtstart');
      const dtend = vevent.getFirstPropertyValue('dtend');
      const description = vevent.getFirstPropertyValue('description');
      const location = vevent.getFirstPropertyValue('location');
      const uid = vevent.getFirstPropertyValue('uid');
      
      if (!summary || !dtstart) {
        console.warn("Event missing required fields (summary or dtstart)");
        return null;
      }

      // Convert ICAL.Time to JavaScript Date
      const startTime = dtstart.toJSDate();
      let endTime: Date | null = null;
      let isAllDay = false;

      // Handle all-day events
      if (dtstart.isDate) {
        isAllDay = true;
        // For all-day events, set end time to end of day
        endTime = new Date(startTime);
        endTime.setHours(23, 59, 59);
      } else if (dtend) {
        endTime = dtend.toJSDate();
      }

      // Determine category based on summary/description content
      const category = this.determineCategory(summary, description);

      const event: InsertEvent = {
        title: summary,
        description: description || null,
        startTime,
        endTime,
        location: location || null,
        category,
        isAllDay,
        reminders: null, // Could parse VALARM components if needed
        sourceCalendar,
        externalId: uid || null,
      };

      return event;
      
    } catch (error) {
      console.error("Error converting vevent:", error);
      return null;
    }
  }

  private determineCategory(title: string, description?: string): string {
    const text = `${title} ${description || ""}`.toLowerCase();
    
    // Work-related keywords
    if (text.match(/\b(meeting|conference|work|office|project|client|deadline|standup|scrum)\b/)) {
      return "work";
    }
    
    // Health-related keywords
    if (text.match(/\b(doctor|appointment|medical|dentist|checkup|therapy|gym|workout)\b/)) {
      return "health";
    }
    
    // Sports-related keywords
    if (text.match(/\b(game|match|practice|training|soccer|football|basketball|tennis|golf)\b/)) {
      return "sports";
    }
    
    // Family-related keywords
    if (text.match(/\b(family|birthday|anniversary|reunion|wedding|graduation|school)\b/)) {
      return "family";
    }
    
    // Default to personal
    return "personal";
  }
}

export const calendarSyncService = new CalendarSyncServiceImpl();