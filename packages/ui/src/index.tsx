// ============================================
// @hostel-monitor/ui — Shared React Primitives
// ============================================

import React from 'react';
import { clsx } from 'clsx';
import { motion, type HTMLMotionProps } from 'framer-motion';

// ── Card ────────────────────────────────────

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'alert';
  glow?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', glow, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-xl border transition-all duration-150',
          {
            'bg-surface border-border': variant === 'default',
            'bg-surface-elevated border-border': variant === 'elevated',
            'bg-surface border-alert-red/30': variant === 'alert',
          },
          glow && 'shadow-lg shadow-accent-blue/10',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

// ── MotionCard ──────────────────────────────

export const MotionCard = motion.create(Card);

// ── Badge ───────────────────────────────────

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  pulse,
  children,
  ...props
}) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        {
          'bg-border text-text-secondary': variant === 'default',
          'bg-online-green/20 text-online-green': variant === 'success',
          'bg-warning-amber/20 text-warning-amber': variant === 'warning',
          'bg-alert-red/20 text-alert-red': variant === 'danger',
          'bg-accent-blue/20 text-accent-blue': variant === 'info',
        },
        className
      )}
      {...props}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={clsx(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              {
                'bg-online-green': variant === 'success',
                'bg-warning-amber': variant === 'warning',
                'bg-alert-red': variant === 'danger',
                'bg-accent-blue': variant === 'info',
                'bg-text-secondary': variant === 'default',
              }
            )}
          />
          <span
            className={clsx('relative inline-flex h-2 w-2 rounded-full', {
              'bg-online-green': variant === 'success',
              'bg-warning-amber': variant === 'warning',
              'bg-alert-red': variant === 'danger',
              'bg-accent-blue': variant === 'info',
              'bg-text-secondary': variant === 'default',
            })}
          />
        </span>
      )}
      {children}
    </span>
  );
};

// ── Button ──────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-accent-blue hover:bg-accent-blue/90 text-white': variant === 'primary',
            'bg-surface-elevated hover:bg-border text-text-primary border border-border': variant === 'secondary',
            'hover:bg-surface-elevated text-text-secondary hover:text-text-primary': variant === 'ghost',
            'bg-alert-red hover:bg-alert-red/90 text-white': variant === 'danger',
          },
          {
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-sm': size === 'md',
            'px-6 py-3 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ── StatusDot ───────────────────────────────

interface StatusDotProps {
  status: 'online' | 'offline' | 'warning' | 'critical';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export const StatusDot: React.FC<StatusDotProps> = ({ status, size = 'md', pulse = true }) => {
  return (
    <span className="relative inline-flex">
      {pulse && status !== 'offline' && (
        <span
          className={clsx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', {
            'bg-online-green': status === 'online',
            'bg-warning-amber': status === 'warning',
            'bg-alert-red': status === 'critical',
          })}
        />
      )}
      <span
        className={clsx('relative inline-flex rounded-full', {
          'h-2 w-2': size === 'sm',
          'h-3 w-3': size === 'md',
          'h-4 w-4': size === 'lg',
          'bg-online-green': status === 'online',
          'bg-offline-gray': status === 'offline',
          'bg-warning-amber': status === 'warning',
          'bg-alert-red': status === 'critical',
        })}
      />
    </span>
  );
};

// ── Skeleton ────────────────────────────────

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={clsx('animate-pulse rounded-lg bg-surface-elevated', className)}
      {...props}
    />
  );
};

// ── Animations ──────────────────────────────

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};
