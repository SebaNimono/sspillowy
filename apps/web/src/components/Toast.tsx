import React, { useEffect } from 'react';
import { Toaster, sileo } from 'sileo';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

const BASE_OPTS = {
  position: 'top-right' as const,
  fill: '#ffffff',
  roundness: 10,
  duration: 4000,
};

/** API: toast SSPILLOWY vía Sileo (esquina superior derecha). */
export function showToast(input: {
  type?: ToastMessage['type'];
  title: string;
  message?: string;
  duration?: number;
}) {
  const opts = {
    ...BASE_OPTS,
    title: input.title,
    description: input.message || undefined,
    duration: input.duration ?? 4000,
  };
  const type = input.type || 'info';
  if (type === 'success') return sileo.success(opts);
  if (type === 'error') return sileo.error(opts);
  return sileo.info(opts);
}

/** Montar una sola vez en la raíz de la app. */
export const AppToaster: React.FC = () => (
  <Toaster
    position="top-right"
    theme="dark"
    offset={{ top: 20, right: 24 }}
    options={{
      fill: '#ffffff',
      roundness: 10,
      duration: 4000,
    }}
  />
);

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

/**
 * Puente con el patrón viejo (state + <Toast />).
 * Delega en Sileo y limpia el state.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg?.id]);

  return null;
};
