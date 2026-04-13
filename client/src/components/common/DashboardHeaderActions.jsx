import React from 'react';
import useNetworkPing from '../../hooks/useNetworkPing';

export function DashboardHeaderActions({
  lastModifiedText,
  exportDisabled = false,
  showExportMenu = false,
  onToggleExport,
  onCloseExport,
  exportOptions = [],
  onSelectExport,
  isDarkMode = false,
  onToggleTheme,
  showUserDropdown = false,
  onToggleUserDropdown,
  onCloseUserDropdown,
  userName = 'Workspace User',
  userEmail = 'user@globe.com.ph',
  userInitial = 'U',
  firstName = 'USER',
  recentItems = [],
  onLoadRecentItem
}) {
  const { ping, status } = useNetworkPing();
  const pingColor = status === 'good' ? '#28a745' : status === 'fair' ? '#f59e0b' : '#ef4444';
  const pingText = status === 'offline' ? 'Offline' : `${ping} ms`;

  return (
    <div className="header-actions" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', paddingLeft: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, maxWidth: '280px' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.2 }}>
          Last Modified:
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {lastModifiedText}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          title={status === 'offline' ? 'Connection appears offline' : `Network latency: ${ping}ms`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '999px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-secondary)',
            fontSize: '0.75rem',
            minWidth: '88px',
            justifyContent: 'center'
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: pingColor,
              boxShadow: `0 0 8px ${pingColor}`
            }}
          />
          <span style={{ lineHeight: 1 }}>{pingText}</span>
        </div>

        <div className="export-dropdown-container" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) onCloseExport?.(); }} tabIndex={-1} style={{ position: 'relative' }}>
          <button className="btn theme-toggle" onClick={onToggleExport} disabled={exportDisabled} style={{
            width: '36px', height: '36px', borderRadius: '50%', padding: 0,
            background: 'var(--bg-input)', border: '1px solid var(--border-light)',
            color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: exportDisabled ? 'not-allowed' : 'pointer',
            opacity: exportDisabled ? 0.5 : 1, transition: 'all 0.2s ease', outline: 'none'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v9" />
              <polyline points="8 11 12 15 16 11" />
              <path d="M6 18h12" />
            </svg>
          </button>
          {showExportMenu && (
            <div className="export-menu" style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50 }}>
              {exportOptions.map((option) => (
                <button key={option.value} onClick={() => onSelectExport?.(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="btn theme-toggle" onClick={onToggleTheme} title="Toggle Theme" style={{
          width: '36px', height: '36px', borderRadius: '50%', padding: 0,
          background: 'var(--bg-input)', border: '1px solid var(--border-light)',
          color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.2s ease', outline: 'none'
        }}>
          {isDarkMode ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          )}
        </button>

        <div style={{ width: '1px', height: '24px', background: 'rgba(128, 128, 128, 0.4)' }} />

        <div style={{ position: 'relative' }}>
          <button
            className="user-profile-trigger"
            onClick={onToggleUserDropdown}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', background: 'transparent',
              border: 'none', outline: 'none', cursor: 'pointer', textAlign: 'left',
              padding: '4px 8px', borderRadius: '8px', transition: 'background 0.2s'
            }}
          >
            <div title={userName} style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--brand-purple), #6b21a8)',
              color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 'bold', fontSize: '1.05rem', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}>
              {userInitial}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2', minWidth: 0 }}>
              <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                {userName}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                {userEmail}
              </span>
            </div>
          </button>

          {showUserDropdown && (
            <>
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} onClick={(e) => { e.stopPropagation(); onCloseUserDropdown?.(); }} />

              <div style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 1000, width: '360px',
                background: 'var(--bg-card)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
                border: '1px solid var(--border-light)', borderRadius: '24px', boxShadow: 'var(--shadow-hover)',
                padding: '16px', color: 'var(--text-primary)', fontFamily: '"Google Sans", Roboto, Arial, sans-serif'
              }}>
                <div style={{ position: 'relative', textAlign: 'center', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '500' }}>{userEmail}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Managed by Globe RSC</div>
                  <button onClick={onCloseUserDropdown} style={{ position: 'absolute', right: '0', top: '-4px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', outline: 'none' }}>x</button>
                </div>

                <div style={{ position: 'relative', width: '76px', height: '76px', margin: '0 auto 12px auto' }}>
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-purple), #6b21a8)',
                    color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '2rem',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                  }}>
                    {userInitial}
                  </div>
                </div>

                <div style={{ textAlign: 'center', fontSize: '1.4rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Hi, {firstName}!</div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                  <button
                    onClick={() => {
                      onCloseUserDropdown?.();
                      window.open('https://myaccount.google.com/', '_blank');
                    }}
                    className="primary-outline"
                    style={{ borderRadius: '100px', padding: '8px 24px', fontSize: '0.85rem', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    Manage your Google Account
                  </button>
                </div>

                <div className="custom-scrollbar" style={{ maxHeight: '220px', overflowY: 'auto', overflowX: 'hidden' }}>
                  {recentItems.length > 0 ? recentItems.slice(0, 5).map((item, index) => (
                    <button
                      key={item.id}
                      onClick={() => { onLoadRecentItem?.(item); onCloseUserDropdown?.(); }}
                      className="row-hover"
                      style={{
                        width: '100%', background: 'transparent', border: 'none', borderBottom: index === Math.min(recentItems.length, 5) - 1 ? 'none' : '1px solid var(--border-light)',
                        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s'
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>

                      <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.fileName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{new Date(item.uploadDate).toLocaleDateString()} - <span style={{ color: 'var(--color-info)' }}>{item.processedCount ?? item.metadata?.processedRecords ?? 0} rows</span></div>
                      </div>
                    </button>
                  )) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      You haven't processed any files recently.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardHeaderActions;
