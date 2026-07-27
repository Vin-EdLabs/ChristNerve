import React from 'react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fullPage?: boolean;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className = '',
  fullPage = false,
}) => {
  const sizeClass = size === 'sm' ? 'spinner-sm' : size === 'lg' ? 'spinner-lg' : '';
  const el = (
    <div
      className={`spinner ${sizeClass} ${className}`.trim()}
      role="status"
      aria-label="Loading"
    />
  );

  if (fullPage) {
    return <div className="spinner-wrap">{el}</div>;
  }
  return el;
};

export default Spinner;
