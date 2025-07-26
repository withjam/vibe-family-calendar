import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isAfter, isBefore, addMinutes, addHours, addDays } from "date-fns";
import type { Event } from "@shared/schema";

interface RemindersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onEventSelect: (eventId: number) => void;
}

interface ReminderEvent {
  event: Event;
  reminderTime: Date;
  reminderText: string;
  isTriggered: boolean;
}

export function RemindersPanel({ isOpen, onClose, onEventSelect }: RemindersPanelProps) {
  const [upcomingReminders, setUpcomingReminders] = useState<ReminderEvent[]>([]);

  const { data: events = [] } = useQuery({
    queryKey: ["/api/events/range"],
    queryFn: async () => {
      const now = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30); // Next 30 days
      
      const response = await fetch(
        `/api/events/range?startDate=${now.toISOString()}&endDate=${endDate.toISOString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch events");
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  useEffect(() => {
    const calculateReminders = () => {
      const now = new Date();
      const reminders: ReminderEvent[] = [];

      events.forEach((event: Event) => {
        if (!event.reminders || event.reminders.length === 0) return;

        const eventStart = new Date(event.startTime);
        
        event.reminders.forEach((reminderText: string) => {
          let reminderTime: Date | null = null;

          // Parse reminder text to calculate time - check most specific patterns first
          if (reminderText.includes("15 minutes")) {
            reminderTime = addMinutes(eventStart, -15);
          } else if (reminderText.includes("30 minutes")) {
            reminderTime = addMinutes(eventStart, -30);
          } else if (reminderText.includes("5 minutes")) {
            reminderTime = addMinutes(eventStart, -5);
          } else if (reminderText.includes("2 minutes")) {
            reminderTime = addMinutes(eventStart, -2);
          } else if (reminderText.includes("1 minute")) {
            reminderTime = addMinutes(eventStart, -1);
          } else if (reminderText.includes("1 hour")) {
            reminderTime = addHours(eventStart, -1);
          } else if (reminderText.includes("1 day")) {
            reminderTime = addDays(eventStart, -1);
          }

          if (reminderTime && isAfter(reminderTime, now)) {
            reminders.push({
              event,
              reminderTime,
              reminderText,
              isTriggered: false,
            });
          }
        });
      });

      // Sort by reminder time
      reminders.sort((a, b) => a.reminderTime.getTime() - b.reminderTime.getTime());
      setUpcomingReminders(reminders);
    };

    calculateReminders();
  }, [events]);

  const formatReminderTime = (date: Date) => {
    const now = new Date();
    const isToday = format(date, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
    const isTomorrow = format(date, "yyyy-MM-dd") === format(addDays(now, 1), "yyyy-MM-dd");

    if (isToday) {
      return `Today at ${format(date, "h:mm a")}`;
    } else if (isTomorrow) {
      return `Tomorrow at ${format(date, "h:mm a")}`;
    } else {
      return format(date, "MMM d, h:mm a");
    }
  };

  const getTimeUntilReminder = (reminderTime: Date) => {
    const now = new Date();
    const diffMs = reminderTime.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    } else if (diffMinutes > 0) {
      return `in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
    } else {
      return "now";
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Upcoming Reminders</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {upcomingReminders.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <span className="text-6xl mb-4 block">🔔</span>
            <p className="text-lg">No upcoming reminders</p>
            <p className="text-sm mt-2">Add reminders to your events to see them here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingReminders.slice(0, 20).map((reminder, index) => (
              <div
                key={`${reminder.event.id}-${index}`}
                className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => {
                  onEventSelect(reminder.event.id);
                  onClose();
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-slate-800 truncate">
                    {reminder.event.title}
                  </h3>
                  <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                    {getTimeUntilReminder(reminder.reminderTime)}
                  </span>
                </div>
                
                <div className="text-sm text-slate-600 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span>🔔</span>
                    <span>{reminder.reminderText}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>📅</span>
                    <span>{formatReminderTime(reminder.reminderTime)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>⏰</span>
                    <span>
                      Event: {format(new Date(reminder.event.startTime), "MMM d, h:mm a")}
                    </span>
                  </div>
                  {reminder.event.location && (
                    <div className="flex items-center space-x-2">
                      <span>📍</span>
                      <span className="truncate">{reminder.event.location}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {upcomingReminders.length > 20 && (
              <div className="text-center py-4 text-slate-500">
                <p>... and {upcomingReminders.length - 20} more reminders</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}