// Reminder processing web worker
class ReminderWorker {
  constructor() {
    this.events = [];
    this.checkedReminders = new Set();
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
    this.events = newEvents;
    // Reset retry count on successful data update
    this.retryCount = 0;
  }

  addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
  }

  addHours(date, hours) {
    return new Date(date.getTime() + hours * 3600000);
  }

  addDays(date, days) {
    return new Date(date.getTime() + days * 86400000);
  }

  processReminders() {
    try {
      const now = new Date();
      const triggeredReminders = [];
      

      
      this.events.forEach((event) => {
        if (!event.reminders || event.reminders.length === 0) return;

        const eventStart = new Date(event.startTime);
        
        event.reminders.forEach((reminderText) => {
          let reminderTime = null;

          // Parse reminder text to calculate time
          if (reminderText.includes("1 minute")) {
            reminderTime = this.addMinutes(eventStart, -1);
          } else if (reminderText.includes("5 minutes")) {
            reminderTime = this.addMinutes(eventStart, -5);
          } else if (reminderText.includes("15 minutes")) {
            reminderTime = this.addMinutes(eventStart, -15);
          } else if (reminderText.includes("30 minutes")) {
            reminderTime = this.addMinutes(eventStart, -30);
          } else if (reminderText.includes("1 hour")) {
            reminderTime = this.addHours(eventStart, -1);
          } else if (reminderText.includes("1 day")) {
            reminderTime = this.addDays(eventStart, -1);
          }

          if (reminderTime) {
            const reminderId = `${event.id}-${reminderText}-${reminderTime.getTime()}`;
            
            // Check if reminder should trigger - extended window for missed notifications
            const timeDiff = now.getTime() - reminderTime.getTime();
            const shouldTrigger = timeDiff >= 0 && timeDiff <= 900000; // Within 15 minutes
            
            if (shouldTrigger && !this.checkedReminders.has(reminderId)) {
              triggeredReminders.push({
                event,
                reminderText,
                reminderTime,
                id: reminderId,
              });
              
              this.checkedReminders.add(reminderId);
            }
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

  restart() {
    // Reset state and restart
    this.retryCount = 0;
    this.checkedReminders.clear();
    
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