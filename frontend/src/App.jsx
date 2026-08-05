import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import AuthForm from './components/AuthForm';
import NoteGrid from './components/NoteGrid';
import NoteModal from './components/NoteModal';

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

  // Modal state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);

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

  const handleAuthSuccess = (authUser) => {
    setUser(authUser);
    localStorage.setItem('notes_auth', JSON.stringify(authUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('notes_auth');
  };

  const handleOpenCreateModal = () => {
    setEditingNote(null);
    setIsNoteModalOpen(true);
  };

  const handleOpenEditModal = (note) => {
    setEditingNote(note);
    setIsNoteModalOpen(true);
  };

  const handleNoteSubmit = async (formData, currentEditingNote) => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    };

    if (currentEditingNote) {
      const res = await fetch(`${API_URL}/notes/${currentEditingNote.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        await fetchNotes(user.token);
      }
    } else {
      const res = await fetch(`${API_URL}/notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        await fetchNotes(user.token);
      }
    }
  };

  const handleDeleteNote = async (id) => {
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
      {/* Header Component */}
      <Header health={health} user={user} onLogout={handleLogout} />

      {/* Banner */}
      <div className="banner-api">
        🛡️ <strong>DevSecOps Architecture:</strong> Secure JWT API | Kubernetes Cluster & Tailscale Funnel
      </div>

      {/* Main Content */}
      {!user ? (
        <AuthForm onAuthSuccess={handleAuthSuccess} apiUrl={API_URL} />
      ) : (
        <NoteGrid
          notes={notes}
          loading={loading}
          onEdit={handleOpenEditModal}
          onDelete={handleDeleteNote}
          onCreateClick={handleOpenCreateModal}
        />
      )}

      {/* Note Modal */}
      <NoteModal
        isOpen={isNoteModalOpen}
        editingNote={editingNote}
        onClose={() => setIsNoteModalOpen(false)}
        onSubmit={handleNoteSubmit}
      />
    </div>
  );
}
