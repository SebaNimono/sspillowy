import React, { useState } from 'react';
import { ArrowRight, BookOpen, UserRound, LogOut, ChevronDown } from 'lucide-react';
import { AnimatedBackground } from '../components/AnimatedBackground';

interface LandingPageProps {
  user: { email: string; name: string } | null;
  onCuenta: () => void;
  onOpenConsole: () => void;
  onLogout: () => void;
}

const engines = [
  { name: 'Semgrep', layer: 'SAST', role: 'Patrones de código vulnerable sobre el AST. OWASP Top 10.' },
  { name: 'Trivy', layer: 'SCA / IaC', role: 'CVEs en dependencias, Dockerfiles y manifiestos.' },
  { name: 'GitLeaks', layer: 'Secretos', role: 'Tokens, claves y credenciales en historial Git.' },
  { name: 'OWASP ZAP', layer: 'DAST', role: 'Encabezados, CORS y endpoints HTTP en runtime.' },
];

const steps = [
  { n: '01', title: 'Disparador', text: 'Webhook de Git (push/PR) o un escaneo manual desde el Web Hub.' },
  { n: '02', title: 'Workers', text: 'ARQ clona el repo y corre Semgrep, Trivy y GitLeaks en paralelo.' },
  { n: '03', title: 'Normalización', text: 'Las salidas se unifican en un JSON común. Sin inventar hallazgos.' },
  { n: '04', title: 'Triaje HITL', text: 'La IA propone alcanzabilidad y parche. Un auditor valida o descarta.' },
  { n: '05', title: 'Gobernanza', text: 'Security Gate bloquea el pipeline. Pulse aprueba excepciones. Queda evidencia.' },
];

const services = [
  {
    title: 'Alcance de repositorios',
    text: 'Registro de Git (GitHub, GitLab, Bitbucket), rama vigilada y disparo de escaneo bajo demanda o por webhook.',
  },
  {
    title: 'Matriz unificada de hallazgos',
    text: 'CWE, OWASP e ISO 27001 en una sola tabla. Filtro por motor, severidad y estado HITL.',
  },
  {
    title: 'Security Gates CI/CD',
    text: 'Umbral de críticas/altas, bloqueo por secretos y bypass solo con aprobación (Web o Pulse).',
  },
  {
    title: 'Evidencia y reportes',
    text: 'Mapa de calor, bitácora de eventos y paquete JSON de evidencia ISO/IEC 27001:2022.',
  },
];

