import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CalendarSource, InsertCalendarSource } from "@shared/schema";

interface CalendarImportModalProps {
  onClose: () => void;
}

export function CalendarImportModal({ onClose }: CalendarImportModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    url: "",
    type: "ical" as "ical" | "google" | "webcal",
    color: "#3b82f6",
    syncInterval: 3600,
  });

  const [showExamples, setShowExamples] = useState(false);

  const { data: calendarSources = [], isLoading: isLoadingSources } = useQuery({
    queryKey: ["/api/calendar-sources"],
    queryFn: async () => {
      const response = await fetch("/api/calendar-sources");
      if (!response.ok) throw new Error("Failed to fetch calendar sources");
      return response.json();
    },
  });

  const createSourceMutation = useMutation({
    mutationFn: async (data: InsertCalendarSource) => {
      return apiRequest("POST", "/api/calendar-sources", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-sources"] });
      toast({
        title: "Calendar Added",
        description: "Calendar source has been added successfully.",
      });
      setFormData({
        name: "",
        url: "",
        type: "ical",
        color: "#3b82f6",
        syncInterval: 3600,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add calendar source.",
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (sourceId: number) => {
      return apiRequest("POST", `/api/calendar-sources/${sourceId}/sync`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/range"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-sources"] });
      toast({
        title: "Calendar Synced",
        description: data.message || "Calendar synced successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync calendar.",
        variant: "destructive",
      });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/calendar-sources/sync-all");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events/range"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-sources"] });
      toast({
        title: "All Calendars Synced",
        description: data.message || "All calendars synced successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync calendars.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sourceId: number) => {
      return apiRequest("DELETE", `/api/calendar-sources/${sourceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/range"] });
      toast({
        title: "Calendar Removed",
        description: "Calendar source and its events have been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove calendar source.",
        variant: "destructive",
      });
    },
  });

  const enableOAuthMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/calendar-sources/${id}/oauth-url`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to generate OAuth URL");
      return response.json();
    },
    onSuccess: (data: { authUrl: string }) => {
      window.open(data.authUrl, "_blank", "width=600,height=600");
      toast({
        title: "OAuth authorization opened",
        description: "Complete authorization in the popup window, then refresh this page.",
      });
    },
    onError: () => {
      toast({
        title: "Error starting OAuth",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.url.trim()) {
      toast({
        title: "Error",
        description: "Calendar name and URL are required.",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format
    try {
      new URL(formData.url);
    } catch {
      toast({
        title: "Error",
        description: "Please enter a valid URL.",
        variant: "destructive",
      });
      return;
    }

    const calendarData: InsertCalendarSource = {
      name: formData.name.trim(),
      url: formData.url.trim(),
      type: formData.type,
      isActive: true,
      syncInterval: formData.syncInterval,
      color: formData.color,
    };

    createSourceMutation.mutate(calendarData);
  };

  const handleSync = (sourceId: number) => {
    syncMutation.mutate(sourceId);
  };

  const handleDelete = (sourceId: number) => {
    if (confirm("Are you sure you want to remove this calendar? All associated events will be deleted.")) {
      deleteMutation.mutate(sourceId);
    }
  };

  const handleSyncAll = () => {
    syncAllMutation.mutate();
  };

  const isPending = createSourceMutation.isPending || syncMutation.isPending || deleteMutation.isPending || syncAllMutation.isPending;

  const exampleCalendars = [
    {
      name: "US Holidays",
      url: "https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics",
      type: "ical" as const,
    },
    {
      name: "Google Calendar (Public)",
      url: "https://calendar.google.com/calendar/ical/YOUR_EMAIL@gmail.com/public/basic.ics",
      type: "google" as const,
    },
    {
      name: "Google Calendar (Private)",
      url: "https://calendar.google.com/calendar/ical/CALENDAR_ID/private-SECRET_KEY/basic.ics",
      type: "google" as const,
    }
  ];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 modal-backdrop flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl p-8 max-w-4xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Import Calendars</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Add New Calendar */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Add New Calendar</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Calendar Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="My Calendar"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Calendar URL *
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="https://calendar.google.com/calendar/ical/..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="ical">iCal/ICS</option>
                    <option value="google">Google Calendar</option>
                    <option value="webcal">WebCal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Color
                  </label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="w-full h-12 border border-slate-300 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {createSourceMutation.isPending ? "Adding..." : "Add Calendar"}
              </button>
            </form>

            <div className="mt-4">
              <button
                onClick={() => setShowExamples(!showExamples)}
                className="text-sm text-primary hover:underline"
              >
                {showExamples ? "Hide" : "Show"} Example Calendars
              </button>
              
              {showExamples && (
                <div className="mt-3 p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-medium mb-2">Example Calendar URLs:</h4>
                  <div className="space-y-2 text-sm">
                    {exampleCalendars.map((example, index) => (
                      <div key={index} className="p-2 bg-white rounded border">
                        <div className="font-medium">{example.name}</div>
                        <div className="text-xs text-slate-600 break-all">{example.url}</div>
                        <button
                          onClick={() => setFormData(prev => ({ 
                            ...prev, 
                            name: example.name, 
                            url: example.url, 
                            type: example.type 
                          }))}
                          className="text-xs text-primary hover:underline mt-1"
                        >
                          Use this example
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Existing Calendars */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Imported Calendars</h3>
              <button
                onClick={handleSyncAll}
                disabled={isPending || calendarSources.length === 0}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {syncAllMutation.isPending ? "Syncing..." : "Sync All"}
              </button>
            </div>

            {isLoadingSources ? (
              <div className="text-center py-8 text-slate-500">Loading calendars...</div>
            ) : calendarSources.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <span className="text-4xl mb-2 block">📅</span>
                <p>No calendars imported yet.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {calendarSources.map((source: CalendarSource) => (
                  <div key={source.id} className="p-4 border border-slate-200 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: source.color || "#3b82f6" }}
                        ></div>
                        <h4 className="font-medium text-slate-800">{source.name}</h4>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleSync(source.id)}
                          disabled={isPending}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {syncMutation.isPending ? "..." : "Sync"}
                        </button>
                        <button
                          onClick={() => handleDelete(source.id)}
                          disabled={isPending}
                          className="bg-red-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 break-all mb-2">{source.url}</p>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span className="capitalize">{source.type}</span>
                      <span>
                        {source.lastSynced 
                          ? `Last synced: ${new Date(source.lastSynced).toLocaleString()}`
                          : "Never synced"
                        }
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">📝 How to get calendar URLs:</h4>
          <div className="text-sm text-blue-800 space-y-2">
            <div>
              <p><strong>Google Calendar:</strong></p>
              <ol className="list-decimal list-inside ml-4 space-y-1">
                <li>Go to Google Calendar → Settings → Settings for my calendars</li>
                <li>Click on your calendar name</li>
                <li>Scroll to "Integrate calendar" section</li>
                <li>Copy the "Public address in iCal format" (ends with .ics)</li>
                <li>Or copy "Secret address in iCal format" for private calendars</li>
              </ol>
            </div>
            <div>
              <p><strong>Outlook:</strong> Calendar → Share → Publish calendar → Copy ICS link</p>
            </div>
            <div>
              <p><strong>Apple iCloud:</strong> iCloud.com → Calendar → Share calendar → Public calendar</p>
            </div>
          </div>
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Make sure to use the ".ics" URL format, not the embed or HTML view URLs. 
              The system will automatically convert some Google Calendar URLs if needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}