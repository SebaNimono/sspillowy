import React, { useEffect, useState } from 'react';
import { Lock, Mail, ArrowRight, Github, Chrome, Code2, Globe } from 'lucide-react';
import { Toast, ToastMessage } from '../components/Toast';
import { AnimatedBackground } from '../components/AnimatedBackground';
import { apiUrl, fetchAuthProviders } from '../api/client';

interface LoginPageProps {
  onLoginSuccess: (email: string, name: string) => void;
  onBack?: () => void;
  oauthError?: string | null;
}

const oauthErrorMessage = (code: string) => {
  switch (code) {
    case 'github_not_configured':
      return 'Falta GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET en el .env.';
    case 'gitlab_not_configured':
      return 'Falta GITLAB_CLIENT_ID / GITLAB_CLIENT_SECRET en el .env.';
    case 'access_denied':
      return 'Cancelaste el acceso en el proveedor.';
    case 'invalid_state':
    case 'state_expired':
      return 'La sesión OAuth expiró. Vuelve a intentar.';
    case 'session_expired':
      return 'No se pudo leer la sesión. Intenta de nuevo.';
    case 'gitlab_http':
      return 'GitLab no respondió. Revisa el Redirect URI y reinicia uvicorn.';
    case 'google_not_configured':
      return 'Falta GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en el .env.';
    case 'google_http':
      return 'Google no respondió. Revisa el redirect URI y que tu Gmail esté en Test users.';
    case 'google_no_email':
      return 'Google no devolvió el correo. Activa el scope email en la pantalla de consentimiento.';
    case 'microsoft_not_configured':
      return 'Falta MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET en el .env.';
    case 'microsoft_http':
      return 'Microsoft no respondió. Revisa el redirect URI (tipo Web) y el tenant common.';
    case 'microsoft_no_email':
      return 'Microsoft no devolvió el correo. Revisa que la app pida email y User.Read.';
    default:
      return 'El proveedor no autorizó el inicio de sesión. Revisa el callback URL y el .env.';
  }
};

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onBack, oauthError }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    if (!oauthError) return;
    setToast({
      id: 'oauth-error',
      type: 'error',
      title: 'Inicio de sesión',
      message: oauthErrorMessage(oauthError),
    });
  }, [oauthError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Campos requeridos',
        message: 'Por favor ingresa tu correo electrónico y contraseña.',
      });
      return;
    }

    const name = isRegister ? fullName || email.split('@')[0] : email.split('@')[0];
    onLoginSuccess(email, name);
  };

  const startOAuth = async (provider: 'github' | 'gitlab' | 'google' | 'microsoft') => {
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
      window.location.href = apiUrl(`/auth/${provider}`);
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
          {isRegister ? 'Crear una cuenta en SSPILLOWY' : 'Iniciar sesión en SSPILLOWY'}
        </h1>
        <p style={{ color: '#656d76', fontSize: '0.85rem', marginTop: '0.2rem' }}>
          Plataforma Integral de Gobernanza DevSecOps
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
            onClick={() => setIsRegister(false)}
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
            onClick={() => setIsRegister(true)}
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

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1f2328', marginBottom: '0.35rem' }}>
                Nombre completo
              </label>
              <input
                type="text"
                placeholder="ej. Sebastián Tralma"
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
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    setToast({
                      id: Date.now().toString(),
                      type: 'info',
                      title: 'Recuperación de clave',
                      message: 'El alta y el acceso van por Google, GitHub, GitLab o Microsoft. El formulario de correo es solo demo.',
                    });
                  }}
                  style={{ fontSize: '0.75rem', color: '#0969da', textDecoration: 'none' }}
                >
                  ¿Olvidaste tu clave?
                </a>
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

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              justifyContent: 'center',
              padding: '0.65rem',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            <span>{isRegister ? 'Registrarse en SSPILLOWY' : 'Ingresar a la Consola'}</span>
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
      </div>

      {/* Footer text */}
      <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#656d76', textAlign: 'center', zIndex: 1 }}>
        SSPILLOWY Security Governance Platform • {new Date().getFullYear()}
      </div>
    </div>
  );
};
