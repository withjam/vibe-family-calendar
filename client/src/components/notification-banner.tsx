import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isAfter, isBefore, addMinutes, addHours, addDays } from "date-fns";
import type { Event } from "@shared/schema";

interface NotificationBannerProps {
  onEventSelect: (eventId: number) => void;
}

interface TriggeredReminder {
  event: Event;
  reminderText: string;
  reminderTime: Date;
  id: string;
}

export function NotificationBanner({ onEventSelect }: NotificationBannerProps) {
  const [activeNotifications, setActiveNotifications] = useState<TriggeredReminder[]>([]);
  const [checkedReminders, setCheckedReminders] = useState<Set<string>>(new Set());

  const { data: events = [] } = useQuery({
    queryKey: ["/api/events/range"],
    queryFn: async () => {
      const now = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1); // Next 24 hours for active reminders
      
      const response = await fetch(
        `/api/events/range?startDate=${now.toISOString()}&endDate=${endDate.toISOString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch events");
      return response.json();
    },
    refetchInterval: 30000, // Check every 30 seconds
  });

  useEffect(() => {
    const checkForTriggeredReminders = () => {
      const now = new Date();
      const newNotifications: TriggeredReminder[] = [];

      events.forEach((event: Event) => {
        if (!event.reminders || event.reminders.length === 0) return;

        const eventStart = new Date(event.startTime);
        
        event.reminders.forEach((reminderText: string) => {
          let reminderTime: Date | null = null;

          // Parse reminder text to calculate time
          if (reminderText.includes("15 minutes")) {
            reminderTime = addMinutes(eventStart, -15);
          } else if (reminderText.includes("30 minutes")) {
            reminderTime = addMinutes(eventStart, -30);
          } else if (reminderText.includes("1 hour")) {
            reminderTime = addHours(eventStart, -1);
          } else if (reminderText.includes("1 day")) {
            reminderTime = addDays(eventStart, -1);
          }

          if (reminderTime) {
            const reminderId = `${event.id}-${reminderText}-${reminderTime.getTime()}`;
            
            // Check if reminder should trigger (within 1 minute window)
            const timeDiff = now.getTime() - reminderTime.getTime();
            const shouldTrigger = timeDiff >= 0 && timeDiff <= 60000; // Within 1 minute
            
            if (shouldTrigger && !checkedReminders.has(reminderId)) {
              newNotifications.push({
                event,
                reminderText,
                reminderTime,
                id: reminderId,
              });
              
              // Mark as checked so it doesn't trigger again
              setCheckedReminders(prev => new Set([...prev, reminderId]));
            }
          }
        });
      });

      if (newNotifications.length > 0) {
        setActiveNotifications(prev => [...prev, ...newNotifications]);
      }
    };

    checkForTriggeredReminders();
  }, [events, checkedReminders]);

  const dismissNotification = (notificationId: string) => {
    setActiveNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleEventClick = (eventId: number, notificationId: string) => {
    onEventSelect(eventId);
    dismissNotification(notificationId);
  };

  if (activeNotifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {activeNotifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-amber-500 text-white p-4 rounded-lg shadow-2xl border-l-4 border-amber-600 animate-pulse cursor-pointer"
          onClick={() => handleEventClick(notification.event.id, notification.id)}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-2">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-lg">🔔</span>
                <span className="font-semibold text-sm">Reminder</span>
              </div>
              <h4 className="font-bold text-base mb-1 leading-tight">
                {notification.event.title}
              </h4>
              <p className="text-xs opacity-90 mb-2">
                {notification.reminderText}
              </p>
              <div className="text-xs opacity-80">
                Event: {format(new Date(notification.event.startTime), "h:mm a")}
                {notification.event.location && (
                  <span> • {notification.event.location}</span>
                )}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissNotification(notification.id);
              }}
              className="text-white hover:text-amber-200 text-lg font-bold flex-shrink-0"
            >
              ×
            </button>
          </div>
          <div className="mt-2 text-xs opacity-75">
            Click to view event details
          </div>
        </div>
      ))}
    </div>
  );
}