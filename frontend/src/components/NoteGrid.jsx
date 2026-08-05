import React from 'react';
import NoteCard from './NoteCard';

export default function NoteGrid({ notes, loading, onEdit, onDelete, onCreateClick }) {
  return (
    <>
      <div className="controls-bar">
        <h2>My Notes ({notes.length})</h2>
        <button className="btn-primary" onClick={onCreateClick}>
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
            <NoteCard key={note.id} note={note} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </>
  );
}
