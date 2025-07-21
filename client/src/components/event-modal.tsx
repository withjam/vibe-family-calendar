import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import type { Event, CalendarSource } from "@shared/schema";

interface EventModalProps {
  event: Event;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export function EventModal({
  event,
  onClose,
  onEdit,
  onDelete,
  isDeleting = false,
}: EventModalProps) {
  // Fetch calendar sources to get source details
  const { data: calendarSources = [] } = useQuery({
    queryKey: ["/api/calendar-sources"],
    queryFn: async () => {
      const response = await fetch("/api/calendar-sources");
      if (!response.ok) throw new Error("Failed to fetch calendar sources");
      return response.json();
    },
  });
  const getCategoryColor = (category: string) => {
    const colors = {
      work: "bg-blue-500",
      personal: "bg-purple-500",
      family: "bg-green-500",
      health: "bg-red-500",
      sports: "bg-amber-500",
      default: "bg-gray-500",
    };
    return colors[category as keyof typeof colors] || colors.default;
  };

  const formatDateTime = (dateTime: string | Date) => {
    return format(new Date(dateTime), "EEEE, MMMM do, yyyy");
  };

  const formatTime = (dateTime: string | Date) => {
    return format(new Date(dateTime), "h:mm a");
  };

  const formatTimeRange = () => {
    if (event.isAllDay) {
      return "All Day";
    }
    
    const start = formatTime(event.startTime);
    const end = event.endTime ? formatTime(event.endTime) : "";
    return end ? `${start} - ${end}` : start;
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl transform transition-all max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-slate-800">{event.title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className={`w-5 h-5 ${getCategoryColor(event.category)} rounded-full`}></div>
            <span className="text-slate-600 font-medium capitalize">{event.category}</span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-slate-500">📅</span>
            <span className="text-slate-700">{formatDateTime(event.startTime)}</span>
          </div>

          {event.sourceCalendar && (
            <div className="flex items-center space-x-3">
              <span className="text-slate-500">📋</span>
              <div className="flex items-center space-x-2">
                {(() => {
                  const source = calendarSources.find((s: CalendarSource) => s.name === event.sourceCalendar);
                  return (
                    <>
                      {source?.color && (
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: source.color }}
                        ></div>
                      )}
                      <span className="text-slate-700">{event.sourceCalendar}</span>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          <div className="flex items-center space-x-3">
            <span className="text-slate-500">🕐</span>
            <span className="text-slate-700">{formatTimeRange()}</span>
          </div>

          {event.location && (
            <div className="flex items-center space-x-3">
              <span className="text-slate-500">📍</span>
              <span className="text-slate-700">{event.location}</span>
            </div>
          )}

          {event.description && (
            <div className="pt-4 border-t border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-2">Description</h3>
              <div className="max-h-64 overflow-y-auto bg-slate-50 p-3 rounded-lg">
                <p className="text-slate-600 whitespace-pre-wrap">{event.description}</p>
              </div>
            </div>
          )}

          {event.reminders && event.reminders.length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-2">Reminders</h3>
              <div className="space-y-2">
                {event.reminders.map((reminder, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input type="checkbox" checked readOnly className="w-4 h-4 text-primary rounded" />
                    <span className="text-sm text-slate-600">{reminder}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex space-x-3 mt-8">
          <button
            onClick={onEdit}
            className="flex-1 bg-primary text-primary-foreground py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors touch-target"
          >
            Edit Event
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-700 transition-colors touch-target disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete Event"}
          </button>
        </div>
      </div>
    </div>
  );
}
