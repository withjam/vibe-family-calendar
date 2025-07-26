// Reminder processing web worker
class ReminderWorker {
  constructor() {
    this.events = [];
    this.checkedReminders = new Set();
    this.dismissedReminders = new Set(); // Track permanently dismissed reminders
    this.retryCount = 0;
    this.maxRetries = 5;
    this.baseRetryDelay = 1000; // Start with 1 second
    this.checkInterval = 15000; // 15 seconds
    this.intervalId = null;
    this.isRunning = false;
    
    this.startProcessing();
  }

  startProcessing() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.scheduleNextCheck();
  }

  stopProcessing() {
    this.isRunning = false;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }

  scheduleNextCheck() {
    if (!this.isRunning) return;
    
    // Calculate delay with exponential backoff if there were failures
    let delay = this.checkInterval;
    if (this.retryCount > 0) {
      delay = Math.min(this.baseRetryDelay * Math.pow(2, this.retryCount), 300000); // Max 5 minutes
    }
    
    this.intervalId = setTimeout(() => {
      this.processReminders();
    }, delay);
  }

  updateEvents(newEvents) {
    console.log(`[Worker] Received ${newEvents.length} events for reminder processing`);
    
    // Parse reminder strings into numeric offsets for more flexible processing
    const eventsWithParsedReminders = newEvents.map(event => ({
      ...event,
      parsedReminders: this.parseReminders(event.reminders || [])
    }));
    
    // If this is the first time receiving events, mark all past reminders as already processed
    // to prevent notification spam on app load
    if (this.events.length === 0) {
      this.initializePastReminders(eventsWithParsedReminders);
    }
    
    this.events = eventsWithParsedReminders;
    // Reset retry count on successful data update
    this.retryCount = 0;
  }

  parseReminders(reminders) {
    return reminders.map(reminderText => {
      let offsetMinutes = 0;
      
      // Parse reminder text to extract numeric offset in minutes
      // Check most specific patterns first to avoid conflicts
      if (reminderText.includes("15 minutes")) {
        offsetMinutes = 15;
      } else if (reminderText.includes("30 minutes")) {
        offsetMinutes = 30;
      } else if (reminderText.includes("5 minutes")) {
        offsetMinutes = 5;
      } else if (reminderText.includes("2 minutes")) {
        offsetMinutes = 2;
      } else if (reminderText.includes("1 minute")) {
        offsetMinutes = 1;
      } else if (reminderText.includes("1 hour")) {
        offsetMinutes = 60;
      } else if (reminderText.includes("1 day")) {
        offsetMinutes = 1440; // 24 * 60
      }
      
      return {
        text: reminderText,
        offsetMinutes: offsetMinutes
      };
    }).filter(reminder => reminder.offsetMinutes > 0); // Filter out unparseable reminders
  }

  initializePastReminders(events) {
    const now = new Date();
    console.log(`[Worker] Initializing past reminders to prevent notification spam`);
    
    events.forEach((event) => {
      if (!event.parsedReminders || event.parsedReminders.length === 0) return;

      const eventStart = new Date(event.startTime);
      
      event.parsedReminders.forEach((reminder) => {
        const reminderTime = this.addMinutes(eventStart, -reminder.offsetMinutes);
        const reminderId = `${event.id}-${reminder.text}-${reminderTime.getTime()}`;
        
        // If reminder time has passed by more than 2 minutes, mark it as already checked
        const timeDiff = now.getTime() - reminderTime.getTime();
        if (timeDiff > 120000) { // More than 2 minutes ago
          this.checkedReminders.add(reminderId);
        }
      });
    });
    
    console.log(`[Worker] Marked ${this.checkedReminders.size} past reminders as already processed`);
  }

  addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
  }

  processReminders() {
    try {
      const now = new Date();
      const triggeredReminders = [];
      

      
      this.events.forEach((event) => {
        if (!event.parsedReminders || event.parsedReminders.length === 0) return;

        const eventStart = new Date(event.startTime);
        
        event.parsedReminders.forEach((reminder) => {
          const reminderTime = this.addMinutes(eventStart, -reminder.offsetMinutes);
          const reminderId = `${event.id}-${reminder.text}-${reminderTime.getTime()}`;
          
          // Check if reminder should trigger - only current reminders, no past ones
          const timeDiff = now.getTime() - reminderTime.getTime();
          const shouldTrigger = timeDiff >= 0 && timeDiff <= 120000; // Within 2 minutes only
          
          // Also check if this reminder hasn't been permanently dismissed and isn't already triggered
          if (shouldTrigger && !this.checkedReminders.has(reminderId) && !this.dismissedReminders.has(reminderId)) {
            triggeredReminders.push({
              event,
              reminderText: reminder.text,
              reminderTime,
              id: reminderId,
            });
            
            // Mark as triggered to prevent repeated notifications
            this.checkedReminders.add(reminderId);
          }
        });
      });

      // Send triggered reminders to main thread
      if (triggeredReminders.length > 0) {
        self.postMessage({
          type: 'REMINDERS_TRIGGERED',
          payload: triggeredReminders
        });
      }

      // Send heartbeat to main thread
      self.postMessage({
        type: 'WORKER_HEARTBEAT',
        payload: { 
          timestamp: now.toISOString(),
          eventsCount: this.events.length,
          checkedCount: this.checkedReminders.size
        }
      });

      // Reset retry count on success
      this.retryCount = 0;
      
    } catch (error) {
      // Handle errors with exponential backoff
      this.retryCount = Math.min(this.retryCount + 1, this.maxRetries);
      
      self.postMessage({
        type: 'WORKER_ERROR',
        payload: { 
          error: error.message,
          retryCount: this.retryCount,
          nextRetryIn: Math.min(this.baseRetryDelay * Math.pow(2, this.retryCount), 300000)
        }
      });
      
      // If max retries reached, restart the worker
      if (this.retryCount >= this.maxRetries) {
        this.restart();
        return;
      }
    }
    
    // Schedule next check
    this.scheduleNextCheck();
  }

  dismissReminder(reminderId) {
    // Mark this specific reminder as permanently dismissed
    this.dismissedReminders.add(reminderId);
    this.checkedReminders.add(reminderId);
  }

  restart() {
    // Reset state and restart
    this.retryCount = 0;
    this.checkedReminders.clear();
    // Keep dismissed reminders to prevent re-triggering permanently dismissed notifications
    
    self.postMessage({
      type: 'WORKER_RESTARTED',
      payload: { timestamp: new Date().toISOString() }
    });
    
    // Restart processing after a brief delay
    setTimeout(() => {
      this.startProcessing();
    }, 5000);
  }
}

// Initialize worker
const worker = new ReminderWorker();

// Handle messages from main thread
self.onmessage = function(e) {
  const { type, payload } = e.data;
  
  switch (type) {
    case 'UPDATE_EVENTS':
      worker.updateEvents(payload);
      break;
      
    case 'START_WORKER':
      worker.startProcessing();
      break;
      
    case 'STOP_WORKER':
      worker.stopProcessing();
      break;
      
    case 'RESTART_WORKER':
      worker.restart();
      break;
      
    case 'CLEAR_CHECKED_REMINDERS':
      worker.checkedReminders.clear();
      break;
      
    case 'DISMISS_REMINDER':
      worker.dismissReminder(payload.reminderId);
      break;
      
    default:
      console.warn('Unknown message type:', type);
  }
};

// Handle worker errors
self.onerror = function(error) {
  self.postMessage({
    type: 'WORKER_FATAL_ERROR',
    payload: { error: error.message }
  });
};