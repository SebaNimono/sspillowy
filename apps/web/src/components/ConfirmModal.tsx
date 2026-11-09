import React from 'react';

export interface ConfirmModalProps {
  open?: boolean;
  isOpen?: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  danger?: boolean;
  isDanger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal de confirmación con estilo del hub (reemplaza window.confirm). */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  isOpen,
  title,
  message,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  danger,
  isDanger,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  const visible = open ?? isOpen ?? false;
  if (!visible) return null;

  const btnConfirm = confirmLabel || confirmText || 'Confirmar';
  const btnCancel = cancelLabel || cancelText || 'Cancelar';
  const isDestructive = danger || isDanger || false;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div className="modal-content" style={{ maxWidth: '440px' }}>
        <h2 id="confirm-modal-title" style={{ fontSize: '1.15rem', marginBottom: '0.5rem', color: '#1f2328', fontWeight: 700 }}>
          {title}
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#656d76', lineHeight: 1.5, marginBottom: '1.25rem' }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>
            {btnCancel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={onConfirm}
            style={
              isDestructive
                ? { background: '#cf222e', borderColor: '#cf222e' }
                : undefined
            }
          >
            {busy ? 'Procesando…' : btnConfirm}
          </button>
        </div>
      </div>
    </div>
  );
};
