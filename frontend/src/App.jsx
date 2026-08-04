import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://aserver.tail5c3f3c.ts.net';

export default function App() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState({ status: 'checking', online: false });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [formData, setFormData] = useState({ title: '', content: '' });
  const [submitting, setSubmitting] = useState(false);

  // Check health and fetch notes on mount
  useEffect(() => {
    checkHealth();
    fetchNotes();
  }, []);

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

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/notes`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingNote(null);
    setFormData({ title: '', content: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (note) => {
    setEditingNote(note);
    setFormData({ title: note.title, content: note.content });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;

    setSubmitting(true);
    try {
      if (editingNote) {
        // PUT update
        const res = await fetch(`${API_URL}/notes/${editingNote.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          await fetchNotes();
          setIsModalOpen(false);
        }
      } else {
        // POST create
        const res = await fetch(`${API_URL}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          await fetchNotes();
          setIsModalOpen(false);
        }
      }
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      const res = await fetch(`${API_URL}/notes/${id}`, {
        method: 'DELETE',
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
        <div className="status-badge">
          <span className={`status-dot ${health.online ? 'online' : 'offline'}`}></span>
          <span>Backend: {health.status}</span>
        </div>
      </header>

      {/* Banner */}
      <div className="banner-api">
        🌐 <strong>API Endpoint:</strong> {API_URL} (Funnel via Tailscale & Kubernetes)
      </div>

      {/* Controls */}
      <div className="controls-bar">
        <h2>My Notes ({notes.length})</h2>
        <button className="btn-primary" onClick={handleOpenCreateModal}>
          + New Note
        </button>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="empty-state">
          <div className="empty-title">Loading notes...</div>
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

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-header">{editingNote ? 'Edit Note' : 'Create New Note'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter title..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Content</label>
                <textarea
                  className="form-textarea"
                  placeholder="Write note contents..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingNote ? 'Save Changes' : 'Create Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
