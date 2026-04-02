'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MotionCard, StatusDot, fadeIn, fadeInUp, staggerContainer } from '@hostel-monitor/ui';

interface HostelData {
  id: string;
  name: string;
  floors: number;
  onlineCameras: number;
  activeAlerts: number;
  color: string;
}

export default function LandingPage() {
  const [hostels, setHostels] = useState<HostelData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/hostels')
      .then((res) => res.json())
      .then((data) => {
        setHostels(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching hostels:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen pt-20 px-8 pb-12 flex flex-col items-center">
      {/* Header */}
      <nav className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10 glass">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center border border-accent-blue glow-blue">
            <ScanIcon className="text-accent-blue" />
          </div>
          <span className="font-mono font-bold tracking-tight text-xl">HMS<span className="text-accent-blue">.SYS</span></span>
        </div>
        <Link href="/login" className="px-5 py-2 rounded-lg bg-surface border border-border text-sm font-medium hover:bg-surface-elevated transition-colors glow-blue hover:text-white">
          System Login
        </Link>
      </nav>

      {/* Hero Content */}
      <motion.div 
        className="max-w-4xl w-full text-center mt-20 mb-16"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-elevated border border-border text-xs mb-8">
          <StatusDot status="online" size="sm" />
          <span className="font-mono text-text-secondary">SYSTEM ACTIVE_</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-text-secondary">
          Global Surveillance <br />
          <span className="text-gradient">Control Matrix</span>
        </h1>
        <p className="text-xl text-text-secondary font-light max-w-2xl mx-auto">
          Real-time SFU multi-camera streaming and machine-learning threat detection infrastructure for campus security.
        </p>
      </motion.div>

      {/* Grid */}
      {loading ? (
        <div className="w-full flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent-blue"></div>
        </div>
      ) : (
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl z-10"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {hostels.map((hostel) => (
            <Link key={hostel.id} href={`/hostel/${hostel.id}`}>
              <MotionCard 
                variants={fadeInUp}
                className="p-6 cursor-pointer group hover:border-gray-600 transition-colors bg-black/60 backdrop-blur-xl relative overflow-hidden"
                style={{ 
                    '--hover-color': hostel.color,
                } as React.CSSProperties}
              >
                 <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: hostel.color }} />
                 <div className="absolute top-0 left-0 w-full h-full opacity-0 group-hover:opacity-5 transition-opacity" style={{ backgroundColor: hostel.color }} />
                
                 <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-bold font-mono group-hover:text-white transition-colors">{hostel.name}</h2>
                        <p className="text-text-secondary text-sm mt-1">{hostel.floors} Floors Sector</p>
                    </div>
                    <StatusDot 
                        status={hostel.activeAlerts > 0 ? 'critical' : 'online'} 
                        size="md" 
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface rounded-lg p-3 border border-border">
                        <p className="text-xs text-text-secondary mb-1">Live Cameras</p>
                        <p className="text-xl font-mono font-medium">{hostel.onlineCameras}</p>
                    </div>
                    <div className="bg-surface rounded-lg p-3 border border-border">
                        <p className="text-xs text-text-secondary mb-1">Active Alerts</p>
                        <p className={`text-xl font-mono font-medium ${hostel.activeAlerts > 0 ? 'text-alert-red' : ''}`}>
                            {hostel.activeAlerts}
                        </p>
                    </div>
                 </div>
              </MotionCard>
            </Link>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function ScanIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
            <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
            <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
            <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
            <path d="M7 12h10"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>
    )
}