const faqs = [
  {
    q: '¿La IA cierra vulnerabilidades sola?',
    a: 'No. Detectan los motores (Semgrep, Trivy, GitLeaks, ZAP). El LLM Router solo propone alcanzabilidad y un parche. El estado (FIXED, falso positivo, riesgo aceptado) lo firma un auditor.',
  },
  {
    q: '¿Qué diferencia hay entre Web Hub y Pulse?',
    a: 'El Hub es la consola de auditoría (código, gates, informes). Pulse es el centro de comando móvil: push ante críticas o secretos, y bypass biométrico del pipeline. Pulse se construye en paralelo; el Hub ya reserva esa capa.',
  },
  {
    q: '¿Hay que pagar por los escáneres?',
    a: 'No para el proyecto. Semgrep, Trivy, GitLeaks y OWASP ZAP son open source. SSPILLOWY los orquesta; no sustituye sus licencias de empresa si un día se usan reglas comerciales.',
  },
  {
    q: '¿Dónde corre hoy?',
    a: 'El sitio y el Hub se prueban en local (Vite 5173 + FastAPI 8000). El front puede ir a Vercel. PostgreSQL y Redis entran cuando el worker deje de ser mock.',
  },
  {
    q: '¿Cómo entro si ya tengo sesión?',
    a: 'Arriba a la derecha, Cuenta abre tu perfil (consola o cerrar sesión). Consola entra directo al Hub. Si no hay sesión, Cuenta abre el login.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ user, onCuenta, onOpenConsole, onLogout }) => {
  const [accountOpen, setAccountOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleCuenta = () => {
    if (user) {
      setAccountOpen((open) => !open);
      return;
    }
    onCuenta();
  };

  return (
    <div className="site">
      <header className="site-nav">
        <div className="site-nav-inner">
          <a href="#inicio" className="site-brand">
            <img src="/sspillowy_favicon.png" alt="" width={22} height={22} />
            <span>SSPILLOWY</span>
          </a>

          <nav className="site-nav-links">
            <a href="#plataforma">Plataforma</a>
            <a href="#servicios">Servicios</a>
            <a href="#documentacion">Documentación</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="site-nav-actions">
            {user && (
              <button type="button" className="btn btn-secondary" onClick={onOpenConsole}>
                Consola
              </button>
            )}
            <div className="site-account">
              <button className="btn btn-primary site-cuenta" onClick={handleCuenta}>
                {user ? (
                  <span className="site-avatar">{user.name.charAt(0).toUpperCase()}</span>
                ) : (
                  <UserRound size={15} />
                )}
                <span>Cuenta</span>
                {user && <ChevronDown size={14} />}
              </button>
              {user && accountOpen && (
                <div className="site-account-menu">
                  <div className="site-account-meta">
                    <div>{user.name}</div>
                    <div>{user.email}</div>
                  </div>
                  <button type="button" onClick={() => { setAccountOpen(false); onOpenConsole(); }}>
                    Ir a la consola
                  </button>
                  <button
                    type="button"
                    className="site-account-logout"
                    onClick={() => { setAccountOpen(false); onLogout(); }}
                  >
                    <LogOut size={14} />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="site-hero" id="inicio">
        <AnimatedBackground contained />
        <div className="site-shell site-hero-grid">
          <div className="site-hero-copy">
            <div className="site-kicker">Web Hub · DevSecOps</div>
            <h1>Gobernanza de seguridad de software, sin mezclar detección e interpretación.</h1>
            <p>
              SSPILLOWY orquesta Semgrep, Trivy, GitLeaks y OWASP ZAP, unifica los hallazgos y deja
              el cierre en manos humanas. La IA sugiere. No decide.
            </p>
            <div className="site-hero-actions">
              <button className="btn btn-primary" onClick={user ? onOpenConsole : onCuenta}>
                <span>{user ? 'Abrir consola' : 'Cuenta'}</span>
                <ArrowRight size={16} />
              </button>
              <a href="#documentacion" className="btn btn-secondary site-hero-docs">
                <BookOpen size={15} />
                <span>Documentación</span>
              </a>
            </div>
          </div>

          <div className="site-terminal" aria-hidden="true">
            <div className="site-terminal-bar">
              <span />
              <span />
              <span />
              <em>sspillowy scan</em>
            </div>
            <pre>
{`$ sspillowy scan --repo payment-gateway \\
    --engines semgrep,trivy,gitleaks

 GitLeaks   CRITICAL  CWE-798   secret in history
 Semgrep    CRITICAL  CWE-89    sql concat  [AI 94%]
 Trivy      HIGH      CVE-2024  runc in base image

 SecurityGate  BLOCKED  max_critical=0
 HITL          waiting  auditor must confirm`}
              <span className="site-cursor">█</span>
            </pre>
          </div>
        </div>
      </section>

      <section className="site-shell" id="plataforma">
        <div className="site-kicker">Flujo</div>
        <h2 className="site-h2">De un push a una decisión auditada</h2>
        <ol className="site-steps">
          {steps.map((step) => (
            <li key={step.n}>
              <span className="site-step-n">{step.n}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="site-split">
          <article>
            <h3>Web Hub</h3>
            <p>
              Auditoría: repositorios, matriz de hallazgos, mapa de calor, Security Gates,
              notificaciones y paquete de evidencia ISO/IEC 27001:2022.
            </p>
          </article>
          <article>
            <h3>Pulse</h3>
            <p>
              Centro de comando móvil. Bypass de pipeline con biometría y push cuando hay
              crítica o secreto filtrado. Todavía en construcción; el Hub ya habla con esa capa.
            </p>
          </article>
        </div>
      </section>

      <section className="site-band" id="servicios">
        <div className="site-shell">
          <div className="site-kicker">Servicios</div>
          <h2 className="site-h2">Qué cubre la plataforma hoy</h2>
          <p className="site-lead">
            Capas del Web Hub alineadas al documento técnico. El worker real (Semgrep primero) es el siguiente tramo de código.
          </p>
          <div className="site-services">
            {services.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="site-shell" id="motores">
        <div className="site-kicker">Detección determinista</div>
        <h2 className="site-h2">Quién detecta. Quién interpreta.</h2>
        <p className="site-lead">
          Los motores no alucinan. La IA no abre ni cierra tickets. Ese corte es el producto.
        </p>
        <div className="table-container site-table">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Motor</th>
                <th>Capa</th>
                <th>Qué cubre</th>
              </tr>
            </thead>
            <tbody>
              {engines.map((engine) => (
                <tr key={engine.name}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{engine.name}</td>
                  <td><span className="badge badge-engine">{engine.layer}</span></td>
                  <td style={{ color: 'var(--fg-muted)' }}>{engine.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="site-shell" id="documentacion">
        <div className="site-kicker">Documentación</div>
        <h2 className="site-h2">Contratos, reglas y stack</h2>
        <div className="site-docs">
          <article>
            <h3>API</h3>
            <p>REST en <code>/api/v1</code>. OpenAPI vive en <code>/docs</code> cuando el core está arriba (puerto 8000).</p>
            <ul>
              <li><code>GET /health</code></li>
              <li><code>GET /api/v1/stats</code> · heatmap · audit-log</li>
              <li><code>GET/POST /api/v1/repositories</code> · scans</li>
              <li><code>GET/PATCH /api/v1/findings</code></li>
              <li><code>GET /api/v1/compliance/iso27001</code></li>
            </ul>
          </article>
          <article>
            <h3>Human-in-the-loop</h3>
            <p>Estados de hallazgo: OPEN, IN_REVIEW, FIXED, FALSE_POSITIVE, ACCEPTED_RISK. Solo un auditor transiciona. El LLM Router redacta remediación y un índice de confianza; no firma el cierre.</p>
          </article>
          <article>
            <h3>Stack</h3>
            <p>FastAPI 3.12, PostgreSQL 16, Redis + ARQ, React + TypeScript. Observabilidad prevista: Prometheus, Grafana, Sentry. Calidad interna: Pytest, SonarQube, JMeter.</p>
          </article>
        </div>
      </section>

      <section className="site-band" id="faq">
        <div className="site-shell">
          <div className="site-kicker">FAQ</div>
          <h2 className="site-h2">Preguntas frecuentes</h2>
          <div className="site-faq">
            {faqs.map((item, index) => {
              const open = openFaq === index;
              return (
                <div key={item.q} className={`site-faq-item ${open ? 'open' : ''}`}>
                  <button type="button" onClick={() => setOpenFaq(open ? null : index)}>
                    <span>{item.q}</span>
                    <ChevronDown size={16} />
                  </button>
                  {open && <p>{item.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-shell site-footer-inner">
          <span>SSPILLOWY · Software Security Platform for Intelligent, Low-latency Oversight &amp; Warning Yield</span>
          <button type="button" className="site-footer-link" onClick={user ? onOpenConsole : onCuenta}>
            {user ? 'Consola' : 'Cuenta'}
          </button>
        </div>
      </footer>
    </div>
  );
};
