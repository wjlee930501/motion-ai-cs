import React, { forwardRef, useState } from 'react';
import clsx from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-base',
  lg: 'px-5 py-3 text-lg',
};

const iconSizeStyles = {
  sm: 'pl-9',
  md: 'pl-11',
  lg: 'pl-12',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  inputSize = 'md',
  className,
  disabled,
  onFocus,
  onBlur,
  ...props
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const id = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <div className={clsx('flex flex-col gap-1.5', fullWidth && 'w-full')}>
      {label && (
        <label
          htmlFor={id}
          className={clsx(
            'text-sm font-medium transition-colors duration-200',
            error ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'
          )}
        >
          {label}
        </label>
      )}
      <div className="relative group">
        {leftIcon && (
          <div
            className={clsx(
              'pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 transition-colors duration-200',
              isFocused ? 'text-brand-500' : 'text-slate-400 dark:text-slate-500',
              error && 'text-red-400'
            )}
          >
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={id}
          className={clsx(
            'w-full rounded-xl border-2 bg-white transition-all duration-200',
            'placeholder:text-slate-400 dark:placeholder:text-slate-500',
            'dark:bg-slate-800 dark:text-white',
            sizeStyles[inputSize],
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 dark:border-red-600'
              : clsx(
                  'border-slate-200 dark:border-slate-700',
                  'hover:border-slate-300 dark:hover:border-slate-600',
                  'focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:focus:border-brand-400'
                ),
            disabled && 'bg-slate-100 dark:bg-slate-900 text-slate-500 cursor-not-allowed opacity-60',
            leftIcon && iconSizeStyles[inputSize],
            rightIcon && 'pr-11',
            className
          )}
          disabled={disabled}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {rightIcon && (
          <div
            className={clsx(
              'pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 transition-colors duration-200',
              isFocused ? 'text-brand-500' : 'text-slate-400 dark:text-slate-500'
            )}
          >
            {rightIcon}
          </div>
        )}
      </div>
      {(error || helperText) && (
        <p
          className={clsx(
            'text-sm transition-colors duration-200',
            error ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
          )}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
