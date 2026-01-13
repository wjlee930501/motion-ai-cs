import React from 'react';
import clsx from 'clsx';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
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
};

const shadowStyles = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
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
  onClick,
}) => {
  return (
    <div
      className={clsx(
        'bg-white rounded-lg border border-gray-200 transition-all duration-200',
        shadowStyles[shadow],
        paddingStyles[padding],
        hover && 'hover:shadow-md hover:border-gray-300 cursor-pointer',
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
    <div className={clsx('border-b border-gray-200 pb-3 mb-3', className)}>
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
    <div className={clsx('border-t border-gray-200 pt-3 mt-3', className)}>
      {children}
    </div>
  );
};

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
