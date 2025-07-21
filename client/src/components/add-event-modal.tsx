import { useState } from "react";
import { format } from "date-fns";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Event, InsertEvent, CalendarSource } from "@shared/schema";

interface AddEventModalProps {
  event?: Event | null;
  onClose: () => void;
}

export function AddEventModal({ event, onClose }: AddEventModalProps) {
  const isEditing = !!event;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const getCurrentTime = () => {
    const now = new Date();
    // Round to next 15-minute interval
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    now.setMinutes(roundedMinutes, 0, 0);
    return format(now, "HH:mm");
  };

  const getEndTime = () => {
    const now = new Date();
    // Round to next 15-minute interval, then add an hour
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    now.setMinutes(roundedMinutes, 0, 0);
    now.setHours(now.getHours() + 1);
    return format(now, "HH:mm");
  };

  const [formData, setFormData] = useState({
    title: event?.title || "",
    description: event?.description || "",
    startDate: event ? format(new Date(event.startTime), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    startTime: event ? format(new Date(event.startTime), "HH:mm") : getCurrentTime(),
    endTime: event?.endTime ? format(new Date(event.endTime), "HH:mm") : getEndTime(),
    location: event?.location || "",
    category: event?.category || "personal",
    sourceCalendar: event?.sourceCalendar || null,
    isAllDay: event?.isAllDay || false,
    reminders: event?.reminders || [],
  });

  const [reminderOptions] = useState([
    "15 minutes before",
    "30 minutes before",
    "1 hour before",
    "1 day before",
  ]);

  // Fetch available calendar sources
  const { data: calendarSources = [], isLoading: isLoadingSources } = useQuery({
    queryKey: ["/api/calendar-sources"],
    queryFn: async () => {
      const response = await fetch("/api/calendar-sources");
      if (!response.ok) throw new Error("Failed to fetch calendar sources");
      return response.json();
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: InsertEvent) => {
      return apiRequest("POST", "/api/events", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/range"] });
      toast({
        title: "Event Created",
        description: "Your event has been successfully created.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (data: Partial<InsertEvent>) => {
      return apiRequest("PATCH", `/api/events/${event!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/range"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events", event!.id] });
      toast({
        title: "Event Updated",
        description: "Your event has been successfully updated.",
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Event title is required.",
        variant: "destructive",
      });
      return;
    }

    const startDateTime = formData.isAllDay
      ? new Date(`${formData.startDate}T00:00:00`)
      : new Date(`${formData.startDate}T${formData.startTime}:00`);

    const endDateTime = formData.isAllDay
      ? new Date(`${formData.startDate}T23:59:59`)
      : formData.endTime
      ? new Date(`${formData.startDate}T${formData.endTime}:00`)
      : null;

    const eventData: InsertEvent = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      startTime: startDateTime,
      endTime: endDateTime,
      location: formData.location.trim() || null,
      category: formData.category,
      sourceCalendar: formData.sourceCalendar,
      isAllDay: formData.isAllDay,
      reminders: formData.reminders,
    };

    if (isEditing) {
      updateEventMutation.mutate(eventData);
    } else {
      createEventMutation.mutate(eventData);
    }
  };

  const handleReminderChange = (reminder: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      reminders: checked
        ? [...prev.reminders, reminder]
        : prev.reminders.filter(r => r !== reminder)
    }));
  };

  const isPending = createEventMutation.isPending || updateEventMutation.isPending;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-slate-800">
            {isEditing ? "Edit Event" : "Add New Event"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Event Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
              placeholder="Enter event title..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Date *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="personal">Personal</option>
                <option value="work">Work</option>
                <option value="family">Family</option>
                <option value="health">Health</option>
                <option value="sports">Sports</option>
              </select>
            </div>
          </div>

          {/* Calendar Source Selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Add to Calendar
            </label>
            <select
              value={formData.sourceCalendar || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, sourceCalendar: e.target.value || null }))}
              className="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={isLoadingSources || (isEditing && !!event?.sourceCalendar)}
            >
              <option value="">Local Calendar (Default)</option>
              {calendarSources.map((source: CalendarSource) => (
                <option key={source.id} value={source.name}>
                  {source.name} {source.hasOAuthCredentials ? "(✓ OAuth Enabled)" : "(Local Copy Only)"}
                </option>
              ))}
            </select>
            {formData.sourceCalendar && (
              <p className="text-xs text-slate-600 mt-1">
                {(() => {
                  const selectedSource = calendarSources.find((s: CalendarSource) => s.name === formData.sourceCalendar);
                  return selectedSource?.hasOAuthCredentials 
                    ? "✓ This event will be synced to the external calendar"
                    : "Note: Events are stored locally only. External calendars need OAuth authorization for write-back.";
                })()}
              </p>
            )}
            {isEditing && event?.sourceCalendar && (
              <p className="text-xs text-slate-500 mt-1">
                Imported events cannot be moved to different calendars
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="allDay"
              checked={formData.isAllDay}
              onChange={(e) => setFormData(prev => ({ ...prev, isAllDay: e.target.checked }))}
              className="w-4 h-4 text-primary rounded"
            />
            <label htmlFor="allDay" className="text-sm font-medium text-slate-700">
              All Day Event
            </label>
          </div>

          {!formData.isAllDay && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  className="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  End Time
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  className="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              className="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Enter location..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent h-32 resize-none"
              placeholder="Enter event description..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Reminders
            </label>
            <div className="space-y-2">
              {reminderOptions.map(reminder => (
                <div key={reminder} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={reminder}
                    checked={formData.reminders.includes(reminder)}
                    onChange={(e) => handleReminderChange(reminder, e.target.checked)}
                    className="w-4 h-4 text-primary rounded"
                  />
                  <label htmlFor={reminder} className="text-sm text-slate-600">
                    {reminder}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-500 text-white py-4 px-6 rounded-lg font-semibold hover:bg-slate-600 transition-colors touch-target"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-primary text-primary-foreground py-4 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors touch-target disabled:opacity-50"
            >
              {isPending ? "Saving..." : isEditing ? "Update Event" : "Save Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
