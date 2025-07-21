// Calendar synchronization web worker
class SyncWorker {
  constructor() {
    this.syncInterval = 300000; // 5 minutes
    this.retryCount = 0;
    this.maxRetries = 3;
    this.baseRetryDelay = 10000; // Start with 10 seconds
    this.intervalId = null;
    this.isRunning = false;
    this.calendars = [];
    
    this.startSyncing();
  }

  startSyncing() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.scheduleNextSync();
  }

  stopSyncing() {
    this.isRunning = false;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }

  scheduleNextSync() {
    if (!this.isRunning) return;
    
    // Calculate delay with exponential backoff if there were failures
    let delay = this.syncInterval;
    if (this.retryCount > 0) {
      delay = Math.min(this.baseRetryDelay * Math.pow(2, this.retryCount), 1800000); // Max 30 minutes
    }
    
    this.intervalId = setTimeout(() => {
      this.syncCalendars();
    }, delay);
  }

  updateCalendars(calendars) {
    this.calendars = calendars;
    // Reset retry count when calendars are updated
    this.retryCount = 0;
  }

  async syncCalendars() {
    if (this.calendars.length === 0) {
      this.scheduleNextSync();
      return;
    }

    try {
      const syncResults = [];
      
      for (const calendar of this.calendars) {
        try {
          const response = await fetch(`/api/calendar-sources/${calendar.id}/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const result = await response.json();
            syncResults.push({
              calendar: calendar.name,
              success: true,
              message: result.message || 'Sync successful',
              eventsCount: result.eventsCount || 0,
            });
          } else {
            const errorText = await response.text();
            syncResults.push({
              calendar: calendar.name,
              success: false,
              error: `HTTP ${response.status}: ${errorText}`,
            });
          }
        } catch (error) {
          syncResults.push({
            calendar: calendar.name,
            success: false,
            error: error.message,
          });
        }
      }
      
      // Send results to main thread
      self.postMessage({
        type: 'SYNC_COMPLETED',
        payload: {
          timestamp: new Date().toISOString(),
          results: syncResults,
          successCount: syncResults.filter(r => r.success).length,
          errorCount: syncResults.filter(r => !r.success).length,
        }
      });

      // Reset retry count on successful completion
      this.retryCount = 0;
      
    } catch (error) {
      // Handle sync errors with exponential backoff
      this.retryCount = Math.min(this.retryCount + 1, this.maxRetries);
      
      self.postMessage({
        type: 'SYNC_ERROR',
        payload: { 
          error: error.message,
          retryCount: this.retryCount,
          nextRetryIn: Math.min(this.baseRetryDelay * Math.pow(2, this.retryCount), 1800000)
        }
      });
      
      // If max retries reached, restart the worker
      if (this.retryCount >= this.maxRetries) {
        this.restart();
        return;
      }
    }
    
    // Schedule next sync
    this.scheduleNextSync();
  }

  restart() {
    // Reset state and restart
    this.retryCount = 0;
    
    self.postMessage({
      type: 'SYNC_WORKER_RESTARTED',
      payload: { timestamp: new Date().toISOString() }
    });
    
    // Restart syncing after a brief delay
    setTimeout(() => {
      this.startSyncing();
    }, 30000); // 30 second delay before restart
  }
}

// Initialize worker
const syncWorker = new SyncWorker();

// Handle messages from main thread
self.onmessage = function(e) {
  const { type, payload } = e.data;
  
  switch (type) {
    case 'UPDATE_CALENDARS':
      syncWorker.updateCalendars(payload);
      break;
      
    case 'START_SYNC_WORKER':
      syncWorker.startSyncing();
      break;
      
    case 'STOP_SYNC_WORKER':
      syncWorker.stopSyncing();
      break;
      
    case 'RESTART_SYNC_WORKER':
      syncWorker.restart();
      break;
      
    case 'TRIGGER_IMMEDIATE_SYNC':
      syncWorker.syncCalendars();
      break;
      
    default:
      console.warn('Unknown sync worker message type:', type);
  }
};

// Handle worker errors
self.onerror = function(error) {
  self.postMessage({
    type: 'SYNC_WORKER_FATAL_ERROR',
    payload: { error: error.message }
  });
};