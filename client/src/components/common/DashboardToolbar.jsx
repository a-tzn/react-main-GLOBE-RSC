/**
 * Component: DashboardToolbar
 * Reusable toolbar for file upload, search, and theme toggle
 * Provides consistent UI across dashboards
 */

import React, { useRef } from 'react';
import './DashboardToolbar.css';

/**
 * DashboardToolbar Component
 * Props:
 *   onFileUpload: (file, fileInputRef) => void - File selected callback
 *   searchTerm: string - Current search value
 *   onSearchChange: (e) => void - Search input change handler
 *   isDarkMode: boolean - Current theme state
 *   onThemeToggle: () => void - Theme toggle handler
 *   placeholder: string - Search input placeholder
 *   logoSrc: string - Logo image path
 *   title: string - Dashboard title
 *   disableFileUpload: boolean - Disable file upload (default: false)
 */
export function DashboardToolbar({
  onFileUpload,
  searchTerm = '',
  onSearchChange,
  isDarkMode = false,
  onThemeToggle,
  placeholder = 'Search...',
  logoSrc,
  title,
  disableFileUpload = false,
  fileInputRef1,
  fileInputRef2
}) {
  const containerRef = useRef(null);

  const handleFileSelect = (e, ref) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file, ref);
    }
  };

  return (
    <div className="dashboard-toolbar" ref={containerRef}>
      {/* Logo & Title Section */}
      <div className="toolbar-logo-section">
        {logoSrc && <img src={logoSrc} alt="Logo" className="toolbar-logo" />}
        {title && <h1 className="toolbar-title">{title}</h1>}
      </div>

      {/* Actions Section */}
      <div className="toolbar-actions">
        {/* File Upload Buttons */}
        {!disableFileUpload && (
          <div className="toolbar-file-inputs">
            <label className="file-input-label">
              <input
                ref={fileInputRef1}
                type="file"
                accept=".csv,.json"
                onChange={(e) => handleFileSelect(e, fileInputRef1)}
                style={{ display: 'none' }}
              />
              <span className="file-button">📁 File 1</span>
            </label>

            <label className="file-input-label">
              <input
                ref={fileInputRef2}
                type="file"
                accept=".csv,.json"
                onChange={(e) => handleFileSelect(e, fileInputRef2)}
                style={{ display: 'none' }}
              />
              <span className="file-button">📁 File 2</span>
            </label>
          </div>
        )}

        {/* Search Input */}
        {onSearchChange && (
          <div className="toolbar-search">
            <input
              type="text"
              placeholder={placeholder}
              value={searchTerm}
              onChange={onSearchChange}
              className="search-input"
            />
          </div>
        )}

        {/* Theme Toggle */}
        {onThemeToggle && (
          <button
            onClick={onThemeToggle}
            className="toolbar-theme-toggle"
            title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
            aria-label="Toggle theme"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        )}
      </div>
    </div>
  );
}

export default DashboardToolbar;
