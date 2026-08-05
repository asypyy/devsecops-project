import React, { useState, useEffect } from 'react';

export default function NoteModal({ isOpen, editingNote, onClose, onSubmit }) {
  const [formData, setFormData] = useState({ title: '', content: '', tags: '', is_pinned: false, created_at: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Helper to format ISO date into datetime-local string (YYYY-MM-DDTHH:mm)
  const formatForDateTimeLocal = (dateObj) => {
    const d = dateObj || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Maximum allowed datetime is right now
  const maxDateTime = formatForDateTimeLocal(new Date());

  useEffect(() => {
    setErrorMsg('');
    if (editingNote) {
      const dt = editingNote.created_at ? new Date(editingNote.created_at) : new Date();
      setFormData({
        title: editingNote.title || '',
        content: editingNote.content || '',
        tags: editingNote.tags || '',
        is_pinned: Boolean(editingNote.is_pinned),
        created_at: formatForDateTimeLocal(dt),
      });
    } else {
      setFormData({
        title: '',
        content: '',
        tags: '',
        is_pinned: false,
        created_at: maxDateTime,
      });
    }
  }, [editingNote, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!formData.title.trim() || !formData.content.trim()) return;

    // Validate date manually on frontend as well
    if (formData.created_at) {
      const selectedDt = new Date(formData.created_at);
      const nowDt = new Date();
      if (selectedDt > nowDt) {
        setErrorMsg('🚫 You cannot select a date or time in the future.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit(formData, editingNote);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Error saving note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-header">{editingNote ? 'Edit Note' : 'Create New Note'}</h2>
        
        {errorMsg && (
          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--danger-color)', borderRadius: '8px', color: 'var(--danger-color)', fontSize: '0.88rem', marginBottom: '1rem' }}>
            {errorMsg}
          </div>
        )}

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
            <label className="form-label">Tags (comma separated)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. devsecops, k8s, todo"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            />
          </div>

          {!editingNote && (
            <div className="form-group">
              <label className="form-label">Date & Time (Cannot be in the future)</label>
              <input
                type="datetime-local"
                className="form-input"
                max={maxDateTime}
                value={formData.created_at}
                onChange={(e) => setFormData({ ...formData, created_at: e.target.value })}
              />
            </div>
          )}

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              id="is_pinned"
              checked={formData.is_pinned}
              onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="is_pinned" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>
              📌 Pin note to top
            </label>
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
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : editingNote ? 'Save Changes' : 'Create Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
