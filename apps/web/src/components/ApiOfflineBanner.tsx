import React from 'react';
import { WifiOff } from 'lucide-react';

/** Banner cuando la API no responde — sin datos ficticios. */
export const ApiOfflineBanner: React.FC<{ message?: string }> = ({
  message = 'No se pudo conectar con la API. Mostrando estado vacío (sin datos de demo).',
}) => (
  <div
    role="status"
    style={{
      background: '#fff8c5',
      border: '1px solid #d4a72c',
      color: '#9a6700',
      padding: '0.75rem 1rem',
      borderRadius: '8px',
      marginBottom: '1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.65rem',
      fontSize: '0.85rem',
      fontWeight: 600,
    }}
  >
    <WifiOff size={16} />
    <span>{message}</span>
  </div>
);
