import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, LogIn, RefreshCw, Shield, UserPlus } from 'lucide-react';
import {
  InvitationDetails,
  acceptWorkspaceInvitation,
  getInvitationDetails,
  logoutSession,
  switchWorkspace,
} from '../api/client';

interface AcceptInvitePageProps {
  token: string;
  currentUser?: { email: string; name?: string } | null;
  onGoHome: () => void;
  onGoLogin: (returnTo?: string) => void;
  onGoRegister: (returnTo?: string) => void;
  onAcceptSuccess: () => void;
}

export const AcceptInvitePage: React.FC<AcceptInvitePageProps> = ({
  token,
  currentUser,
  onGoHome,
  onGoLogin,
  onGoRegister,
  onAcceptSuccess,
}) => {
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('El enlace de invitación es inválido o no incluye el token requerido.');
      setLoading(false);
      return;
    }

    getInvitationDetails(token)
      .then((res) => {
        setDetails(res);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la invitación.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      const res = await acceptWorkspaceInvitation(token);
      setAccepted(true);
      switchWorkspace(res.workspace_id);
      setTimeout(() => {
        onAcceptSuccess();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al aceptar la invitación.');
      setAccepting(false);
    }
  };

  const handleSwitchAccount = async () => {
    await logoutSession();
    window.location.reload();
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        <RefreshCw size={28} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Verificando invitación...</p>
      </div>
    );
  }

  const currentPathWithToken = `/invitacion?token=${encodeURIComponent(token)}`;

  return (
    <div style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: '#f8fafc' }}>
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Cabecera */}
        <div style={{ padding: '1.5rem 1.75rem', background: '#0d1117', borderBottom: '1px solid #21262d', color: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
            <img src="/sspillowy_favicon.png" alt="SSPILLOWY" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', color: '#7d8590', textTransform: 'uppercase' }}>
              Invitación a Espacio
            </span>
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f0f6fc' }}>
            {details ? details.workspace_name : 'SSPILLOWY'}
          </h1>
        </div>

        {/* Contenido */}
        <div style={{ padding: '1.75rem' }}>
          {error && (
            <div
              style={{
                padding: '1rem',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '0.875rem',
                display: 'flex',
                gap: '0.65rem',
                marginBottom: '1.25rem',
              }}
            >
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <div>
                <strong>No fue posible continuar:</strong>
                <p style={{ margin: '0.25rem 0 0', lineHeight: 1.45 }}>{error}</p>
              </div>
            </div>
          )}

          {accepted ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <CheckCircle2 size={48} color="#16a34a" style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>
                ¡Invitación aceptada con éxito!
              </h2>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                Te has unido a <strong>{details?.workspace_name}</strong>. Redirigiendo a tu consola de seguridad...
              </p>
            </div>
          ) : details ? (
            <>
              <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#1e293b', lineHeight: 1.55 }}>
                <strong>{details.invited_by || 'Un administrador'}</strong> te ha invitado a colaborar en el espacio de trabajo{' '}
                <strong>"{details.workspace_name}"</strong> con el rol de:
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  marginBottom: '1.25rem',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#0284c7', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                    {details.role_label}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Invitación enviada a: <strong>{details.email}</strong>
                  </div>
                </div>
              </div>

              {/* Casos según sesión */}
              {currentUser ? (
                currentUser.email.toLowerCase() === details.email.toLowerCase() ? (
                  <div>
                    <button
                      type="button"
                      onClick={handleAccept}
                      disabled={accepting}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1.25rem',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        background: '#16a34a',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: accepting ? 'not-allowed' : 'pointer',
                        opacity: accepting ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)',
                      }}
                    >
                      {accepting ? <RefreshCw size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={18} />}
                      {accepting ? 'Aceptando invitación...' : 'Aceptar Invitación y Entrar a la Consola'}
                    </button>
                    <p style={{ margin: '0.75rem 0 0', textAlign: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                      Has iniciado sesión como <strong>{currentUser.email}</strong>.
                    </p>
                  </div>
                ) : (
                  <div style={{ padding: '0.85rem 1rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', fontSize: '0.85rem', color: '#92400e' }}>
                    <p style={{ margin: '0 0 0.5rem' }}>
                      Actualmente has iniciado sesión como <strong>{currentUser.email}</strong>, pero esta invitación fue enviada a <strong>{details.email}</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={handleSwitchAccount}
                      style={{
                        padding: '0.45rem 0.85rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#92400e',
                        background: '#ffffff',
                        border: '1px solid #fde68a',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      Cerrar sesión e ingresar con {details.email}
                    </button>
                  </div>
                )
              ) : (
                <div>
                  <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#64748b' }}>
                    Para aceptar la invitación y acceder a la plataforma, inicia sesión o crea tu cuenta con <strong>{details.email}</strong>:
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => onGoLogin(currentPathWithToken)}
                      style={{
                        flex: 1,
                        padding: '0.65rem 1rem',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#ffffff',
                        background: '#0969da',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <LogIn size={15} /> Iniciar Sesión
                    </button>
                    <button
                      type="button"
                      onClick={() => onGoRegister(currentPathWithToken)}
                      style={{
                        flex: 1,
                        padding: '0.65rem 1rem',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: '#24292f',
                        background: '#ffffff',
                        border: '1px solid #d0d7de',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <UserPlus size={15} /> Crear Cuenta
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <button
                type="button"
                onClick={onGoHome}
                style={{
                  padding: '0.55rem 1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#475569',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Volver al Inicio
              </button>
            </div>
          )}
        </div>

        {/* Pie */}
        <div style={{ padding: '0.85rem 1.75rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>SSPILLOWY · Seguridad y Gobernanza</span>
          <button
            type="button"
            onClick={onGoHome}
            style={{ background: 'none', border: 'none', color: '#0969da', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}
          >
            Ir a sspillowy.com
          </button>
        </div>
      </div>
    </div>
  );
};
