import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return '#1f883d';
      case 'error':
        return '#cf222e';
      default:
        return '#0969da';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={18} color="#1a7f37" />;
      case 'error':
        return <AlertCircle size={18} color="#cf222e" />;
      default:
        return <Info size={18} color="#0969da" />;
    }
  };

  return (
    <div
      className="custom-toast"
      style={{
        position: 'fixed',
        top: '20px',
        right: '24px',
        zIndex: 2000,
        background: '#ffffff',
        border: '1px solid #d0d7de',
        borderLeft: `4px solid ${getBorderColor()}`,
        borderRadius: '8px',
        padding: '0.9rem 1.15rem',
        boxShadow: '0 8px 24px rgba(140, 149, 159, 0.25)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        minWidth: '320px',
        maxWidth: '450px',
      }}
    >
      <div style={{ marginTop: '2px' }}>{getIcon()}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1f2328' }}>{toast.title}</div>
        <div style={{ fontSize: '0.8rem', color: '#656d76', marginTop: '0.15rem' }}>{toast.message}</div>
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#8c959f',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
