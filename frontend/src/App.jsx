import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import AuthForm from './components/AuthForm';
import NoteGrid from './components/NoteGrid';
import NoteModal from './components/NoteModal';
import SearchBar from './components/SearchBar';
import DeleteConfirmModal from './components/DeleteConfirmModal';

const API_URL = import.meta.env.VITE_API_URL || 'https://aserver.tail5c3f3c.ts.net';

export default function App() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState({ status: 'checking', online: false });

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  // Auth state
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('notes_auth');
    return saved ? JSON.parse(saved) : null;
  });

  // Modal state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);

  // Delete modal state
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleOpenDeleteModal = (note) => {
    setNoteToDelete(note);
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/notes/${noteToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
        setNoteToDelete(null);
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Compute all unique tags across user notes
  const availableTags = useMemo(() => {
    const tagSet = new Set();
    notes.forEach((note) => {
      if (note.tags) {
        note.tags.split(',').forEach((t) => {
          const clean = t.trim();
          if (clean) tagSet.add(clean);
        });
      }
    });
    return Array.from(tagSet);
  }, [notes]);

  // Filter notes based on search query and tag selection
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      // Tag filter
      if (selectedTag) {
        const noteTagList = note.tags ? note.tags.split(',').map((t) => t.trim()) : [];
        if (!noteTagList.includes(selectedTag)) return false;
      }

      // Search query filter (matches title, content, or tags)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = note.title ? note.title.toLowerCase().includes(query) : false;
        const contentMatch = note.content ? note.content.toLowerCase().includes(query) : false;
        const tagMatch = note.tags ? note.tags.toLowerCase().includes(query) : false;
        if (!titleMatch && !contentMatch && !tagMatch) return false;
      }

      return true;
    });
  }, [notes, searchQuery, selectedTag]);

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
        <>
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedTag={selectedTag}
            setSelectedTag={setSelectedTag}
            availableTags={availableTags}
          />
          <NoteGrid
            notes={filteredNotes}
            loading={loading}
            onEdit={handleOpenEditModal}
            onDelete={handleOpenDeleteModal}
            onCreateClick={handleOpenCreateModal}
            onTagClick={(tag) => setSelectedTag(tag)}
            isFiltered={Boolean(searchQuery || selectedTag)}
          />
        </>
      )}

      {/* Note Edit/Create Modal */}
      <NoteModal
        isOpen={isNoteModalOpen}
        editingNote={editingNote}
        onClose={() => setIsNoteModalOpen(false)}
        onSubmit={handleNoteSubmit}
      />

      {/* Custom Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(noteToDelete)}
        noteTitle={noteToDelete?.title || ''}
        onClose={() => setNoteToDelete(null)}
        onConfirm={handleConfirmDelete}
        deleting={deleting}
      />
    </div>
  );
}
