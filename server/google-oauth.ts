import { google } from 'googleapis';
import type { CalendarSource } from '@shared/schema';

export class GoogleOAuthService {
  private oauth2Client: any;
  
  constructor() {
    // Determine the correct redirect URI for the environment
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || this.getRedirectUri();
    
    // Initialize OAuth2 client - credentials would come from environment variables
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
  }

  private getRedirectUri(): string {
    // Check if we're in a Replit environment
    if (process.env.REPLIT_DOMAINS) {
      const domains = process.env.REPLIT_DOMAINS.split(',');
      return `https://${domains[0]}/api/oauth/callback`;
    }
    
    // Fallback to localhost for local development
    return 'http://localhost:5000/api/oauth/callback';
  }

  // Generate OAuth URL for user authorization
  getAuthUrl(calendarSourceId: number): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events'
    ];
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: calendarSourceId.toString(), // Pass calendar source ID as state
      prompt: 'consent' // Force consent to get refresh token
    });
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code: string): Promise<{
    refresh_token: string;
    access_token: string;
  }> {
    const { tokens } = await this.oauth2Client.getToken(code);
    return {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token
    };
  }

  // Set credentials for API calls
  setCredentials(refreshToken: string) {
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
  }

  // Create event in Google Calendar
  async createEvent(calendarId: string, eventData: any) {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    const event = {
      summary: eventData.title,
      description: eventData.description,
      location: eventData.location,
      start: eventData.isAllDay 
        ? { date: eventData.startTime.split('T')[0] }
        : { dateTime: eventData.startTime, timeZone: 'America/New_York' },
      end: eventData.endTime 
        ? eventData.isAllDay 
          ? { date: eventData.endTime.split('T')[0] }
          : { dateTime: eventData.endTime, timeZone: 'America/New_York' }
        : eventData.isAllDay
          ? { date: eventData.startTime.split('T')[0] }
          : { dateTime: new Date(new Date(eventData.startTime).getTime() + 60 * 60 * 1000).toISOString(), timeZone: 'America/New_York' },
    };

    if (eventData.reminders && eventData.reminders.length > 0) {
      event.reminders = {
        useDefault: false,
        overrides: eventData.reminders.map((reminder: string) => {
          let minutes = 15; // default
          if (reminder.includes('30 minutes')) minutes = 30;
          else if (reminder.includes('1 hour')) minutes = 60;
          else if (reminder.includes('1 day')) minutes = 1440;
          
          return { method: 'popup', minutes };
        })
      };
    }

    const response = await calendar.events.insert({
      calendarId: calendarId,
      resource: event,
    });

    return response.data;
  }

  // Update event in Google Calendar
  async updateEvent(calendarId: string, eventId: string, eventData: any) {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    const event = {
      summary: eventData.title,
      description: eventData.description,
      location: eventData.location,
      start: eventData.isAllDay 
        ? { date: eventData.startTime.split('T')[0] }
        : { dateTime: eventData.startTime, timeZone: 'America/New_York' },
      end: eventData.endTime 
        ? eventData.isAllDay 
          ? { date: eventData.endTime.split('T')[0] }
          : { dateTime: eventData.endTime, timeZone: 'America/New_York' }
        : eventData.isAllDay
          ? { date: eventData.startTime.split('T')[0] }
          : { dateTime: new Date(new Date(eventData.startTime).getTime() + 60 * 60 * 1000).toISOString(), timeZone: 'America/New_York' },
    };

    const response = await calendar.events.update({
      calendarId: calendarId,
      eventId: eventId,
      resource: event,
    });

    return response.data;
  }

  // Delete event from Google Calendar
  async deleteEvent(calendarId: string, eventId: string) {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    await calendar.events.delete({
      calendarId: calendarId,
      eventId: eventId,
    });
  }

  // Get list of user's calendars
  async getUserCalendars() {
    const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    const response = await calendar.calendarList.list();
    return response.data.items?.map(cal => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary,
      accessRole: cal.accessRole
    })) || [];
  }
}