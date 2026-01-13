import React from 'react';
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
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-5 py-3 text-lg',
};

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  inputSize = 'md',
  className,
  disabled,
  ...props
}) => {
  const id = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={clsx('flex flex-col gap-1', fullWidth && 'w-full')}>
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-gray-400">{leftIcon}</span>
          </div>
        )}
        <input
          id={id}
          className={clsx(
            'rounded-lg border bg-white transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'placeholder:text-gray-400',
            sizeStyles[inputSize],
            error
              ? 'border-red-300 focus:ring-red-500'
              : 'border-gray-300 hover:border-gray-400',
            disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            fullWidth && 'w-full',
            className
          )}
          disabled={disabled}
          {...props}
        />
        {rightIcon && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-gray-400">{rightIcon}</span>
          </div>
        )}
      </div>
      {(error || helperText) && (
        <p
          className={clsx(
            'text-sm',
            error ? 'text-red-600' : 'text-gray-500'
          )}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
};

export default Input;
