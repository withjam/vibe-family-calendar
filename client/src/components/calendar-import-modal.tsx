import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CalendarSource, InsertCalendarSource } from "@shared/schema";

interface CalendarImportModalProps {
  onClose: () => void;
}

// Helper function to format sync intervals
const formatSyncInterval = (seconds: number): string => {
  if (seconds < 3600) {
    const minutes = seconds / 60;
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (seconds < 86400) {
    const hours = seconds / 3600;
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else {
    const days = seconds / 86400;
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
};

// Component for editing sync intervals of existing calendars
function SyncIntervalEditor({ source }: { source: CalendarSource }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempInterval, setTempInterval] = useState(source.syncInterval);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (syncInterval: number) => {
      return apiRequest("PUT", `/api/calendar-sources/${source.id}`, { syncInterval });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-sources"] });
      setIsEditing(false);
      toast({
        title: "Sync frequency updated",
        description: `${source.name} will now sync ${formatSyncInterval(tempInterval)}.`,
      });
    },
    onError: () => {
      toast({
        title: "Error updating sync frequency",
        variant: "destructive",
      });
      setTempInterval(source.syncInterval); // Reset on error
    },
  });

  const handleSave = () => {
    if (tempInterval !== source.syncInterval) {
      updateMutation.mutate(tempInterval);
    } else {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setTempInterval(source.syncInterval);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center space-x-2">
        <select
          value={tempInterval}
          onChange={(e) => setTempInterval(parseInt(e.target.value))}
          className="text-xs border border-slate-300 rounded px-2 py-1"
        >
          <option value={900}>15 min</option>
          <option value={1800}>30 min</option>
          <option value={3600}>1 hour</option>
          <option value={7200}>2 hours</option>
          <option value={21600}>6 hours</option>
          <option value={86400}>1 day</option>
        </select>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="text-green-600 hover:text-green-700 text-xs"
        >
          ✓
        </button>
        <button
          onClick={handleCancel}
          disabled={updateMutation.isPending}
          className="text-red-600 hover:text-red-700 text-xs"
        >
          ✗
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="text-blue-600 hover:text-blue-700 text-xs hover:underline"
    >
      Edit
    </button>
  );
}

export function CalendarImportModal({ onClose }: CalendarImportModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Curated color palette - 10 main colors + 20 lighter variations (30 total)
  const colorPalette = [
    // Row 1: 10 main distinct colors
    "#DC2626", "#EA580C", "#CA8A04", "#16A34A", "#059669",
    "#0284C7", "#2563EB", "#7C3AED", "#C026D3", "#BE185D",
    
    // Row 2: Medium tints of the main colors
    "#F87171", "#FB923C", "#FACC15", "#4ADE80", "#34D399",
    "#38BDF8", "#60A5FA", "#A78BFA", "#E879F9", "#F472B6",
    
    // Row 3: Light tints of the main colors
    "#FCA5A5", "#FDBA74", "#FDE047", "#86EFAC", "#6EE7B7",
    "#7DD3FC", "#93C5FD", "#C4B5FD", "#F0ABFC", "#F9A8D4"
  ];

  const [formData, setFormData] = useState({
    name: "",
    url: "",
    type: "ical" as "ical" | "google" | "webcal",
    color: colorPalette[0],
    syncInterval: 3600,
  });

  // Auto-detect calendar type from URL
  const detectCalendarType = (url: string): "ical" | "google" | "webcal" => {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('calendar.google.com')) {
      return "google";
    } else if (lowerUrl.startsWith('webcal://')) {
      return "webcal";
    } else if (lowerUrl.includes('.ics') || lowerUrl.includes('ical')) {
      return "ical";
    }
    
    return "ical"; // default fallback
  };

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
        color: colorPalette[0],
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
      // Open OAuth URL in popup
      const popup = window.open(data.authUrl, "oauth", "width=600,height=600,scrollbars=yes,resizable=yes");
      
      // Listen for messages from the popup
      const messageListener = (event: MessageEvent) => {
        if (event.data?.type === 'oauth-success') {
          window.removeEventListener('message', messageListener);
          queryClient.invalidateQueries({ queryKey: ["/api/calendar-sources"] });
          toast({
            title: "OAuth enabled successfully",
            description: "Your calendar is now connected for bidirectional sync.",
          });
          popup?.close();
        } else if (event.data?.type === 'oauth-error') {
          window.removeEventListener('message', messageListener);
          toast({
            title: "OAuth authorization failed",
            description: "Please try again.",
            variant: "destructive",
          });
          popup?.close();
        }
      };
      
      window.addEventListener('message', messageListener);
      
      // Fallback: Close listener after 5 minutes
      setTimeout(() => {
        window.removeEventListener('message', messageListener);
      }, 300000);
      
      toast({
        title: "OAuth authorization opened",
        description: "Complete authorization in the popup window.",
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
                  onChange={(e) => {
                    const url = e.target.value;
                    const detectedType = detectCalendarType(url);
                    setFormData(prev => ({ 
                      ...prev, 
                      url,
                      type: detectedType
                    }));
                  }}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="https://calendar.google.com/calendar/ical/..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-10 gap-2">
                  {colorPalette.map((color, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                      className={`w-8 h-8 rounded-lg cursor-pointer border-2 transition-all ${
                        formData.color === color 
                          ? 'border-slate-800 ring-2 ring-slate-300' 
                          : 'border-slate-300 hover:border-slate-500'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Selected: {formData.color} • Type: {formData.type.charAt(0).toUpperCase() + formData.type.slice(1)} (auto-detected)
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Sync Frequency
                </label>
                <select
                  value={formData.syncInterval}
                  onChange={(e) => setFormData(prev => ({ ...prev, syncInterval: parseInt(e.target.value) }))}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value={900}>Every 15 minutes</option>
                  <option value={1800}>Every 30 minutes</option>
                  <option value={3600}>Every hour (recommended)</option>
                  <option value={7200}>Every 2 hours</option>
                  <option value={21600}>Every 6 hours</option>
                  <option value={86400}>Once daily</option>
                </select>
                <div className="mt-1 text-xs text-slate-500">
                  How often to check for calendar updates. More frequent syncing uses more resources.
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
                        {source.type === "google" && !source.hasOAuthCredentials && (
                          <button
                            onClick={() => enableOAuthMutation.mutate(source.id)}
                            disabled={enableOAuthMutation.isPending}
                            className="bg-green-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            {enableOAuthMutation.isPending ? "..." : "Enable OAuth"}
                          </button>
                        )}
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
                      <div className="flex items-center space-x-2">
                        <span className="capitalize">{source.type}</span>
                        {source.hasOAuthCredentials && (
                          <span className="text-green-600 font-medium">✓ OAuth Enabled</span>
                        )}
                      </div>
                      <span>
                        {source.lastSynced 
                          ? `Last synced: ${new Date(source.lastSynced).toLocaleString()}`
                          : "Never synced"
                        }
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2 text-xs">
                      <span className="text-slate-500">
                        Sync frequency: {formatSyncInterval(source.syncInterval)}
                      </span>
                      <SyncIntervalEditor source={source} />
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