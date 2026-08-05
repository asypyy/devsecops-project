import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://aserver.tail5c3f3c.ts.net';

export default function App() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState({ status: 'checking', online: false });
  
  // Auth state
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('notes_auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');

  // Note Modal state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteFormData, setNoteFormData] = useState({ title: '', content: '' });
  const [submittingNote, setSubmittingNote] = useState(false);

  useEffect(() => {
    checkHealth();
  }, []);

  useEffect(() => {
    if (user?.token) {
      fetchNotes(user.token);
    } else {
      setNotes([]);
    }
  }, [user]);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/health`);
      if (res.ok) {
        setHealth({ status: 'Connected', online: true });
      } else {
        setHealth({ status: 'Degraded', online: false });
      }
    } catch (err) {
      setHealth({ status: 'Offline', online: false });
    }
  };

  const fetchNotes = async (token) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/notes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'login' ? '/login' : '/register';

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
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
        setAuthMode('login');
        const loginRes = await fetch(`${API_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(authForm),
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
          const authUser = { username: loginData.username, token: loginData.access_token };
          setUser(authUser);
          localStorage.setItem('notes_auth', JSON.stringify(authUser));
        }
      } else {
        const authUser = { username: data.username, token: data.access_token };
        setUser(authUser);
        localStorage.setItem('notes_auth', JSON.stringify(authUser));
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('notes_auth');
  };

  const handleOpenCreateModal = () => {
    setEditingNote(null);
    setNoteFormData({ title: '', content: '' });
    setIsNoteModalOpen(true);
  };

  const handleOpenEditModal = (note) => {
    setEditingNote(note);
    setNoteFormData({ title: note.title, content: note.content });
    setIsNoteModalOpen(true);
  };

  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    if (!noteFormData.title.trim() || !noteFormData.content.trim()) return;

    setSubmittingNote(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.token}`,
      };

      if (editingNote) {
        const res = await fetch(`${API_URL}/notes/${editingNote.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(noteFormData),
        });
        if (res.ok) {
          await fetchNotes(user.token);
          setIsNoteModalOpen(false);
        }
      } else {
        const res = await fetch(`${API_URL}/notes`, {
          method: 'POST',
          headers,
          body: JSON.stringify(noteFormData),
        });
        if (res.ok) {
          await fetchNotes(user.token);
          setIsNoteModalOpen(false);
        }
      }
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      const res = await fetch(`${API_URL}/notes/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
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
            <button className="btn-secondary" onClick={handleLogout}>
              Logout ({user.username})
            </button>
          )}
        </div>
      </header>

      {/* Banner */}
      <div className="banner-api">
        🌐 <strong>API Endpoint:</strong> {API_URL} (JWT Authenticated via Funnel + K8s)
      </div>

      {/* Unauthenticated View: Login / Register Card */}
      {!user ? (
        <div style={{ maxWidth: '440px', margin: '3rem auto' }} className="modal-card">
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <button
              style={{ flex: 1, background: authMode === 'login' ? 'var(--accent-gradient)' : 'transparent', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
              onClick={() => { setAuthMode('login'); setAuthError(''); }}
            >
              Log In
            </button>
            <button
              style={{ flex: 1, background: authMode === 'register' ? 'var(--accent-gradient)' : 'transparent', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
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

          <form onSubmit={handleAuthSubmit}>
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
            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      ) : (
        /* Authenticated Notes View */
        <>
          <div className="controls-bar">
            <h2>My Notes ({notes.length})</h2>
            <button className="btn-primary" onClick={handleOpenCreateModal}>
              + New Note
            </button>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="empty-title">Loading your notes...</div>
            </div>
          ) : notes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-title">No notes found</div>
              <p style={{ color: 'var(--text-muted)' }}>Click "+ New Note" to create your first note.</p>
            </div>
          ) : (
            <div className="notes-grid">
              {notes.map((note) => (
                <div key={note.id} className="note-card">
                  <div>
                    <h3 className="note-title">{note.title}</h3>
                    <p className="note-content">{note.content}</p>
                  </div>
                  <div className="note-actions">
                    <button className="btn-icon" title="Edit note" onClick={() => handleOpenEditModal(note)}>
                      ✏️ Edit
                    </button>
                    <button className="btn-icon danger" title="Delete note" onClick={() => handleDelete(note.id)}>
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Note Modal */}
      {isNoteModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNoteModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-header">{editingNote ? 'Edit Note' : 'Create New Note'}</h2>
            <form onSubmit={handleNoteSubmit}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter title..."
                  value={noteFormData.title}
                  onChange={(e) => setNoteFormData({ ...noteFormData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Content</label>
                <textarea
                  className="form-textarea"
                  placeholder="Write note contents..."
                  value={noteFormData.content}
                  onChange={(e) => setNoteFormData({ ...noteFormData, content: e.target.value })}
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsNoteModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submittingNote}>
                  {submittingNote ? 'Saving...' : editingNote ? 'Save Changes' : 'Create Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
