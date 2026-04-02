'use client';

import { motion } from 'framer-motion';
import CameraFeedCard from './CameraFeedCard';
import { Button } from '@hostel-monitor/ui';
import { ALERT_TYPE_EMOJI, ALERT_TYPE_LABEL, SEVERITY_COLOR } from '@hostel-monitor/types';

interface CameraModalProps {
  camera: any;
  track: MediaStreamTrack | null;
  alerts: any[];
  onClose: () => void;
  onResolve: (alertId: string) => void;
  resolvingAlertId: string | null;
}

export default function CameraModal({ camera, track, alerts, onClose, onResolve, resolvingAlertId }: CameraModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm">
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6 bg-surface border border-border rounded-xl shadow-2xl relative overflow-hidden"
        >
            <div className="absolute top-4 right-4 z-10">
                <button onClick={onClose} className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/80 transition-colors">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            {/* Main Feed */}
            <div className="lg:col-span-2 aspect-video lg:aspect-auto h-full min-h-[400px]">
                <CameraFeedCard camera={camera} track={track} hasAlert={alerts.some(a => !a.resolved)} />
            </div>
            
            {/* Intel Panel */}
            <div className="p-6 flex flex-col h-full max-h-[80vh] overflow-hidden bg-surface-elevated">
                <div className="mb-6 shrink-0">
                    <h2 className="text-2xl font-mono tracking-tight text-white mb-2">{camera.label}</h2>
                    <div className="flex gap-4 text-sm font-mono text-text-secondary">
                        <span>{camera.hostelName || `Hostel ${camera.floor?.hostelId}`}</span>
                        <span>•</span>
                        <span>Floor {camera.floor?.number || camera.floorNumber}</span>
                    </div>
                    {camera.description && <p className="mt-3 text-sm text-text-primary bg-surface p-3 rounded-lg border border-border">{camera.description}</p>}
                </div>
                
                <h3 className="text-sm font-mono uppercase text-text-secondary mb-4 flex items-center gap-2 shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    Incident History
                </h3>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-thin">
                    {alerts.length === 0 ? (
                        <p className="text-sm text-text-secondary font-mono italic">No recorded incidents.</p>
                    ) : (
                        alerts.map(alert => (
                            <div key={alert.id} className={`p-4 rounded-lg border ${!alert.resolved ? 'bg-surface border-alert-red/30 glow-red' : 'bg-surface border-border opacity-70'}`}>
                                <div className="flex justify-between items-start mb-2">
                                     <div className="flex items-center gap-2">
                                        <span className="text-xl">{ALERT_TYPE_EMOJI[alert.type]}</span>
                                        <span className={`font-bold ${!alert.resolved ? 'text-white' : 'text-text-secondary'}`}>{ALERT_TYPE_LABEL[alert.type]}</span>
                                     </div>
                                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SEVERITY_COLOR[alert.severity as keyof typeof SEVERITY_COLOR] || '#888' }} />
                                </div>
                                
                                <p className="text-xs text-text-secondary mt-2 mb-3 leading-relaxed">{alert.description}</p>
                                
                                {alert.thumbnail && (
                                    <div className="w-full h-24 bg-black rounded overflow-hidden mb-3 border border-border">
                                        <img src={`data:image/jpeg;base64,${alert.thumbnail}`} className="w-full h-full object-cover" alt="Event frame" />
                                    </div>
                                )}
                                
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/50">
                                    <span className="text-[10px] font-mono text-text-secondary">
                                        {new Date(alert.createdAt).toLocaleString()}
                                    </span>
                                    {!alert.resolved ? (
                                        <Button 
                                            size="sm" 
                                            variant="secondary" 
                                            className="h-7 text-xs px-3"
                                            onClick={() => onResolve(alert.id)}
                                            loading={resolvingAlertId === alert.id}
                                        >
                                            Resolve
                                        </Button>
                                    ) : (
                                        <span className="text-[10px] uppercase font-mono text-online-green bg-online-green/10 px-2 py-1 rounded">Resolved</span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </motion.div>
    </div>
  );
}
