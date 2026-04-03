'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@hostel-monitor/ui';

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative w-full bg-background overflow-x-hidden">
      {/* Dynamic Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent-violet/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Navbar */}
      <nav className="w-full flex items-center justify-between px-8 py-5 border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-12">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-none border-2 border-accent-violet flex items-center justify-center box-glow-violet">
              <div className="w-2 h-2 bg-accent-cyan" />
            </div>
            <span className="font-display font-bold text-xl tracking-tighter text-white">HMS.SYS</span>
          </Link>
          
          {/* Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-mono text-text-secondary">
            <Link href="/" className="text-white">Home</Link>
            <Link href="#" className="hover:text-white transition-colors">Documentation</Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="primary" size="sm" className="rounded-full px-6 bg-white text-black hover:bg-gray-200">
              Get Access
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center pt-32 pb-24 px-6 relative z-10 text-center">
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-block py-1 px-3 mb-6 border border-border bg-surface text-accent-cyan font-mono text-xs uppercase tracking-widest text-center">
              System v2.0 Online
            </span>
          </motion.div>

          <motion.h1 
            className="text-6xl md:text-[80px] font-display font-bold uppercase leading-[0.9] mb-8 text-white tracking-tighter"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            A Single Point of Clarity <br /> For Every Camera.
          </motion.h1>

          <motion.p 
            className="text-text-secondary text-lg font-mono leading-relaxed max-w-2xl mb-10"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            HMS maps sector health, resolves video processing, and coordinates tactical logic across all your connected IP feeds. Everything converges into one consistent, navigable view.
          </motion.p>

          <motion.div 
            className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link href="/login">
              <Button size="lg" className="h-14 px-8 text-base bg-white text-black hover:bg-gray-200 min-w-[200px]">
                Initialize Protocol
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" size="lg" className="h-14 px-8 text-base border border-border hover:bg-surface-elevated min-w-[200px]">
                View Dashboard
              </Button>
            </Link>
          </motion.div>
        
        </div>
      </main>

      {/* Infinite Marquee */}
      <div className="marquee-container text-text-secondary font-mono text-xs uppercase tracking-widest">
        <div className="marquee-content gap-12">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-12">
              <span>Secure Your Active Sectors</span>
              <div className="w-1.5 h-1.5 bg-accent-violet rounded-full" />
              <span>Real-Time WebRTC Tunnels</span>
              <div className="w-1.5 h-1.5 bg-accent-cyan rounded-full" />
              <span>Zero-Latency Processing</span>
              <div className="w-1.5 h-1.5 bg-accent-violet rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Feature Section Grid */}
      <section className="w-full py-32 px-6 lg:px-12 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-display font-bold uppercase leading-tight tracking-tight text-white mb-6">
              Built to Understand Your <br /> Sectors Instantly
            </h2>
            <p className="text-text-secondary font-mono">No configuration files. Just plug the RTSP streams and monitor.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Feature Card 1 */}
            <div className="glass p-8 flex flex-col group hover:-translate-y-1 hover:border-accent-violet transition-all duration-300">
              <div className="w-12 h-12 mb-6 text-accent-violet group-hover:glow-violet transition-all">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <h3 className="text-xl font-display font-bold text-white mb-3">Absolute Topology</h3>
              <p className="text-text-secondary font-mono text-sm leading-relaxed">
                Automatically maps relationships between endpoints, servers, and streams so you never lose context during tactical operations.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="glass p-8 flex flex-col group hover:-translate-y-1 hover:border-accent-cyan transition-all duration-300">
              <div className="w-12 h-12 mb-6 text-accent-cyan group-hover:glow-cyan transition-all">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <h3 className="text-xl font-display font-bold text-white mb-3">Edge Computing</h3>
              <p className="text-text-secondary font-mono text-sm leading-relaxed">
                Deploy lightweight containers directly at the edge to process ML inferences with sub-millisecond response times.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="glass p-8 flex flex-col group hover:-translate-y-1 hover:border-accent-violet transition-all duration-300">
              <div className="w-12 h-12 mb-6 text-accent-violet group-hover:glow-violet transition-all">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h3 className="text-xl font-display font-bold text-white mb-3">Air-Gapped Secure</h3>
              <p className="text-text-secondary font-mono text-sm leading-relaxed">
                WebRTC E2EE encapsulation guarantees that any payload remains 100% hermetic—readable only to your authorized domain.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* How it Works - 3 Step Flow */}
      <section className="w-full py-24 px-6 border-t border-border bg-surface/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-white mb-16 text-center tracking-tight">System Workflow</h2>
          
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 relative">
            
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-[28px] left-[10%] right-[10%] h-px bg-border z-0" />
            
            {[
              { num: "01", title: "Connect Feeds", desc: "Input raw RTSP links via the secure portal." },
              { num: "02", title: "SFU Tunneling", desc: "System transcodes and WebRTC tunnels the feeds." },
              { num: "03", title: "Global Observe", desc: "Monitor matrix from the central UI with zero latency." },
            ].map((step, i) => (
              <div key={i} className="flex-1 flex flex-col items-center text-center relative z-10 w-full md:w-auto">
                <div className="w-14 h-14 bg-background border border-border flex items-center justify-center font-mono font-bold text-lg text-accent-cyan mb-6 rounded-none box-glow-cyan shadow-lg">
                  {step.num}
                </div>
                <h4 className="text-lg font-display font-bold text-white mb-2">{step.title}</h4>
                <p className="text-text-secondary font-mono text-sm leading-relaxed max-w-[250px]">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-12 border-t border-border flex flex-col items-center justify-center bg-background relative z-10">
        <div className="flex items-center gap-2 mb-6 opacity-30">
           <div className="w-4 h-4 border border-white flex items-center justify-center"><div className="w-1 h-1 bg-white" /></div>
           <span className="font-display font-bold text-white tracking-widest uppercase">HMS.SYS</span>
        </div>
        <div className="font-mono text-xs text-text-secondary flex flex-col items-center gap-2 uppercase tracking-widest text-center">
          <span>© 2026 HMS.SYS GLOBAL ARCHITECTURE.</span>
          <span>BRUTALIST OPERATIONS INTERFACE. ALL RIGHTS RESERVED.</span>
        </div>
      </footer>

    </div>
  );
}
