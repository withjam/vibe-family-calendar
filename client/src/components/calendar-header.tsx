import { format } from "date-fns";
import { useState } from "react";
import { MonthYearPicker } from "./month-year-picker";

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
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);

  const handleMonthYearSelect = (date: Date) => {
    const monthsDiff = date.getMonth() - currentDate.getMonth();
    const yearsDiff = date.getFullYear() - currentDate.getFullYear();
    
    if (yearsDiff !== 0) {
      // Navigate years first
      for (let i = 0; i < Math.abs(yearsDiff); i++) {
        onNavigateYear(yearsDiff > 0 ? "next" : "prev");
      }
    }
    
    // Then navigate months
    for (let i = 0; i < Math.abs(monthsDiff); i++) {
      onNavigateMonth(monthsDiff > 0 ? "next" : "prev");
    }
    
    setShowMonthYearPicker(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => onNavigateMonth("prev")}
            className="touch-target ripple-effect bg-primary text-primary-foreground rounded-lg px-4 hover:bg-blue-700 transition-colors font-semibold"
          >
            ◀
          </button>

          <button
            onClick={() => setShowMonthYearPicker(true)}
            className="text-center min-w-[200px] hover:bg-slate-100 rounded-lg px-4 py-2 transition-colors cursor-pointer"
          >
            <h1 className="text-2xl font-bold text-slate-800">
              {format(currentDate, "MMMM yyyy")}
            </h1>
          </button>

          <button
            onClick={() => onNavigateMonth("next")}
            className="touch-target ripple-effect bg-primary text-primary-foreground rounded-lg px-4 hover:bg-blue-700 transition-colors font-semibold"
          >
            ▶
          </button>
        </div>

        {/* Toast notifications area in the center */}
        <div className="flex-1 flex justify-center items-center px-4">
          <div id="toast-container" className="max-w-md w-full"></div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onShowReminders}
            className="touch-target ripple-effect bg-amber-600 text-white rounded-lg px-4 py-3 font-semibold hover:bg-amber-700 transition-colors"
          >
            Reminders
          </button>
          <button
            onClick={onImportCalendars}
            className="touch-target ripple-effect bg-purple-600 text-white rounded-lg px-4 py-3 font-semibold hover:bg-purple-700 transition-colors"
          >
            Import
          </button>
          <button
            onClick={onSearchEvents}
            className="touch-target ripple-effect bg-blue-600 text-white rounded-lg px-4 py-3 font-semibold hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
          <button
            onClick={onAddEvent}
            className="touch-target ripple-effect bg-green-600 text-white rounded-lg px-4 py-3 font-semibold hover:bg-green-700 transition-colors"
          >
            Add Event
          </button>
        </div>
      </div>

      {showMonthYearPicker && (
        <MonthYearPicker
          currentDate={currentDate}
          onSelect={handleMonthYearSelect}
          onClose={() => setShowMonthYearPicker(false)}
        />
      )}
    </div>
  );
}
