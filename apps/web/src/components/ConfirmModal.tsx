import React from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal de confirmación con estilo del hub (reemplaza window.confirm). */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <h2 id="confirm-modal-title" style={{ fontSize: '1.15rem', marginBottom: '0.5rem', color: '#1f2328', fontWeight: 700 }}>
          {title}
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#656d76', lineHeight: 1.5, marginBottom: '1.25rem' }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={onConfirm}
            style={
              danger
                ? { background: '#cf222e', borderColor: '#cf222e' }
                : undefined
            }
          >
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
