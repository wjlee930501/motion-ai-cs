import React from 'react';
import clsx from 'clsx';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerVariant = 'primary' | 'secondary' | 'white';

export interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  className?: string;
  label?: string;
}

const sizeStyles: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-3',
  xl: 'w-12 h-12 border-4',
};

const variantStyles: Record<SpinnerVariant, string> = {
  primary: 'border-blue-600 border-t-transparent',
  secondary: 'border-gray-400 border-t-transparent',
  white: 'border-white border-t-transparent',
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  className,
  label,
}) => {
  return (
    <div className={clsx('inline-flex items-center gap-3', className)}>
      <div
        className={clsx(
          'animate-spin rounded-full',
          sizeStyles[size],
          variantStyles[variant]
        )}
        role="status"
        aria-label={label || 'Loading'}
      >
        <span className="sr-only">{label || 'Loading...'}</span>
      </div>
      {label && (
        <span className="text-sm font-medium text-gray-700">{label}</span>
      )}
    </div>
  );
};

export const SpinnerOverlay: React.FC<{
  children?: React.ReactNode;
  size?: SpinnerSize;
}> = ({ children, size = 'lg' }) => {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
        <Spinner size={size} />
      </div>
      <div className="opacity-50 pointer-events-none">{children}</div>
    </div>
  );
};

export const FullPageSpinner: React.FC<{
  size?: SpinnerSize;
  label?: string;
}> = ({ size = 'xl', label }) => {
  return (
    <div className="fixed inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-50">
      <Spinner size={size} label={label} />
    </div>
  );
};

export default Spinner;
