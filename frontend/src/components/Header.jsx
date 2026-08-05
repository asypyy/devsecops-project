import React from 'react';

export default function Header({ health, user, onLogout }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-icon">N</div>
        <h1 className="brand-title">DevSecOps Notes</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className="status-badge">
          <span className={`status-dot ${health.online ? 'online' : 'offline'}`}></span>
          <span>Backend: {health.status}</span>
        </div>
        {user && (
          <button className="btn-logout" onClick={onLogout} title="Sign out of account">
            <span>Logout</span>
            <span className="user-pill">{user.username}</span>
          </button>
        )}
      </div>
    </header>
  );
}
