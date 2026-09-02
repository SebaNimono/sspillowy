import React, { useEffect, useState } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { AnimatedBackground } from '../components/AnimatedBackground';
import { Toast, ToastMessage } from '../components/Toast';
import { resetPassword, validatePasswordResetToken } from '../api/client';

interface ResetPasswordPageProps {
  token: string;
  onGoLogin: () => void;
  onBack?: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ token, onGoLogin, onBack }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    validatePasswordResetToken(token)
      .then((res) => {
        setEmail(res.email);
        setInvalid(false);
      })
      .catch(() => setInvalid(true))
      .finally(() => setChecking(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Contraseña corta',
        message: 'La contraseña debe tener al menos 8 caracteres.',
      });
      return;
    }
    if (password !== confirm) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'No coinciden',
        message: 'Las contraseñas deben ser iguales.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await resetPassword(token, password);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Contraseña actualizada',
        message: result.message,
      });
      window.setTimeout(onGoLogin, 1500);
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'No se pudo guardar',
        message: err instanceof Error ? err.message : 'Intenta solicitar un nuevo enlace.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f6f8fa',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        fontFamily: 'var(--font-sans)',
        position: 'relative',
      }}
    >
      <AnimatedBackground />
      <Toast toast={toast} onClose={() => setToast(null)} />

      {onBack && (
        <button type="button" className="login-back" onClick={onBack}>
          <img src="/sspillowy_favicon.png" alt="" width={18} height={18} />
          <span>SSPILLOWY</span>
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem', zIndex: 1 }}>
        <img
          src="/sspillowy_logo.png"
          alt="SSPILLOWY Logo"
          style={{ height: '72px', maxWidth: '240px', objectFit: 'contain', marginBottom: '0.75rem' }}
        />
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1f2328' }}>Nueva contraseña</h1>
        <p style={{ color: '#656d76', fontSize: '0.85rem', marginTop: '0.2rem', textAlign: 'center', maxWidth: '22rem' }}>
          {checking
            ? 'Validando enlace…'
            : invalid
              ? 'Este enlace no es válido o expiró.'
              : `Define una contraseña nueva para ${email}.`}
        </p>
      </div>

      <div
        className="custom-toast"
        style={{
          width: '100%',
          maxWidth: '380px',
          background: '#ffffff',
          border: '1px solid #d0d7de',
          borderRadius: '10px',
          padding: '1.75rem',
          boxShadow: '0 12px 32px rgba(140, 149, 159, 0.18)',
          zIndex: 1,
        }}
      >
        {checking ? (
          <p style={{ color: '#656d76', fontSize: '0.9rem', textAlign: 'center' }}>Espera un momento…</p>
        ) : invalid ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#656d76', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Solicita un nuevo enlace desde la pantalla de inicio de sesión.
            </p>
            <button type="button" className="btn btn-primary" onClick={onGoLogin} style={{ width: '100%', justifyContent: 'center' }}>
              Ir al login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1f2328', marginBottom: '0.35rem' }}>
                Nueva contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem 0.65rem 2.25rem',
                    borderRadius: '6px',
                    border: '1px solid #d0d7de',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
                <Lock size={16} color="#8c959f" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1f2328', marginBottom: '0.35rem' }}>
                Confirmar contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  placeholder="Repite la contraseña"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem 0.65rem 2.25rem',
                    borderRadius: '6px',
                    border: '1px solid #d0d7de',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
                <Lock size={16} color="#8c959f" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', opacity: submitting ? 0.7 : 1 }}
            >
              <span>{submitting ? 'Guardando…' : 'Guardar contraseña'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
