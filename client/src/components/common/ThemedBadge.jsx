import React from 'react';
import './ThemedBadge.css';

export const ThemedBadge = ({ 
  variant = 'danger', 
  children, 
  className = '',
  onClick = null,
  title = '',
  ...props 
}) => {
  return (
    <span 
      className={`themed-badge badge-${variant} ${className}`}
      onClick={onClick}
      title={title}
      {...props}
    >
      {children}
    </span>
  );
};
