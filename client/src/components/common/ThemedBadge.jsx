import React from 'react';
import './ThemedBadge.css';

export const ThemedBadge = ({ 
  variant = 'danger', 
  children, 
  className = '',
  onClick = null,
  title = '',
  disabled = false,
  ...props 
}) => {
  const handleClick = disabled ? undefined : onClick;
  return (
    <span 
      className={`themed-badge badge-${variant} ${disabled ? 'badge-disabled' : ''} ${className}`}
      onClick={handleClick}
      title={title}
      aria-disabled={disabled}
      {...props}
    >
      {children}
    </span>
  );
};
