import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import type { Event, CalendarSource } from "@shared/schema";

interface CalendarGridProps {
  currentDate: Date;
  events: Event[];
  selectedEventId: number | null;
  onEventSelect: (eventId: number) => void;
  onDayClick?: (date: Date) => void;
}

export function CalendarGrid({
  currentDate,
  events,
  selectedEventId,
  onEventSelect,
  onDayClick,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const { data: calendarSources = [] } = useQuery({
    queryKey: ["/api/calendar-sources"],
    queryFn: async () => {
      const response = await fetch("/api/calendar-sources");
      if (!response.ok) throw new Error("Failed to fetch calendar sources");
      return response.json();
    },
  });

  const getEventsForDay = (day: Date) => {
    return events
      .filter(event => isSameDay(new Date(event.startTime), day))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  const formatTime = (dateTime: string | Date) => {
    return format(new Date(dateTime), "h:mm a");
  };

  const getEventColor = (event: Event) => {
    // If event has a source calendar, use its color
    if (event.sourceCalendar) {
      const source = calendarSources.find((s: CalendarSource) => s.name === event.sourceCalendar);
      if (source?.color) {
        // Convert hex color to CSS classes - simplified approach
        return `border-l-4 text-slate-700`;
      }
    }

    // Fallback to category-based colors for manually created events
    const colors = {
      work: "bg-blue-100 text-blue-800 border-blue-300",
      personal: "bg-purple-100 text-purple-800 border-purple-300",
      family: "bg-green-100 text-green-800 border-green-300",
      health: "bg-red-100 text-red-800 border-red-300",
      sports: "bg-amber-100 text-amber-800 border-amber-300",
      default: "bg-gray-100 text-gray-800 border-gray-300",
    };
    return colors[event.category as keyof typeof colors] || colors.default;
  };

  const getEventStyle = (event: Event) => {
    if (event.sourceCalendar) {
      const source = calendarSources.find((s: CalendarSource) => s.name === event.sourceCalendar);
      if (source?.color) {
        return {
          borderLeftColor: source.color,
          backgroundColor: source.color + "20", // Add transparency
        };
      }
    }
    return {};
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
      {/* Days of Week Header */}
      <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div
            key={day}
            className="p-4 text-center font-semibold text-slate-700 border-r border-slate-200 last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 flex-1">
        {days.map(day => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          const handleCellClick = (e: React.MouseEvent) => {
            // Only handle day click if not clicking on an event
            const isEventClick = (e.target as HTMLElement).closest('.event-item');
            if (!isEventClick && onDayClick && isCurrentMonth) {
              onDayClick(day);
            }
          };

          return (
            <div
              key={day.toISOString()}
              onClick={handleCellClick}
              className={`calendar-cell border-r border-b border-slate-200 p-3 flex flex-col cursor-pointer ${
                isToday && isCurrentMonth
                  ? "bg-blue-50 hover:bg-blue-100 border-blue-200"
                  : isCurrentMonth 
                    ? "bg-white hover:bg-slate-50" 
                    : "bg-slate-50"
              } ${days.indexOf(day) % 7 === 6 ? "border-r-0" : ""} ${
                days.indexOf(day) >= days.length - 7 ? "border-b-0" : ""
              }`}
            >
              <div className="flex justify-end mb-2">
                <span
                  className={`font-semibold ${
                    isToday && isCurrentMonth
                      ? "text-blue-700 bg-blue-100 px-2 py-1 rounded-full text-sm"
                      : isCurrentMonth 
                        ? "text-slate-800" 
                        : "text-slate-400"
                  }`}
                >
                  {format(day, "d")}
                </span>
              </div>

              <div className="space-y-1 flex-1 overflow-y-auto">
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent day click when clicking on event
                      onEventSelect(event.id);
                    }}
                    className={`event-item text-xs px-2 py-1 rounded font-medium flex justify-between cursor-pointer ${getEventColor(event)} ${
                      selectedEventId === event.id ? "selected" : ""
                    }`}
                    style={getEventStyle(event)}
                  >
                    <span className="truncate mr-1">{event.title}</span>
                    <span className="flex-shrink-0">
                      {event.isAllDay ? "All Day" : formatTime(event.startTime)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
