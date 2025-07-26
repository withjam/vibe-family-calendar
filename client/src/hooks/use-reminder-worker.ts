import { useEffect, useRef, useState, useCallback } from 'react';
import type { Event } from '@shared/schema';

interface TriggeredReminder {
  event: Event;
  reminderText: string;
  reminderTime: Date;
  id: string;
}

interface WorkerStatus {
  isActive: boolean;
  lastHeartbeat: Date | null;
  errorCount: number;
  restartCount: number;
}

interface UseReminderWorkerReturn {
  status: WorkerStatus;
  triggeredReminders: TriggeredReminder[];
  clearReminders: () => void;
  restartWorker: () => void;
}

export function useReminderWorker(events: Event[]): UseReminderWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<WorkerStatus>({
    isActive: false,
    lastHeartbeat: null,
    errorCount: 0,
    restartCount: 0,
  });
  const [triggeredReminders, setTriggeredReminders] = useState<TriggeredReminder[]>([]);

  // Initialize worker
  useEffect(() => {
    const initWorker = () => {
      try {
        workerRef.current = new Worker('/reminder-worker.js');
        
        workerRef.current.onmessage = (e) => {
          const { type, payload } = e.data;
          
          switch (type) {
            case 'REMINDERS_TRIGGERED':
              console.log('[Hook] Received triggered reminders from worker:', payload);
              setTriggeredReminders(prev => [...prev, ...payload]);
              break;
              
            case 'WORKER_HEARTBEAT':
              setStatus(prev => ({
                ...prev,
                isActive: true,
                lastHeartbeat: new Date(payload.timestamp),
              }));
              break;
              
            case 'WORKER_ERROR':
              console.warn('Reminder worker error:', payload.error);
              setStatus(prev => ({
                ...prev,
                errorCount: prev.errorCount + 1,
              }));
              break;
              
            case 'WORKER_RESTARTED':
              console.log('Reminder worker restarted at:', payload.timestamp);
              setStatus(prev => ({
                ...prev,
                restartCount: prev.restartCount + 1,
                errorCount: 0,
              }));
              break;
              
            case 'WORKER_FATAL_ERROR':
              console.error('Reminder worker fatal error:', payload.error);
              setStatus(prev => ({
                ...prev,
                isActive: false,
                errorCount: prev.errorCount + 1,
              }));
              // Try to restart worker after fatal error
              setTimeout(initWorker, 10000);
              break;
          }
        };
        
        workerRef.current.onerror = (error) => {
          console.error('Reminder worker script error:', error);
          setStatus(prev => ({
            ...prev,
            isActive: false,
            errorCount: prev.errorCount + 1,
          }));
        };
        
        // Start the worker
        workerRef.current.postMessage({ type: 'START_WORKER' });
        
      } catch (error) {
        console.error('Failed to initialize reminder worker:', error);
        setStatus(prev => ({
          ...prev,
          isActive: false,
          errorCount: prev.errorCount + 1,
        }));
      }
    };

    initWorker();

    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'STOP_WORKER' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // Update events in worker when they change
  useEffect(() => {
    if (workerRef.current && events.length > 0) {
      console.log('[Hook] Sending events to worker:', events.length, events);
      workerRef.current.postMessage({
        type: 'UPDATE_EVENTS',
        payload: events
      });
    }
  }, [events]);

  // Heartbeat monitoring - restart if no heartbeat for 2 minutes
  useEffect(() => {
    const heartbeatCheck = setInterval(() => {
      if (status.lastHeartbeat) {
        const timeSinceLastHeartbeat = Date.now() - status.lastHeartbeat.getTime();
        if (timeSinceLastHeartbeat > 120000 && status.isActive) { // 2 minutes
          console.warn('Reminder worker appears inactive, restarting...');
          restartWorker();
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(heartbeatCheck);
  }, [status.lastHeartbeat, status.isActive]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && workerRef.current) {
        // Clear checked reminders when page becomes visible to catch missed notifications
        workerRef.current.postMessage({ type: 'CLEAR_CHECKED_REMINDERS' });
      }
    };

    const handleFocus = () => {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'CLEAR_CHECKED_REMINDERS' });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const clearReminders = useCallback(() => {
    setTriggeredReminders([]);
  }, []);

  const restartWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'RESTART_WORKER' });
    }
  }, []);

  return {
    status,
    triggeredReminders,
    clearReminders,
    restartWorker,
  };
}