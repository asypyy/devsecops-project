import React, { useState, useEffect } from 'react';

export default function NoteModal({ isOpen, editingNote, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: '',
    is_pinned: false,
    created_at: '',
    enable_auto_delete: false,
    auto_delete_at: '',
    enable_reminder: false,
    remind_at: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Helper to format Date into datetime-local string (YYYY-MM-DDTHH:mm)
  const formatForDateTimeLocal = (dateObj) => {
    const d = dateObj || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const now = new Date();
  const maxDateTime = formatForDateTimeLocal(now);

  useEffect(() => {
    setErrorMsg('');
    if (editingNote) {
      const dt = editingNote.created_at ? new Date(editingNote.created_at) : new Date();
      const autoDt = editingNote.auto_delete_at ? new Date(editingNote.auto_delete_at) : null;
      const remindDt = editingNote.remind_at ? new Date(editingNote.remind_at) : null;

      setFormData({
        title: editingNote.title || '',
        content: editingNote.content || '',
        tags: editingNote.tags || '',
        is_pinned: Boolean(editingNote.is_pinned),
        created_at: formatForDateTimeLocal(dt),
        enable_auto_delete: Boolean(autoDt),
        auto_delete_at: autoDt ? formatForDateTimeLocal(autoDt) : '',
        enable_reminder: Boolean(remindDt),
        remind_at: remindDt ? formatForDateTimeLocal(remindDt) : '',
      });
    } else {
      setFormData({
        title: '',
        content: '',
        tags: '',
        is_pinned: false,
        created_at: maxDateTime,
        enable_auto_delete: false,
        auto_delete_at: '',
        enable_reminder: false,
        remind_at: '',
      });
    }
  }, [editingNote, isOpen]);

  if (!isOpen) return null;

  const baseCreatedDate = formData.created_at ? new Date(formData.created_at) : new Date();
  const minAutoDelete = formatForDateTimeLocal(baseCreatedDate);
  const maxAutoDeleteDate = new Date(baseCreatedDate.getTime() + 3 * 24 * 60 * 60 * 1000);
  const maxAutoDelete = formatForDateTimeLocal(maxAutoDeleteDate);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!formData.title.trim() || !formData.content.trim()) return;

    if (formData.created_at) {
      const selectedDt = new Date(formData.created_at);
      if (selectedDt > new Date()) {
        setErrorMsg('🚫 Note creation date cannot be in the future.');
        return;
      }
    }

    let autoDeletePayload = null;
    if (formData.enable_auto_delete) {
      if (!formData.auto_delete_at) {
        setErrorMsg('⏰ Please specify an auto-delete date and time.');
        return;
      }
      const autoDt = new Date(formData.auto_delete_at);
      if (autoDt <= baseCreatedDate) {
        setErrorMsg('⏰ Auto-delete time must be after creation date/time.');
        return;
      }
      if (autoDt > maxAutoDeleteDate) {
        setErrorMsg('⏰ Auto-delete time cannot exceed 3 days from creation date.');
        return;
      }
      autoDeletePayload = autoDt.toISOString();
    }

    let remindPayload = null;
    if (formData.enable_reminder) {
      if (!formData.remind_at) {
        setErrorMsg('🔔 Please select a reminder date and time.');
        return;
      }
      remindPayload = new Date(formData.remind_at).toISOString();
    }

    setSubmitting(true);
    try {
      const payload = {
        title: formData.title,
        content: formData.content,
        tags: formData.tags,
        is_pinned: formData.is_pinned,
        created_at: formData.created_at ? new Date(formData.created_at).toISOString() : null,
        auto_delete_at: autoDeletePayload,
        remind_at: remindPayload,
      };
      await onSubmit(payload, editingNote);
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

          {/* Checkbox for Pinning */}
          <div className="checkbox-form-group">
            <input
              type="checkbox"
              id="is_pinned"
              className="custom-checkbox"
              checked={formData.is_pinned}
              onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
            />
            <label htmlFor="is_pinned" className="checkbox-label">
              📌 Pin note to top
            </label>
          </div>

          {/* Checkbox for Auto-Delete */}
          <div className="checkbox-form-group">
            <input
              type="checkbox"
              id="enable_auto_delete"
              className="custom-checkbox"
              checked={formData.enable_auto_delete}
              onChange={(e) => {
                const checked = e.target.checked;
                setFormData({
                  ...formData,
                  enable_auto_delete: checked,
                  auto_delete_at: checked ? maxAutoDelete : '',
                });
              }}
            />
            <label htmlFor="enable_auto_delete" className="checkbox-label">
              ⏰ Enable Auto-Delete (Self-Destruct in 3 Days Max)
            </label>
          </div>

          {formData.enable_auto_delete && (
            <div className="form-group auto-delete-box">
              <label className="form-label" style={{ color: 'var(--accent-cyan)' }}>
                Auto-Delete Expiration Time (Max 3 days from creation)
              </label>
              <input
                type="datetime-local"
                className="form-input"
                min={minAutoDelete}
                max={maxAutoDelete}
                value={formData.auto_delete_at}
                onChange={(e) => setFormData({ ...formData, auto_delete_at: e.target.value })}
                required
              />
              <span className="form-hint">
                This note will automatically self-destruct after the selected time.
              </span>
            </div>
          )}

          {/* Radio Group for Reminder Selection */}
          <div className="form-group" style={{ marginTop: '1.25rem' }}>
            <label className="form-label">Reminder Notification</label>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="reminder_option"
                  checked={!formData.enable_reminder}
                  onChange={() => setFormData({ ...formData, enable_reminder: false, remind_at: '' })}
                />
                🔕 No Reminder
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="reminder_option"
                  checked={formData.enable_reminder}
                  onChange={() =>
                    setFormData({
                      ...formData,
                      enable_reminder: true,
                      remind_at: formData.remind_at || formatForDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)),
                    })
                  }
                />
                🔔 Set Reminder Date & Time
              </label>
            </div>
          </div>

          {formData.enable_reminder && (
            <div className="form-group reminder-box">
              <label className="form-label" style={{ color: 'var(--accent-purple)' }}>
                Reminder Date & Time
              </label>
              <input
                type="datetime-local"
                className="form-input"
                value={formData.remind_at}
                onChange={(e) => setFormData({ ...formData, remind_at: e.target.value })}
                required
              />
              <span className="form-hint">
                You will receive a notification banner in the app when this reminder is due.
              </span>
            </div>
          )}

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
