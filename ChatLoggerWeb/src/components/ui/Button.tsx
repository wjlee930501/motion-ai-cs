import React from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'gradient';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  rounded?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-gradient-to-r from-brand-600 to-brand-500 text-white
    hover:from-brand-700 hover:to-brand-600 hover:shadow-lg hover:shadow-brand-500/25
    active:scale-[0.98] border-transparent
    dark:from-brand-500 dark:to-brand-400
  `,
  secondary: `
    bg-slate-100 text-slate-700
    hover:bg-slate-200 active:bg-slate-300
    border-transparent
    dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700
  `,
  danger: `
    bg-gradient-to-r from-red-600 to-red-500 text-white
    hover:from-red-700 hover:to-red-600 hover:shadow-lg hover:shadow-red-500/25
    active:scale-[0.98] border-transparent
  `,
  ghost: `
    bg-transparent text-slate-600
    hover:bg-slate-100 active:bg-slate-200
    border-transparent
    dark:text-slate-300 dark:hover:bg-slate-800 dark:active:bg-slate-700
  `,
  outline: `
    bg-white text-slate-700 border-slate-300
    hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100
    dark:bg-slate-900 dark:text-slate-200 dark:border-slate-600
    dark:hover:bg-slate-800 dark:hover:border-slate-500
  `,
  gradient: `
    bg-gradient-to-r from-brand-500 via-accent-purple to-accent-pink text-white
    hover:shadow-lg hover:shadow-accent-purple/30 hover:-translate-y-0.5
    active:scale-[0.98] border-transparent
    background-size: 200% 200%
    animate-gradient-x
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs gap-1',
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
  xl: 'px-6 py-3 text-lg gap-2.5',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  rounded = false,
  children,
  className,
  disabled,
  ...props
}) => {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center font-medium border',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none',
        rounded ? 'rounded-full' : 'rounded-xl',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
      )}
      {children}
      {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  );
};

export default Button;
