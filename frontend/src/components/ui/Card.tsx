/**
 * Card Component - Reusable card container
 */
import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  children: React.ReactNode;
}

const paddingClasses = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  footer,
  padding = 'md',
  hoverable = false,
  children,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`
        bg-white rounded-lg border border-gray-200 shadow-sm
        ${hoverable ? 'hover:shadow-md transition-shadow duration-200 cursor-pointer' : ''}
        ${className}
      `}
      {...props}
    >
      {(title || subtitle) && (
        <div className={`border-b border-gray-200 ${paddingClasses[padding]}`}>
          {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      )}
      <div className={paddingClasses[padding]}>{children}</div>
      {footer && <div className={`border-t border-gray-200 ${paddingClasses[padding]} bg-gray-50`}>{footer}</div>}
    </div>
  );
};
