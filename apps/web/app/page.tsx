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

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex flex-col relative w-full bg-black overflow-x-hidden text-white font-mono selection:bg-accent-violet selection:text-white">
      
      {/* ── Marquee Separator ────────────────────── */}
      <div className="w-full border-b border-white/20 bg-black overflow-hidden py-1.5 z-20 flex">
        <div className="flex w-max animate-marquee font-mono text-[10px] text-text-secondary uppercase tracking-[0.2em] whitespace-nowrap">
          {Array.from({ length: 20 }).map((_, i) => (
            <span key={i} className="px-4 flex items-center gap-6 text-white font-bold">
              secure your active sectors with hms.sys
            </span>
          ))}
        </div>
      </div>

      {/* ── Hero Section ─────────────────────────── */}
      <main className="flex-1 w-full relative z-10 flex flex-col pt-20 pb-32">
        <div className="max-w-[1400px] w-full mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left: Professional Pipeline Matrix Graphic */}
          <div className="w-full aspect-square md:aspect-video lg:aspect-square relative border border-border bg-black p-8 flex flex-col items-center justify-center overflow-hidden">
             {/* Abstract Grid background */}
             <div className="absolute inset-0 bg-[linear-gradient(rgba(124,58,237,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(124,58,237,0.1)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

             {/* System Use-Case Data Flow Diagram */}
             <svg viewBox="0 0 500 500" className="w-full h-full text-white/40 drop-shadow-xl relative z-10" fill="none">
                
                {/* Horizontal Flow Lines */}
                <motion.path 
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatType: "loop", repeatDelay: 1 }}
                  d="M100 250 L250 250 M250 250 L400 250" 
                  stroke="#C084FC" strokeWidth="2" strokeDasharray="4 8" 
                />
                <motion.path 
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                  d="M100 120 L250 250 M100 380 L250 250 M250 250 L400 120 M250 250 L400 380" 
                  stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" 
                />

                {/* Left Side: Inputs */}
                <g className="font-mono text-[9px] uppercase font-bold tracking-widest fill-black stroke-accent-violet">
                  {/* Camera Array */}
                  <motion.rect initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1 }} x="50" y="95" width="50" height="50" strokeWidth="1" />
                  <text x="75" y="124" fill="#fff" stroke="none" textAnchor="middle">ONVIF</text>
                  
                  <motion.rect initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }} x="50" y="225" width="50" height="50" strokeWidth="1" />
                  <text x="75" y="254" fill="#fff" stroke="none" textAnchor="middle">RTSP</text>

                  <motion.rect initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }} x="50" y="355" width="50" height="50" strokeWidth="1" />
                  <text x="75" y="384" fill="#fff" stroke="none" textAnchor="middle">HTTP FLV</text>
                </g>

                {/* Central Brain: HMS Core */}
                <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.8 }}>
                  <rect x="210" y="210" width="80" height="80" className="fill-black stroke-white stroke-[2]" />
                  <line x1="210" y1="230" x2="290" y2="230" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <text x="250" y="260" fill="#fff" fontSize="16" fontWeight="bold" textAnchor="middle" className="font-mono tracking-widest">SFU Core</text>
                  <circle cx="250" cy="250" r="60" stroke="#C084FC" strokeWidth="1" fill="none" opacity="0.4" className="animate-pulse" />
                </motion.g>

                {/* Right Side: Outputs / Processing */}
                <g className="font-mono text-[9px] uppercase font-bold tracking-widest fill-black stroke-accent-cyan">
                  <motion.rect initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.1 }} x="400" y="95" width="50" height="50" strokeWidth="1" />
                  <text x="425" y="124" fill="#fff" stroke="none" textAnchor="middle">TensorRT</text>
                  
                  <motion.rect initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2 }} x="400" y="225" width="50" height="50" strokeWidth="1" className="stroke-white" />
                  <text x="425" y="254" fill="#fff" stroke="none" textAnchor="middle">WebRTC</text>

                  <motion.rect initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.3 }} x="400" y="355" width="50" height="50" strokeWidth="1" />
                  <text x="425" y="384" fill="#fff" stroke="none" textAnchor="middle">DVR / S3</text>
                </g>
             </svg>
             <div className="absolute top-4 left-4 border border-border bg-black px-3 py-1 text-[9px] uppercase tracking-widest text-accent-violet font-bold">
               Ingest & Distribution Matrix
             </div>
          </div>

          {/* Right: Copy */}
          <div className="flex flex-col items-start text-left max-w-xl">
            <h1 className="text-[36px] sm:text-[48px] leading-[1.1] font-mono font-bold text-white mb-8 tracking-tighter uppercase">
              A SINGLE POINT OF CLARITY FOR EVERY <span className="text-accent-violet">CAMERA</span> IN YOUR GRID
            </h1>
            <p className="text-white/80 text-[14px] leading-[1.8] font-mono mb-6 border-l-2 border-accent-violet pl-4 font-bold">
              HMS maps structure, endpoints, and live streams across all your physical infrastructure, removing manual digging and lost context.
            </p>
            <p className="text-white/80 text-[14px] leading-[1.8] font-mono mb-12 border-l-2 border-accent-violet pl-4 font-bold">
              Everything converges into one consistent, navigable view. Drop the latency, increase your response times.
            </p>

            <div className="flex items-center gap-6">
              <Link href="/login">
                <button className="px-8 py-4 bg-white text-black font-bold uppercase tracking-widest text-[13px] hover:bg-gray-200 transition-colors border border-transparent shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                  Access Terminal
                </button>
              </Link>
              <button className="px-8 py-4 bg-white text-black border border-transparent font-bold uppercase tracking-widest text-[13px] hover:bg-gray-200 transition-colors">
                View Schematics
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* ── Marquee Separator ────────────────────── */}
      <div className="w-full border-t border-b border-white/20 bg-black overflow-hidden py-1.5 z-20 flex">
        <div className="flex w-max animate-marquee font-mono text-[10px] text-text-secondary uppercase tracking-[0.2em] whitespace-nowrap">
          {Array.from({ length: 20 }).map((_, i) => (
            <span key={i} className="px-4 flex items-center gap-6 text-white font-bold">
              secure your active sectors with hms.sys
            </span>
          ))}
        </div>
      </div>

      {/* ── Section Two ──────────────────────────── */}
      <section className="w-full border-b border-white/20">
        <div className="max-w-[1400px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2">
          
          <div className="w-full border-r border-transparent lg:border-white/20 py-20 lg:py-32 lg:pr-20">
            <h2 className="text-[32px] font-mono font-bold leading-[1.1] tracking-tighter text-white mb-10 uppercase w-3/4">
              GO FROM ZERO CONTEXT TO FULL UNDERSTANDING IN MOMENTS
            </h2>
            <p className="text-text-secondary text-[14px] leading-[1.8] font-mono mb-6 max-w-lg font-bold">
              HMS analyzes your floor plans end-to-end and exposes the structure behind it - cameras, nodes, API behavior, everything.
            </p>
            <p className="text-text-secondary text-[14px] leading-[1.8] font-mono mb-6 max-w-lg font-bold">
              Instead of watching unstructured feeds screen by screen, you start with a clear matrix model and dive straight into observation.
            </p>
            <p className="text-text-secondary text-[14px] leading-[1.8] font-mono max-w-lg font-bold text-accent-cyan">
              The result is faster response times, smoother perimeter tracking, and zero latency dropped frames.
            </p>
          </div>

          <div className="w-full py-20 lg:py-32 lg:pl-20 flex justify-center lg:justify-start">
            {/* Box representing the 'Import' UI */}
            <div className="w-full max-w-[450px] border border-white/20 bg-black flex flex-col justify-between shadow-2xl">
              <div className="p-8 border-b border-white/20 bg-white/[0.02]">
                <span className="text-accent-violet font-mono text-[11px] uppercase tracking-widest font-bold block mb-4">Phase One</span>
                <h3 className="text-2xl font-bold font-mono tracking-tighter text-white mb-4 uppercase">Sync Grid Arrays</h3>
                <p className="text-text-secondary text-[12px] leading-[1.6] font-bold">
                  Bring your RTSP feeds into HMS with one click. We sync schemas, sub-streams, and motion events instantly.
                </p>
              </div>
              <div className="p-8">
                <p className="text-[12px] font-bold text-white mb-6 font-mono flex items-center gap-2">
                  <span className="text-accent-violet">{'>'}</span> available target sectors
                </p>
                <div className="border border-white/20 p-1 text-[13px] bg-black">
                  <div className="flex items-center justify-between p-3 border-b border-white/20 hover:bg-white/5 transition-colors">
                    <span className="flex items-center gap-3 font-mono font-bold text-white"><span className="w-2 h-2 bg-text-secondary block" /> Sector Alpha</span>
                    <button className="px-4 py-1.5 bg-white text-black font-bold uppercase tracking-widest text-[10px]">Sync</button>
                  </div>
                  <div className="flex items-center justify-between p-3 border-b border-white/20 hover:bg-white/5 transition-colors opacity-60">
                    <span className="flex items-center gap-3 font-mono font-bold text-white"><span className="w-2 h-2 bg-text-secondary block" /> Sector Beta</span>
                    <button className="px-4 py-1.5 bg-white text-black font-bold uppercase tracking-widest text-[10px]">Sync</button>
                  </div>
                  <div className="flex items-center justify-between p-3 hover:bg-white/5 transition-colors opacity-60">
                    <span className="flex items-center gap-3 font-mono font-bold text-white"><span className="w-2 h-2 bg-text-secondary block" /> Sector Gamma</span>
                    <button className="px-4 py-1.5 bg-white text-black font-bold uppercase tracking-widest text-[10px]">Sync</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Section Three ────────────────────────── */}
      <section className="w-full py-32 lg:py-40 border-b border-white/20 flex flex-col items-center justify-center relative overflow-hidden bg-black text-center px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,transparent_70%)] pointer-events-none" />

        <div className="mb-10 inline-flex items-center gap-3 border border-white/20 bg-black px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-text-secondary z-10">
          <span className="bg-accent-violet text-black px-2 mr-1">NEW</span> WebRTC Node Beta <span className="text-white ml-2">{'>'}</span>
        </div>

        <h2 className="text-[36px] lg:text-[48px] font-mono font-bold leading-[1.1] tracking-tighter text-white max-w-4xl uppercase mb-8 z-10">
          MAKE YOUR SECURITY EASY TO EXPLORE & ONBOARD
        </h2>

        <p className="text-text-secondary text-[14px] leading-[1.8] font-mono max-w-2xl mb-12 font-bold z-10">
          Automatically generate pipelines for your streams so others can understand, explore, and view feeds with ease. Get sub-millisecond delays without the hassle of configuring STUN/TURN servers yourself.
        </p>

        <div className="flex items-center gap-6 z-10">
          <Link href="/login">
            <button className="px-8 py-4 bg-white text-black font-bold uppercase tracking-widest text-[13px] hover:bg-gray-200 transition-colors">
              Access Beta
            </button>
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────── */}
      <footer className="w-full border-t border-white/20 flex flex-col items-center justify-center bg-black py-16">
        <div className="text-left font-mono w-full max-w-[1400px] px-6 grid grid-cols-2 md:grid-cols-4 gap-12 border-b border-white/20 pb-12 mb-12">
            <div className="flex flex-col gap-4">
                <span className="font-bold text-accent-violet text-lg tracking-tighter italic mb-2">$h<span className="text-white">ms</span></span>
                <Link href="#" className="font-bold text-text-secondary text-[12px] uppercase tracking-widest hover:text-white transition-colors">Pricing Vectors</Link>
                <Link href="#" className="font-bold text-text-secondary text-[12px] uppercase tracking-widest hover:text-white transition-colors">System Log</Link>
            </div>
            <div className="flex flex-col gap-4">
                <span className="font-bold text-white tracking-widest mb-2 border-b border-white/20 pb-2">RESOURCES</span>
                <Link href="#" className="font-bold text-text-secondary text-[12px] uppercase tracking-widest hover:text-white transition-colors">Documentation</Link>
                <Link href="#" className="font-bold text-text-secondary text-[12px] uppercase tracking-widest hover:text-white transition-colors">API Reference</Link>
            </div>
            <div className="flex flex-col gap-4">
                <span className="font-bold text-white tracking-widest mb-2 border-b border-white/20 pb-2">LEGAL</span>
                <Link href="#" className="font-bold text-text-secondary text-[12px] uppercase tracking-widest hover:text-white transition-colors">Privacy Policy</Link>
                <Link href="#" className="font-bold text-text-secondary text-[12px] uppercase tracking-widest hover:text-white transition-colors">Terms of Service</Link>
            </div>
        </div>
        <div className="w-full max-w-[1400px] px-6 text-left">
          <p className="text-text-secondary font-mono text-[10px] uppercase tracking-widest font-bold">© 2026 HMS Systems. All rights reserved. End of transmission.</p>
        </div>
      </footer>

    </div>
  );
}
