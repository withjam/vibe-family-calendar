import { useState } from "react";
import { CalendarHeader } from "@/components/calendar-header";
import { CalendarGrid } from "@/components/calendar-grid";
import { EventModal } from "@/components/event-modal";
import { AddEventModal } from "@/components/add-event-modal";
import { SearchModal } from "@/components/search-modal";
import { CalendarImportModal } from "@/components/calendar-import-modal";
import { RemindersPanel } from "@/components/reminders-panel";
import { NotificationBanner } from "@/components/notification-banner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSyncWorker } from "@/hooks/use-sync-worker";
import type { Event } from "@shared/schema";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRemindersPanel, setShowRemindersPanel] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get start and end of current month for API query
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["/api/events/range", startOfMonth.toISOString(), endOfMonth.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startOfMonth.toISOString(),
        endDate: endOfMonth.toISOString(),
      });
      const response = await fetch(`/api/events/range?${params}`);
      if (!response.ok) throw new Error("Failed to fetch events");
      return response.json();
    },
  });

  const { data: selectedEvent } = useQuery({
    queryKey: ["/api/events", selectedEventId],
    enabled: !!selectedEventId,
    queryFn: async () => {
      const response = await fetch(`/api/events/${selectedEventId}`);
      if (!response.ok) throw new Error("Failed to fetch event");
      return response.json();
    },
  });

  // Get calendar sources for sync worker
  const { data: calendarSources = [] } = useQuery({
    queryKey: ["/api/calendar-sources"],
    queryFn: async () => {
      const response = await fetch("/api/calendar-sources");
      if (!response.ok) throw new Error("Failed to fetch calendar sources");
      return response.json();
    },
  });

  // Initialize sync worker for background calendar synchronization
  const { status: syncStatus, triggerSync, restartWorker } = useSyncWorker(calendarSources);

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return apiRequest("DELETE", `/api/events/${eventId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/range"] });
      setSelectedEventId(null);
      toast({
        title: "Event Deleted",
        description: "The event has been successfully deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const navigateYear = (direction: "prev" | "next") => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === "prev") {
        newDate.setFullYear(prev.getFullYear() - 1);
      } else {
        newDate.setFullYear(prev.getFullYear() + 1);
      }
      return newDate;
    });
  };

  const handleEventSelect = (eventId: number) => {
    setSelectedEventId(eventId);
  };

  const handleEventEdit = () => {
    if (selectedEvent) {
      setEditingEvent(selectedEvent);
      setSelectedEventId(null);
      setShowAddModal(true);
    }
  };

  const handleEventDelete = () => {
    if (selectedEventId) {
      deleteEventMutation.mutate(selectedEventId);
    }
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    setSelectedDate(null);
    setShowAddModal(true);
  };

  const handleDayClick = (date: Date) => {
    setEditingEvent(null);
    setSelectedDate(date);
    setShowAddModal(true);
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setEditingEvent(null);
    setSelectedDate(null);
    queryClient.invalidateQueries({ queryKey: ["/api/events/range"] });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading calendar...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-6 bg-slate-50">
      <CalendarHeader
        currentDate={currentDate}
        onNavigateMonth={navigateMonth}
        onNavigateYear={navigateYear}
        onAddEvent={handleAddEvent}
        onSearchEvents={() => setShowSearchModal(true)}
        onImportCalendars={() => setShowImportModal(true)}
        onShowReminders={() => setShowRemindersPanel(true)}
      />

      <div className="flex-1 flex flex-col">
        <CalendarGrid
          currentDate={currentDate}
          events={events}
          selectedEventId={selectedEventId}
          onEventSelect={handleEventSelect}
          onDayClick={handleDayClick}
        />
      </div>

      {selectedEventId && selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEventId(null)}
          onEdit={handleEventEdit}
          onDelete={handleEventDelete}
          isDeleting={deleteEventMutation.isPending}
        />
      )}

      {showAddModal && (
        <AddEventModal
          event={editingEvent}
          selectedDate={selectedDate}
          onClose={handleModalClose}
        />
      )}

      {showSearchModal && (
        <SearchModal
          onClose={() => setShowSearchModal(false)}
          onEventSelect={handleEventSelect}
        />
      )}

      {showImportModal && (
        <CalendarImportModal
          onClose={() => setShowImportModal(false)}
        />
      )}

      {showRemindersPanel && (
        <RemindersPanel
          isOpen={showRemindersPanel}
          onClose={() => setShowRemindersPanel(false)}
          onEventSelect={handleEventSelect}
        />
      )}

      <NotificationBanner onEventSelect={handleEventSelect} />
    </div>
  );
}
