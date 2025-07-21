import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";

interface SearchModalProps {
  onClose: () => void;
  onEventSelect: (eventId: number) => void;
}

export function SearchModal({ onClose, onEventSelect }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults = [], isLoading } = useQuery({
    queryKey: ["/api/events/search", debouncedQuery],
    enabled: debouncedQuery.trim().length > 0,
    queryFn: async () => {
      const response = await fetch(`/api/events/search/${encodeURIComponent(debouncedQuery)}`);
      if (!response.ok) throw new Error("Failed to search events");
      return response.json();
    },
  });

  const handleEventClick = (eventId: number) => {
    onEventSelect(eventId);
    onClose();
  };

  const formatDateTime = (dateTime: string | Date) => {
    return format(new Date(dateTime), "MMM d");
  };

  const formatTimeRange = (event: Event) => {
    if (event.isAllDay) {
      return "All Day";
    }
    
    const start = format(new Date(event.startTime), "h:mm a");
    const end = event.endTime ? format(new Date(event.endTime), "h:mm a") : "";
    return end ? `${start} - ${end}` : start;
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[80vh]">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Search Events</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-4 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
            placeholder="Search events, locations, descriptions..."
            autoFocus
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading && debouncedQuery && (
            <div className="text-center py-8 text-slate-500">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              <p>Searching...</p>
            </div>
          )}

          {!isLoading && debouncedQuery && searchResults.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <span className="text-4xl mb-2 block">🔍</span>
              <p>No events found matching your search.</p>
            </div>
          )}

          {!debouncedQuery && (
            <div className="text-center py-8 text-slate-500">
              <span className="text-4xl mb-2 block">🔍</span>
              <p>Start typing to search for events...</p>
            </div>
          )}

          <div className="space-y-3">
            {searchResults.map((event: Event) => (
              <div
                key={event.id}
                onClick={() => handleEventClick(event.id)}
                className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-slate-800">{event.title}</h3>
                  <span className="text-sm text-slate-500">
                    {formatDateTime(event.startTime)}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-2">
                  {formatTimeRange(event)}
                  {event.location && ` • ${event.location}`}
                </p>
                {event.description && (
                  <p className="text-xs text-slate-500 truncate">
                    {event.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
