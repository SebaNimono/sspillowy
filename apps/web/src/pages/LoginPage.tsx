import React, { useEffect, useState } from 'react';
import { Lock, Mail, ArrowRight, Github, Chrome, Code2, Globe } from 'lucide-react';
import { Toast, ToastMessage } from '../components/Toast';
import { AnimatedBackground } from '../components/AnimatedBackground';
import {
  apiUrl,
  fetchAuthProviders,
  forgetLastEmail,
  getLastEmail,
  getRememberPreference,
  loginWithPassword,
  registerWithPassword,
  requestPasswordReset,
  resendVerificationEmail,
  setRememberPreference,
} from '../api/client';

const TERMS_ACCEPTED_KEY = 'sspillowy_terms_accepted';

const readTermsAccepted = () => {
  try {
    return localStorage.getItem(TERMS_ACCEPTED_KEY) === '1';
  } catch {
    return false;
  }
};

const persistTermsAccepted = (accepted: boolean) => {
  try {
    if (accepted) localStorage.setItem(TERMS_ACCEPTED_KEY, '1');
    else localStorage.removeItem(TERMS_ACCEPTED_KEY);
  } catch {
    // ignore
  }
};

interface LoginPageProps {
  onLoginSuccess: (email: string, name: string, sessionId?: string) => void;
  onBack?: () => void;
  oauthError?: string | null;
  oauthDetail?: string | null;
}

