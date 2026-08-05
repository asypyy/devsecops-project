import React from 'react';

export default function DeleteConfirmModal({ isOpen, noteTitle, onClose, onConfirm, deleting }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card delete-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="delete-modal-icon">⚠️</div>
        <h2 className="modal-header" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          Delete Note?
        </h2>
        <p className="delete-modal-text">
          Are you sure you want to delete <strong>"{noteTitle}"</strong>? This action cannot be undone.
        </p>

        <div className="modal-footer" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting...' : '🗑️ Delete Note'}
          </button>
        </div>
      </div>
    </div>
  );
}
