import React, { forwardRef } from 'react';
import './ThemedInput.css';

export const ThemedInput = forwardRef(({ 
  placeholder, 
  value, 
  onChange, 
  className = '',
  ...props 
}, ref) => {
  return (
    <input
      ref={ref}
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`themed-input ${className}`}
      {...props}
    />
  );
});

ThemedInput.displayName = 'ThemedInput';
