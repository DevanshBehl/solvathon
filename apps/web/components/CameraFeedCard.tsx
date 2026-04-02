'use client';

import { useEffect, useRef, useState } from 'react';
import type { CameraStatusPayload } from '@hostel-monitor/types';
import { useCameraStore } from '@/stores/cameraStore';

interface CameraFeedProps {
  camera: { id: string; label: string; description: string | null };
  track: MediaStreamTrack | null;
  hasAlert: boolean;
}

export default function CameraFeedCard({ camera, track, hasAlert }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isOnline = useCameraStore(state => state.onlineStatus.get(camera.id) ?? true);

  useEffect(() => {
    if (videoRef.current) {
      if (track) {
        const stream = new MediaStream([track]);
        videoRef.current.srcObject = stream;
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [track]);

  return (
    <div className={`camera-feed-card flex flex-col h-full bg-surface-elevated/50 ${hasAlert ? 'has-alert' : ''}`}>
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        {track ? (
          <>
            <div className="live-badge">LIVE</div>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <svg className="w-8 h-8 text-text-secondary mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-mono text-text-secondary uppercase flex items-center gap-2">
                {!isOnline ? 'Offline' : (
                   <>
                       <div className="w-3 h-3 border-2 border-text-secondary border-t-accent-blue rounded-full animate-spin" />
                       Connecting
                   </>
                )}
            </span>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border flex justify-between items-center bg-surface shrink-0">
        <div className="flex flex-col">
            <span className="text-sm font-mono font-bold text-white">{camera.label}</span>
            <span className="text-xs text-text-secondary truncate max-w-[200px]">{camera.description || 'No description'}</span>
        </div>
        <div className="flex items-center gap-2">
           {hasAlert && <span className="w-2 h-2 rounded-full bg-alert-red animate-pulse" />}
        </div>
      </div>
    </div>
  );
}
