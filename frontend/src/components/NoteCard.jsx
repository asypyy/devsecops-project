import React from 'react';

export default function NoteCard({ note, onEdit, onDelete, onTagClick }) {
  const tagList = note.tags
    ? note.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  const formatDate = (isoString) => {
    if (!isoString) return null;
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  };

  const isReminderDue = (isoString) => {
    if (!isoString) return false;
    try {
      return new Date(isoString) <= new Date();
    } catch {
      return false;
    }
  };

  const formattedDate = formatDate(note.created_at);
  const formattedAutoDelete = formatDate(note.auto_delete_at);
  const formattedRemind = formatDate(note.remind_at);
  const due = isReminderDue(note.remind_at);

  return (
    <div className={`note-card ${note.is_pinned ? 'pinned' : ''}`}>
      {note.is_pinned && <span className="pin-badge" title="Pinned note">📌 Pinned</span>}
      <div>
        <h3 className="note-title">{note.title}</h3>
        {formattedDate && <div className="note-date">📅 {formattedDate}</div>}

        {formattedRemind && (
          <div
            className={`note-remind-badge ${due ? 'due' : ''}`}
            title={due ? 'Reminder is due now!' : 'Scheduled reminder'}
          >
            {due ? '⚠️ REMINDER DUE: ' : '🔔 Remind: '}
            {formattedRemind}
          </div>
        )}

        {formattedAutoDelete && (
          <div className="note-auto-delete-badge" title="Note will self-destruct after this date">
            ⏳ Auto-deletes: {formattedAutoDelete}
          </div>
        )}

        <p className="note-content">{note.content}</p>

        {tagList.length > 0 && (
          <div className="card-tags">
            {tagList.map((tag) => (
              <span
                key={tag}
                className="card-tag-pill"
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick && onTagClick(tag);
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="note-actions">
        <button className="btn-icon" title="Edit note" onClick={() => onEdit(note)}>
          ✏️ Edit
        </button>
        <button className="btn-icon danger" title="Delete note" onClick={() => onDelete(note)}>
          🗑️ Delete
        </button>
      </div>
    </div>
  );
}
