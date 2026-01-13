import React from 'react';
import clsx from 'clsx';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary' | 'purple';
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
  pulse?: boolean;
  outline?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { solid: string; outline: string }> = {
  success: {
    solid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    outline: 'border-emerald-300 text-emerald-700 dark:border-emerald-600 dark:text-emerald-300',
  },
  warning: {
    solid: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    outline: 'border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-300',
  },
  danger: {
    solid: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    outline: 'border-red-300 text-red-700 dark:border-red-600 dark:text-red-300',
  },
  info: {
    solid: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    outline: 'border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-300',
  },
  neutral: {
    solid: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    outline: 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300',
  },
  primary: {
    solid: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
    outline: 'border-brand-300 text-brand-700 dark:border-brand-600 dark:text-brand-300',
  },
  purple: {
    solid: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    outline: 'border-purple-300 text-purple-700 dark:border-purple-600 dark:text-purple-300',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  xs: 'text-2xs px-1.5 py-0.5 gap-1',
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1.5',
  lg: 'text-base px-3 py-1.5 gap-2',
};

const dotVariantStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-400',
  primary: 'bg-brand-500',
  purple: 'bg-purple-500',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  children,
  className,
  dot = false,
  pulse = false,
  outline = false,
  icon,
}) => {
  const styles = variantStyles[variant];

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full transition-all duration-200',
        outline ? `border ${styles.outline} bg-transparent` : styles.solid,
        sizeStyles[size],
        className
      )}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span
              className={clsx(
                'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                dotVariantStyles[variant]
              )}
            />
          )}
          <span
            className={clsx(
              'relative inline-flex rounded-full h-2 w-2',
              dotVariantStyles[variant]
            )}
          />
        </span>
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
};

export default Badge;
