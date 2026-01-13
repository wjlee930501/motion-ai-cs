import React from 'react';
import clsx from 'clsx';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'glow';
  hover?: boolean;
  glass?: boolean;
  gradient?: boolean;
  onClick?: () => void;
}

export interface CardSectionProps {
  children: React.ReactNode;
  className?: string;
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
};

const shadowStyles = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  glow: 'shadow-glow',
};

export const Card: React.FC<CardProps> & {
  Header: React.FC<CardSectionProps>;
  Body: React.FC<CardSectionProps>;
  Footer: React.FC<CardSectionProps>;
} = ({
  children,
  className,
  padding = 'md',
  shadow = 'sm',
  hover = false,
  glass = false,
  gradient = false,
  onClick,
}) => {
  return (
    <div
      className={clsx(
        'rounded-2xl border transition-all duration-300',
        glass
          ? 'bg-white/70 backdrop-blur-xl border-white/20 dark:bg-slate-800/70 dark:border-slate-700/50'
          : 'bg-white border-slate-200/80 dark:bg-slate-800 dark:border-slate-700/50',
        shadowStyles[shadow],
        paddingStyles[padding],
        hover && 'hover:shadow-card-hover hover:-translate-y-1 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer',
        gradient && 'bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardSectionProps> = ({
  children,
  className,
}) => {
  return (
    <div className={clsx('border-b border-slate-200/80 dark:border-slate-700/50 pb-4 mb-4', className)}>
      {children}
    </div>
  );
};

export const CardBody: React.FC<CardSectionProps> = ({
  children,
  className,
}) => {
  return <div className={clsx('flex-1', className)}>{children}</div>;
};

export const CardFooter: React.FC<CardSectionProps> = ({
  children,
  className,
}) => {
  return (
    <div className={clsx('border-t border-slate-200/80 dark:border-slate-700/50 pt-4 mt-4', className)}>
      {children}
    </div>
  );
};

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
