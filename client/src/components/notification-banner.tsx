import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useReminderWorker } from "@/hooks/use-reminder-worker";
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
  const [progressBars, setProgressBars] = useState<Map<string, number>>(new Map());

  // Get events for the next 24 hours for reminder processing
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
    refetchInterval: 60000, // Reduced frequency as worker handles the frequent checking
  });

  // Use web worker for reminder processing
  const { triggeredReminders, clearReminders, dismissReminder, status } = useReminderWorker(events);
  
  // Handle new reminders from the web worker
  useEffect(() => {
    if (triggeredReminders.length > 0) {
      // Filter out reminders that are already active to prevent duplicates
      const newReminders = triggeredReminders.filter(reminder => 
        !activeNotifications.some(active => active.id === reminder.id)
      );
      
      if (newReminders.length > 0) {
        setActiveNotifications(prev => [...prev, ...newReminders]);
        
        // Set up progress bar and auto-dismiss for each new notification
        newReminders.forEach(notification => {
          // Initialize progress bar at 100%
          setProgressBars(prev => new Map(prev.set(notification.id, 100)));
          
          // Update progress bar every 600ms (100 times in 60 seconds)
          let progress = 100;
          const progressInterval = setInterval(() => {
            progress -= 100/100; // Decrease by 1% every 600ms
            setProgressBars(prev => new Map(prev.set(notification.id, Math.max(0, progress))));
            
            if (progress <= 0) {
              clearInterval(progressInterval);
            }
          }, 600);
          
          // Auto-dismiss after 60 seconds
          setTimeout(() => {
            dismissNotification(notification.id);
            clearInterval(progressInterval);
          }, 60000);
        });
      }
      
      // Clear the triggered reminders from the worker
      clearReminders();
    }
  }, [triggeredReminders, clearReminders, activeNotifications]);

  const dismissNotification = (notificationId: string) => {
    setActiveNotifications(prev => prev.filter(n => n.id !== notificationId));
    setProgressBars(prev => {
      const newMap = new Map(prev);
      newMap.delete(notificationId);
      return newMap;
    });
    
    // Tell the worker to mark this reminder as permanently dismissed
    dismissReminder(notificationId);
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
          className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 rounded-xl shadow-2xl border-4 border-amber-400 animate-pulse cursor-pointer transform scale-105 hover:scale-110 transition-transform relative overflow-hidden"
          onClick={() => handleEventClick(notification.event.id, notification.id)}
          style={{
            animation: 'gentle-shake 0.5s ease-in-out 0s 3, fade-in 0.3s ease-out'
          }}
        >
          {/* Progress bar at the bottom */}
          <div className="absolute bottom-0 left-0 h-2 bg-amber-600 transition-all duration-600 ease-linear rounded-b-xl"
               style={{ width: `${progressBars.get(notification.id) || 100}%` }}>
          </div>
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