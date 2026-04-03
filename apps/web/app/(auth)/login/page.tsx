'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, Button, fadeInUp } from '@hostel-monitor/ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@hostel.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    if (res?.error) {
      setError('Invalid credentials');
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background z-10 relative">
      <Link href="/" className="absolute top-6 left-6 logo-text text-2xl flex items-center gap-1 z-20">
         $h
         <span className="text-text-primary text-xl translate-y-px">/</span>
      </Link>

      <motion.div
        initial="initial"
        animate="animate"
        variants={fadeInUp}
        className="w-full max-w-md z-10"
      >
        <Card variant="elevated" className="p-10 bg-surface border border-border-hover">
          <div className="text-left mb-10">
            <h1 className="text-2xl font-black uppercase tracking-tight text-white font-sans">SYSTEM_AUTH</h1>
            <p className="text-text-secondary text-sm font-mono mt-2 uppercase">Command Matrix Access</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-alert-red/10 border border-alert-red text-alert-red text-xs uppercase font-mono tracking-widest text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-text-secondary mb-2 uppercase tracking-wider">Operator ID / Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface border border-border-hover p-4 text-white focus:outline-none focus:border-accent-purple font-mono text-sm transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-text-secondary mb-2 uppercase tracking-wider">Passcode</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface border border-border-hover p-4 text-white focus:outline-none focus:border-accent-purple font-mono text-sm transition-colors"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full h-14"
              loading={loading}
            >
              Initialize Session
            </Button>
          </form>

          <div className="mt-10 pt-6 border-t border-border-hover text-left flex flex-col gap-2">
            <span className="text-[10px] font-mono text-text-secondary uppercase">UNAUTHORIZED ACCESS IS PROHIBITED</span>
            <Link href="/register" className="text-xs font-mono uppercase text-accent-purple hover:text-white transition-colors">
              Request Operator Clearance &rarr;
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
