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
            
            // Check if reminder should trigger (current time has passed reminder time)
            const timeDiff = now.getTime() - reminderTime.getTime();
            const shouldTrigger = timeDiff >= 0 && timeDiff <= 300000; // Within 5 minutes of trigger time
            
            if (shouldTrigger && !checkedReminders.has(reminderId)) {
              newNotifications.push({
                event,
                reminderText,
                reminderTime,
                id: reminderId,
              });
              
              // Mark as checked so it doesn't trigger again
              setCheckedReminders(prev => new Set([...Array.from(prev), reminderId]));
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
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 space-y-4 max-w-lg w-full px-4">
      {activeNotifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 rounded-xl shadow-2xl border-4 border-amber-400 animate-bounce cursor-pointer transform scale-105 hover:scale-110 transition-transform"
          onClick={() => handleEventClick(notification.event.id, notification.id)}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 pr-3">
              <div className="flex items-center space-x-3 mb-2">
                <span className="text-2xl animate-pulse">🔔</span>
                <span className="font-bold text-lg">REMINDER ALERT</span>
              </div>
              <h4 className="font-bold text-xl mb-2 leading-tight">
                {notification.event.title}
              </h4>
              <p className="text-base opacity-95 mb-3 font-medium">
                {notification.reminderText}
              </p>
              <div className="text-sm opacity-90 space-y-1">
                <div>Event starts: {format(new Date(notification.event.startTime), "h:mm a")}</div>
                {notification.event.location && (
                  <div>Location: {notification.event.location}</div>
                )}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissNotification(notification.id);
              }}
              className="text-white hover:text-amber-200 text-2xl font-bold flex-shrink-0 bg-amber-600 hover:bg-amber-700 rounded-full w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>
          <div className="mt-3 text-sm opacity-90 font-medium bg-amber-600 rounded-lg p-2 text-center">
            Click anywhere to view event details
          </div>
        </div>
      ))}
    </div>
  );
}