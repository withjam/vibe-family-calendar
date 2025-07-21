import { format } from "date-fns";

interface CalendarHeaderProps {
  currentDate: Date;
  onNavigateMonth: (direction: "prev" | "next") => void;
  onNavigateYear: (direction: "prev" | "next") => void;
  onAddEvent: () => void;
  onSearchEvents: () => void;
  onImportCalendars: () => void;
  onShowReminders: () => void;
}

export function CalendarHeader({
  currentDate,
  onNavigateMonth,
  onNavigateYear,
  onAddEvent,
  onSearchEvents,
  onImportCalendars,
  onShowReminders,
}: CalendarHeaderProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => onNavigateYear("prev")}
            className="touch-target ripple-effect bg-primary text-primary-foreground rounded-lg px-4 hover:bg-blue-700 transition-colors font-semibold"
          >
            ◀◀
          </button>
          <button
            onClick={() => onNavigateMonth("prev")}
            className="touch-target ripple-effect bg-primary text-primary-foreground rounded-lg px-4 hover:bg-blue-700 transition-colors font-semibold"
          >
            ◀
          </button>

          <div className="text-center min-w-[200px]">
            <h1 className="text-2xl font-bold text-slate-800">
              {format(currentDate, "MMMM yyyy")}
            </h1>
          </div>

          <button
            onClick={() => onNavigateMonth("next")}
            className="touch-target ripple-effect bg-primary text-primary-foreground rounded-lg px-4 hover:bg-blue-700 transition-colors font-semibold"
          >
            ▶
          </button>
          <button
            onClick={() => onNavigateYear("next")}
            className="touch-target ripple-effect bg-primary text-primary-foreground rounded-lg px-4 hover:bg-blue-700 transition-colors font-semibold"
          >
            ▶▶
          </button>
        </div>

        {/* Toast notifications area in the center */}
        <div className="flex-1 flex justify-center items-center px-4">
          <div id="toast-container" className="max-w-md w-full"></div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onShowReminders}
            className="touch-target ripple-effect bg-amber-600 text-white rounded-lg px-4 py-3 font-semibold hover:bg-amber-700 transition-colors flex items-center space-x-2"
          >
            <span>🔔</span>
            <span>Reminders</span>
          </button>
          <button
            onClick={onImportCalendars}
            className="touch-target ripple-effect bg-purple-600 text-white rounded-lg px-4 py-3 font-semibold hover:bg-purple-700 transition-colors flex items-center space-x-2"
          >
            <span>📥</span>
            <span>Import</span>
          </button>
          <button
            onClick={onAddEvent}
            className="touch-target ripple-effect bg-emerald-600 text-white rounded-lg px-4 py-3 font-semibold hover:bg-emerald-700 transition-colors flex items-center space-x-2"
          >
            <span>+</span>
            <span>Add Event</span>
          </button>
          <button
            onClick={onSearchEvents}
            className="touch-target ripple-effect bg-slate-600 text-white rounded-lg px-4 py-3 font-semibold hover:bg-slate-700 transition-colors flex items-center space-x-2"
          >
            <span>🔍</span>
            <span>Search</span>
          </button>
        </div>
      </div>
    </div>
  );
}
