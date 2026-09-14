import React, { useEffect } from 'react';
import toast, { Toaster, Toast as HotToast } from 'react-hot-toast';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

const borderFor = (type: ToastMessage['type']) => {
  if (type === 'success') return '#1f883d';
  if (type === 'error') return '#cf222e';
  return '#0969da';
};

const iconFor = (type: ToastMessage['type']) => {
  if (type === 'success') return <CheckCircle2 size={18} color="#1a7f37" />;
  if (type === 'error') return <AlertCircle size={18} color="#cf222e" />;
  return <Info size={18} color="#0969da" />;
};

function ToastCard({
  t,
  message,
}: {
  t: HotToast;
  message: Omit<ToastMessage, 'id'>;
}) {
  return (
    <div
      className={`sspillowy-hot-toast ${t.visible ? 'sspillowy-hot-toast--in' : 'sspillowy-hot-toast--out'}`}
      style={{ borderLeftColor: borderFor(message.type) }}
      role="status"
    >
      <div className="sspillowy-hot-toast__icon">{iconFor(message.type)}</div>
      <div className="sspillowy-hot-toast__body">
        <div className="sspillowy-hot-toast__title">{message.title}</div>
        {message.message ? (
          <div className="sspillowy-hot-toast__msg">{message.message}</div>
        ) : null}
      </div>
      <button
        type="button"
        className="sspillowy-hot-toast__close"
        aria-label="Cerrar"
        onClick={() => toast.dismiss(t.id)}
      >
        <X size={16} />
      </button>
    </div>
  );
}

/** API nueva: toast estilo SSPILLOWY vía react-hot-toast */
export function showToast(input: {
  type?: ToastMessage['type'];
  title: string;
  message?: string;
  duration?: number;
}) {
  const payload = {
    type: input.type || 'info',
    title: input.title,
    message: input.message || '',
  };
  return toast.custom((t) => <ToastCard t={t} message={payload} />, {
    duration: input.duration ?? 4000,
    position: 'top-right',
  });
}

/** Montar una sola vez en la app (esquina superior derecha). */
export const AppToaster: React.FC = () => (
  <Toaster
    position="top-right"
    gutter={10}
    containerStyle={{ top: 20, right: 24, zIndex: 4000 }}
    toastOptions={{ duration: 4000 }}
  />
);

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

/**
 * Puente con el patrón viejo (state + <Toast />).
 * Delega en react-hot-toast y limpia el state.
 */
export const Toast: React.FC<ToastProps> = ({ toast: msg, onClose }) => {
  useEffect(() => {
    if (!msg) return;
    showToast({
      type: msg.type,
      title: msg.title,
      message: msg.message,
    });
    onClose();
    // Solo al cambiar el mensaje (id), no cuando cambia la identidad de onClose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg?.id]);

  return null;
};
