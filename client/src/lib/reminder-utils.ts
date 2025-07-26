// Utility functions for parsing reminder text into numeric offsets

export interface ParsedReminder {
  text: string;
  offsetMinutes: number;
}

/**
 * Parse reminder text strings into numeric minute offsets
 * @param reminders Array of reminder text strings
 * @returns Array of parsed reminders with numeric offsets
 */
export function parseReminderOffsets(reminders: string[]): ParsedReminder[] {
  return reminders.map(reminderText => {
    let offsetMinutes = 0;
    
    // Parse reminder text to extract numeric offset in minutes
    // Check most specific patterns first to avoid conflicts
    if (reminderText.includes("15 minutes")) {
      offsetMinutes = 15;
    } else if (reminderText.includes("30 minutes")) {
      offsetMinutes = 30;
    } else if (reminderText.includes("5 minutes")) {
      offsetMinutes = 5;
    } else if (reminderText.includes("2 minutes")) {
      offsetMinutes = 2;
    } else if (reminderText.includes("1 minute")) {
      offsetMinutes = 1;
    } else if (reminderText.includes("1 hour")) {
      offsetMinutes = 60;
    } else if (reminderText.includes("1 day")) {
      offsetMinutes = 1440; // 24 * 60
    }
    
    return {
      text: reminderText,
      offsetMinutes: offsetMinutes
    };
  }).filter(reminder => reminder.offsetMinutes > 0); // Filter out unparseable reminders
}

/**
 * Calculate reminder time from event start time and offset
 * @param eventStartTime The event start time
 * @param offsetMinutes Minutes before the event
 * @returns The calculated reminder time
 */
export function calculateReminderTime(eventStartTime: Date, offsetMinutes: number): Date {
  return new Date(eventStartTime.getTime() - offsetMinutes * 60000);
}