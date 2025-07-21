import { useEffect, useRef, useState, useCallback } from 'react';
import type { CalendarSource } from '@shared/schema';

interface SyncResult {
  calendar: string;
  success: boolean;
  message?: string;
  error?: string;
  eventsCount?: number;
}

interface SyncStatus {
  isActive: boolean;
  lastSync: Date | null;
  errorCount: number;
  restartCount: number;
  lastResults: SyncResult[];
}

interface UseSyncWorkerReturn {
  status: SyncStatus;
  triggerSync: () => void;
  restartWorker: () => void;
}

export function useSyncWorker(calendars: CalendarSource[]): UseSyncWorkerReturn {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<SyncStatus>({
    isActive: false,
    lastSync: null,
    errorCount: 0,
    restartCount: 0,
    lastResults: [],
  });

  // Initialize worker
  useEffect(() => {
    const initWorker = () => {
      try {
        workerRef.current = new Worker('/sync-worker.js');
        
        workerRef.current.onmessage = (e) => {
          const { type, payload } = e.data;
          
          switch (type) {
            case 'SYNC_COMPLETED':
              setStatus(prev => ({
                ...prev,
                isActive: true,
                lastSync: new Date(payload.timestamp),
                lastResults: payload.results,
              }));
              break;
              
            case 'SYNC_ERROR':
              console.warn('Sync worker error:', payload.error);
              setStatus(prev => ({
                ...prev,
                errorCount: prev.errorCount + 1,
              }));
              break;
              
            case 'SYNC_WORKER_RESTARTED':
              console.log('Sync worker restarted at:', payload.timestamp);
              setStatus(prev => ({
                ...prev,
                restartCount: prev.restartCount + 1,
                errorCount: 0,
              }));
              break;
              
            case 'SYNC_WORKER_FATAL_ERROR':
              console.error('Sync worker fatal error:', payload.error);
              setStatus(prev => ({
                ...prev,
                isActive: false,
                errorCount: prev.errorCount + 1,
              }));
              // Try to restart worker after fatal error
              setTimeout(initWorker, 30000);
              break;
          }
        };
        
        workerRef.current.onerror = (error) => {
          console.error('Sync worker script error:', error);
          setStatus(prev => ({
            ...prev,
            isActive: false,
            errorCount: prev.errorCount + 1,
          }));
        };
        
        // Start the worker
        workerRef.current.postMessage({ type: 'START_SYNC_WORKER' });
        
      } catch (error) {
        console.error('Failed to initialize sync worker:', error);
        setStatus(prev => ({
          ...prev,
          isActive: false,
          errorCount: prev.errorCount + 1,
        }));
      }
    };

    // Only initialize if there are calendars to sync
    if (calendars.length > 0) {
      initWorker();
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'STOP_SYNC_WORKER' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [calendars.length > 0]);

  // Update calendars in worker when they change
  useEffect(() => {
    if (workerRef.current && calendars.length > 0) {
      workerRef.current.postMessage({
        type: 'UPDATE_CALENDARS',
        payload: calendars
      });
    }
  }, [calendars]);

  const triggerSync = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'TRIGGER_IMMEDIATE_SYNC' });
    }
  }, []);

  const restartWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'RESTART_SYNC_WORKER' });
    }
  }, []);

  return {
    status,
    triggerSync,
    restartWorker,
  };
}