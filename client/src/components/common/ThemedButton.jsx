import React from 'react';
import './ThemedButton.css';

export const ThemedButton = ({ 
  variant = 'primary', 
  children, 
  disabled = false,
  className = '',
  ...props 
}) => {
  const variantClass = `btn-${variant}`;
  return (
    <button 
      className={`themed-btn ${variantClass} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