const oauthErrorMessage = (code: string, detail?: string | null) => {
  const extra = detail ? ` Detalle: ${detail}` : '';
  switch (code) {
    case 'github_not_configured':
      return 'Falta GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET en el .env.';
    case 'gitlab_not_configured':
      return 'Falta GITLAB_CLIENT_ID / GITLAB_CLIENT_SECRET en el .env.';
    case 'access_denied':
      return 'Cancelaste el acceso en el proveedor.';
    case 'invalid_state':
    case 'state_expired':
      return 'La sesión OAuth expiró. Vuelve a intentar (no abras dos pestañas a la vez).';
    case 'session_expired':
      return 'No se pudo completar el inicio de sesión. Vuelve a intentarlo.';
    case 'session_ended':
      return 'Tu sesión expiró o se cerró. Inicia sesión de nuevo para continuar.';
    case 'gitlab_http':
      return 'GitLab no respondió. Revisa el Redirect URI y reinicia uvicorn.';
    case 'google_not_configured':
      return 'Falta GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en Railway.';
    case 'google_redirect_mismatch':
      return 'Google: redirect URI no coincide. Debe ser idéntico en Railway y Google Cloud.' + extra;
    case 'google_invalid_client':
      return 'Google: Client ID o Client Secret incorrectos en Railway.' + extra;
    case 'google_invalid_grant':
      return 'Google: código expirado o Gmail no autorizado (Test users). Usa zoechispitas@gmail.com.' + extra;
    case 'google_http':
      return 'Google no respondió. Revisa redirect URI y Test users.' + extra;
    case 'google_profile_http':
      return 'Google devolvió token pero falló el perfil.' + extra;
    case 'google_no_email':
      return 'Google no devolvió el correo. Activa el scope email en la pantalla de consentimiento.';
    case 'microsoft_not_configured':
      return 'Falta MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET en Railway.';
    case 'microsoft_redirect_mismatch':
      return 'Microsoft: redirect URI no coincide con Azure (pestaña Web).' + extra;
    case 'microsoft_invalid_secret':
      return 'Microsoft: Client Secret inválido o caducado. Crea uno nuevo en Azure y pega el Valor en Railway.' + extra;
    case 'microsoft_invalid_client':
      return 'Microsoft: Client ID o Secret incorrectos en Railway.' + extra;
    case 'microsoft_accounts':
      return 'Microsoft: la app no permite cuentas personales. En Azure → Supported accounts elige personal + work/school.' + extra;
    case 'microsoft_http':
      return 'Microsoft no respondió. Revisa redirect URI (Web) y tenant common.' + extra;
    case 'microsoft_profile_http':
      return 'Microsoft devolvió token pero falló Graph /me. Revisa permiso User.Read.' + extra;
    case 'microsoft_no_email':
      return 'Microsoft no devolvió el correo. Revisa que la app pida email y User.Read.';
    case 'verify_invalid_token':
      return 'El enlace de verificación no es válido. Solicita uno nuevo desde el login.';
    case 'verify_expired_token':
      return 'El enlace de verificación expiró. Solicita uno nuevo desde el login.';
    case 'verify_missing_token':
      return 'Falta el token de verificación en el enlace.';
    default:
      return 'El proveedor no autorizó el inicio de sesión.' + extra;
  }
};

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onBack, oauthError, oauthDetail }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState(getLastEmail);
  const [rememberedEmail, setRememberedEmail] = useState(getLastEmail);
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(readTermsAccepted);
  const [remember, setRemember] = useState(getRememberPreference);
  const [termsHint, setTermsHint] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('email_verified') === '1') {
      setIsRegister(false);
      setIsForgot(false);
      setToast({
        id: 'email-verified',
        type: 'info',
        title: 'Correo verificado',
        message: 'Tu cuenta está activa. Ya puedes iniciar sesión con tu contraseña.',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('password_reset') === '1') {
      setIsForgot(false);
      setIsRegister(false);
      setToast({
        id: 'password-reset-done',
        type: 'success',
        title: 'Contraseña actualizada',
        message: 'Ya puedes iniciar sesión con tu nueva contraseña.',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!oauthError) return;
    setToast({
      id: 'oauth-error',
      type: 'error',
      title: 'Inicio de sesión',
      message: oauthErrorMessage(oauthError, oauthDetail),
    });
  }, [oauthError, oauthDetail]);

  const requireTerms = () => {
    if (acceptedTerms) {
      setTermsHint(false);
      persistTermsAccepted(true);
      setRememberPreference(remember);
      return true;
    }
    setTermsHint(true);
    setToast({
      id: Date.now().toString(),
      type: 'error',
      title: 'Términos pendientes',
      message: 'Marca la casilla: debes aceptar los Términos y Condiciones y la Política de Privacidad para continuar.',
    });
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireTerms()) return;
    if (!email || !password) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Campos requeridos',
        message: 'Por favor ingresa tu correo electrónico y contraseña.',
      });
      return;
    }
    if (isRegister && password.length < 8) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Contraseña corta',
        message: 'La contraseña debe tener al menos 8 caracteres.',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        const result = await registerWithPassword(email.trim(), password, fullName.trim() || undefined);
        if (result.requires_verification) {
          setPendingVerificationEmail(result.email);
          setIsRegister(false);
          setToast({
            id: Date.now().toString(),
            type: 'info',
            title: 'Revisa tu correo',
            message: result.message,
          });
          return;
        }
        if (result.session_id && result.name) {
          onLoginSuccess(result.email, result.name, result.session_id);
        }
        return;
      }

      const result = await loginWithPassword(email.trim(), password, remember);
      onLoginSuccess(result.email, result.name, result.session_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo completar la solicitud.';
      if (message.toLowerCase().includes('verificar')) {
        setPendingVerificationEmail(email.trim());
      }
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: isRegister ? 'Registro' : 'Inicio de sesión',
        message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    const target = pendingVerificationEmail || email.trim();
    if (!target) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Correo requerido',
        message: 'Indica el correo con el que te registraste.',
      });
      return;
    }
    setSubmitting(true);
    try {
      const result = await resendVerificationEmail(target);
      setPendingVerificationEmail(target);
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Verificación',
        message: result.message,
      });
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Verificación',
        message: err instanceof Error ? err.message : 'No se pudo reenviar el enlace.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Correo requerido',
        message: 'Indica el correo con el que te registraste.',
      });
      return;
    }
    setSubmitting(true);
    try {
      const result = await requestPasswordReset(email.trim());
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Revisa tu correo',
        message: result.message,
      });
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Recuperación',
        message: err instanceof Error ? err.message : 'No se pudo enviar el enlace.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const startOAuth = async (provider: 'github' | 'gitlab' | 'google' | 'microsoft') => {
    if (!requireTerms()) return;
    const labels = { github: 'GitHub', gitlab: 'GitLab', google: 'Google', microsoft: 'Microsoft' };
    try {
      const providers = await fetchAuthProviders();
      if (!providers[provider]) {
        setToast({
          id: Date.now().toString(),
          type: 'error',
          title: `${labels[provider]} no configurado`,
          message: `Crea la aplicación OAuth y pega CLIENT_ID y SECRET en las variables de entorno de la API. Reinicia el servidor.`,
        });
        return;
      }
      const query = new URLSearchParams();
      if (remember) query.set('remember', 'true');
      if (rememberedEmail && (provider === 'google' || provider === 'microsoft')) {
        query.set('login_hint', rememberedEmail);
      }
      const qs = query.toString();
      window.location.href = apiUrl(`/auth/${provider}${qs ? `?${qs}` : ''}`);
    } catch {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'API no disponible',
        message: 'En local arranca uvicorn en el puerto 8000. En Vercel configura VITE_API_URL con la URL de Railway y vuelve a desplegar.',
      });
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
      {/* HTML5 Custom Canvas DevSecOps Animated Background */}
      <AnimatedBackground />

      <Toast toast={toast} onClose={() => setToast(null)} />

      {onBack && (
        <button type="button" className="login-back" onClick={onBack}>
          <img src="/sspillowy_favicon.png" alt="" width={18} height={18} />
          <span>SSPILLOWY</span>
        </button>
      )}

      {/* Brand Header with large official PNG Logo without white box */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '1.25rem',
          zIndex: 1,
          animation: 'fadeIn 0.4s ease-out',
        }}
      >
        <img
          src="/sspillowy_logo.png"
          alt="SSPILLOWY Logo"
          style={{
            height: '72px',
            maxWidth: '240px',
            objectFit: 'contain',
            marginBottom: '0.75rem',
            filter: 'drop-shadow(0 4px 12px rgba(140, 149, 159, 0.15))',
          }}
        />
        <h1
          style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            color: '#1f2328',
            letterSpacing: '-0.3px',
          }}
        >
          {isForgot ? 'Recuperar contraseña' : isRegister ? 'Crear una cuenta en SSPILLOWY' : 'Iniciar sesión en SSPILLOWY'}
        </h1>
        <p style={{ color: '#656d76', fontSize: '0.85rem', marginTop: '0.2rem' }}>
          {isForgot
            ? 'Te enviaremos un enlace para definir una contraseña nueva.'
            : 'Plataforma Integral de Gobernanza DevSecOps'}
        </p>
      </div>

      {/* Minimalist GitHub Style Login Card */}
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
        {/* Auth Mode Toggle Tabs */}
        {!isForgot && (
        <div
          style={{
            display: 'flex',
            background: '#f6f8fa',
            padding: '3px',
            borderRadius: '6px',
            marginBottom: '1.25rem',
            border: '1px solid #d0d7de',
          }}
        >
          <button
            type="button"
            onClick={() => { setIsRegister(false); setIsForgot(false); }}
            style={{
              flex: 1,
              padding: '0.45rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              background: !isRegister ? '#ffffff' : 'transparent',
              color: !isRegister ? '#1f2328' : '#656d76',
              boxShadow: !isRegister ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setIsForgot(false); }}
            style={{
              flex: 1,
              padding: '0.45rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              background: isRegister ? '#ffffff' : 'transparent',
              color: isRegister ? '#1f2328' : '#656d76',
              boxShadow: isRegister ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Crear Cuenta
          </button>
        </div>
        )}

        {isForgot ? (
          <form onSubmit={handleForgotSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1f2328', marginBottom: '0.35rem' }}>
                Correo electrónico
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem 0.65rem 2.25rem',
                    borderRadius: '6px',
                    border: '1px solid #d0d7de',
                    background: '#ffffff',
                    color: '#1f2328',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
                <Mail size={16} color="#8c959f" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#656d76', margin: '0 0 1rem', lineHeight: 1.45 }}>
              Si entraste solo con Google o GitHub, usa «Crear cuenta» con el mismo correo para definir una contraseña.
            </p>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', opacity: submitting ? 0.7 : 1 }}
            >
              <span>{submitting ? 'Enviando…' : 'Enviar enlace de recuperación'}</span>
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="site-footer-link"
              style={{ display: 'block', margin: '1rem auto 0', textAlign: 'center' }}
              onClick={() => setIsForgot(false)}
            >
              Volver al inicio de sesión
            </button>
          </form>
        ) : (
        <>
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1f2328', marginBottom: '0.35rem' }}>
                Nombre completo
              </label>
              <input
                type="text"
                placeholder="ej. Ana Pérez"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #d0d7de',
                  background: '#ffffff',
                  color: '#1f2328',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1f2328', marginBottom: '0.35rem' }}>
              Correo electrónico o Gmail
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                placeholder="usuario@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem 0.65rem 2.25rem',
                  borderRadius: '6px',
                  border: '1px solid #d0d7de',
                  background: '#ffffff',
                  color: '#1f2328',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <Mail size={16} color="#8c959f" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1f2328' }}>
                Contraseña
              </label>
              {!isRegister && (
                <button
                  type="button"
                  onClick={() => setIsForgot(true)}
                  style={{ fontSize: '0.75rem', color: '#0969da', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                >
                  ¿Olvidaste tu clave?
                </button>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem 0.65rem 2.25rem',
                  borderRadius: '6px',
                  border: '1px solid #d0d7de',
                  background: '#ffffff',
                  color: '#1f2328',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
              <Lock size={16} color="#8c959f" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          {!isRegister && (
            <div className="login-remember-row">
              <label className="login-terms login-remember">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>
                  Mantener sesión iniciada
                  <small>{remember ? 'Hasta 30 días en este navegador.' : 'Se cierra al cerrar el navegador o tras 12 horas.'}</small>
                </span>
              </label>
              {rememberedEmail && (
                <button
                  type="button"
                  className="login-forget"
                  onClick={() => {
                    forgetLastEmail();
                    setRememberedEmail('');
                    setEmail('');
                  }}
                >
                  Usar otra cuenta
                </button>
              )}
            </div>
          )}

          <label className={`login-terms${termsHint ? ' login-terms--warn' : ''}`}>
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => {
                setAcceptedTerms(e.target.checked);
                if (e.target.checked) setTermsHint(false);
                else persistTermsAccepted(false);
              }}
            />
            <span>
              Acepto los{' '}
              <a href="/terminos" target="_blank" rel="noopener noreferrer">
                Términos y Condiciones
              </a>{' '}
              y la{' '}
              <a href="/privacidad" target="_blank" rel="noopener noreferrer">
                Política de Privacidad
              </a>
              .
            </span>
          </label>
          {termsHint && (
            <p className="login-terms-hint" role="alert">
              Debes aceptar los términos antes de ingresar o registrarte.
            </p>
          )}

          {pendingVerificationEmail && (
            <div className="login-verify-banner">
              <p>
                Pendiente verificar <strong>{pendingVerificationEmail}</strong>. Revisa tu bandeja (y spam).
              </p>
              <button
                type="button"
                className="site-footer-link"
                disabled={submitting}
                onClick={handleResendVerification}
              >
                Reenviar enlace de verificación
              </button>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '0.65rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              opacity: submitting ? 0.7 : acceptedTerms ? 1 : 0.85,
            }}
          >
            <span>
              {submitting
                ? 'Espera…'
                : isRegister
                  ? 'Registrarse en SSPILLOWY'
                  : 'Ingresar a la Consola'}
            </span>
            <ArrowRight size={16} />
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', gap: '0.5rem' }}>
          <div style={{ flex: 1, height: '1px', background: '#d0d7de' }}></div>
          <span style={{ fontSize: '0.75rem', color: '#656d76', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            O ingresar con
          </span>
          <div style={{ flex: 1, height: '1px', background: '#d0d7de' }}></div>
        </div>

        {/* OAuth SSO Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => startOAuth('google')}
            style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '0.5rem' }}
          >
            <Chrome size={15} color="#ea4335" />
            <span>Google</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => startOAuth('github')}
            style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '0.5rem' }}
          >
            <Github size={15} color="#24292f" />
            <span>GitHub</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => startOAuth('gitlab')}
            style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '0.5rem' }}
          >
            <Code2 size={15} color="#fc6d26" />
            <span>GitLab</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => startOAuth('microsoft')}
            style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '0.5rem' }}
          >
            <Globe size={15} color="#00a4ef" />
            <span>Microsoft</span>
          </button>
        </div>
        </>
        )}
      </div>

      {/* Footer text */}
      <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#656d76', textAlign: 'center', zIndex: 1 }}>
        SSPILLOWY Security Governance Platform • {new Date().getFullYear()}
      </div>
    </div>
  );
};
