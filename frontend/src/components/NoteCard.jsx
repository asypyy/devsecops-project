import React from 'react';

export default function NoteCard({ note, onEdit, onDelete }) {
  return (
    <div className="note-card">
      <div>
        <h3 className="note-title">{note.title}</h3>
        <p className="note-content">{note.content}</p>
      </div>
      <div className="note-actions">
        <button className="btn-icon" title="Edit note" onClick={() => onEdit(note)}>
          ✏️ Edit
        </button>
        <button className="btn-icon danger" title="Delete note" onClick={() => onDelete(note.id)}>
          🗑️ Delete
        </button>
      </div>
    </div>
  );
}
