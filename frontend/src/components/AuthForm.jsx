import React, { useState } from 'react';

export default function AuthForm({ onAuthSuccess, apiUrl }) {
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);
    const endpoint = authMode === 'login' ? '/login' : '/register';

    try {
      const res = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      if (authMode === 'register') {
        // Automatically log in after registration
        const loginRes = await fetch(`${apiUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(authForm),
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
          onAuthSuccess({ username: loginData.username, token: loginData.access_token });
        }
      } else {
        onAuthSuccess({ username: data.username, token: data.access_token });
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '3rem auto' }} className="modal-card">
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <button
          style={{
            flex: 1,
            background: authMode === 'login' ? 'var(--accent-gradient)' : 'transparent',
            color: '#fff',
            border: 'none',
            padding: '0.6rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
          onClick={() => { setAuthMode('login'); setAuthError(''); }}
        >
          Log In
        </button>
        <button
          style={{
            flex: 1,
            background: authMode === 'register' ? 'var(--accent-gradient)' : 'transparent',
            color: '#fff',
            border: 'none',
            padding: '0.6rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
          onClick={() => { setAuthMode('register'); setAuthError(''); }}
        >
          Register
        </button>
      </div>

      {authError && (
        <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--danger-color)', borderRadius: '8px', color: 'var(--danger-color)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          ⚠️ {authError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            type="text"
            className="form-input"
            placeholder="Enter username..."
            value={authForm.username}
            onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="Enter password..."
            value={authForm.password}
            onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
            required
          />
        </div>
        <button type="submit" className="btn-primary" disabled={submitting} style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
          {submitting ? 'Authenticating...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
