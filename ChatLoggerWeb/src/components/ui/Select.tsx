import React from 'react';
import clsx from 'clsx';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: SelectOption[];
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  selectSize?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-5 py-3 text-lg',
};

export const Select: React.FC<SelectProps> = ({
  options,
  label,
  error,
  helperText,
  fullWidth = false,
  selectSize = 'md',
  className,
  disabled,
  ...props
}) => {
  const id = props.id || `select-${Math.random().toString(36).substr(2, 9)}`;

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
        <select
          id={id}
          className={clsx(
            'appearance-none rounded-lg border bg-white transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            sizeStyles[selectSize],
            error
              ? 'border-red-300 focus:ring-red-500'
              : 'border-gray-300 hover:border-gray-400',
            disabled && 'bg-gray-50 text-gray-500 cursor-not-allowed',
            fullWidth && 'w-full',
            className
          )}
          disabled={disabled}
          {...props}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <svg
            className="h-5 w-5 text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
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

export default Select;
