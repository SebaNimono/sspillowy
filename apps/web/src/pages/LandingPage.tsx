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

const modules = [
  {
    name: 'Matriz HITL',
    layer: 'Hallazgos',
    text: 'CWE, OWASP e ISO en una tabla. El auditor pasa OPEN a IN_REVIEW, FIXED, falso positivo o riesgo aceptado.',
  },
  {
    name: 'Security Gates',
    layer: 'CI/CD',
    text: 'Umbral de críticas y altas. Un secreto bloquea el pipeline. El bypass no es un botón suelto: queda firmado.',
  },
  {
    name: 'Informes ISO 27001',
    layer: 'Evidencia',
    text: 'Paquete JSON de controles A.8 / A.14. Pensado para auditoría, no para un PDF de marketing.',
  },
  {
    name: 'Mapa de calor',
    layer: 'Hub',
    text: 'Actividad de hallazgos a 12 semanas, tendencia a 7 días y bitácora. Misma consola, mismo criterio.',
  },
  {
    name: 'Pulse',
    layer: 'Móvil',
    text: 'Push ante crítica o secreto y excepción biométrica. En construcción; el Hub ya reserva la capa.',
  },
  {
    name: 'SSO',
    layer: 'Acceso',
    text: 'GitHub, GitLab, Google y Microsoft. El primer login es el alta. Sin segunda cuenta SSPILLOWY.',
  },
];

const facts = [
  { value: '4', label: 'Motores OSS', hint: 'Semgrep, Trivy, GitLeaks, ZAP' },
  { value: 'HITL', label: 'Cierre humano', hint: 'La IA no firma FIXED' },
  { value: 'ISO', label: 'Evidencia 27001', hint: 'Paquete JSON de controles' },
  { value: 'SSO', label: 'GitHub · GitLab · Google · Microsoft', hint: 'Misma cuenta, sin alta extra' },
];

const principles = [
  { k: 'Detecta', v: 'El motor. AST, CVE, secreto o runtime. Determinista.' },
  { k: 'Propone', v: 'El LLM Router. Alcanzabilidad y parche. Nunca cierra.' },
  { k: 'Firma', v: 'El auditor. OPEN → IN_REVIEW → FIXED / falso positivo / riesgo.' },
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
    a: 'El Hub está en Vercel. La API (OAuth y REST) en Railway. En local: Vite 5173 + FastAPI 8000. PostgreSQL, Redis y el worker real (Semgrep primero) son el siguiente tramo; el Hub aún usa datos de demostración en varias vistas.',
  },
  {
    q: '¿Usáis cookies de publicidad?',
    a: 'No. Solo las necesarias para la sesión SSO y recordar si aceptaste o no el aviso. No hay Google Analytics ni redes de anuncios. Puedes cambiarlo en el pie (Cookies) o en Privacidad.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ user, onCuenta, onOpenConsole, onLogout }) => {
  const [accountOpen, setAccountOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
            <a href="#servicios">Módulos</a>
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
            <ul className="site-hero-chips">
              <li>SAST · Semgrep</li>
              <li>SCA · Trivy</li>
              <li>Secretos · GitLeaks</li>
              <li>DAST · ZAP</li>
            </ul>
            <div className="site-hero-actions">
              <button className="btn btn-primary" onClick={user ? onOpenConsole : onCuenta}>
                <span>{user ? 'Abrir consola' : 'Empezar'}</span>
                <ArrowRight size={16} />
              </button>
              <a href="#servicios" className="btn btn-secondary site-hero-docs">
                <span>Ver la plataforma</span>
              </a>
              <a href="#documentacion" className="btn btn-secondary site-hero-docs">
                <BookOpen size={15} />
                <span>Docs</span>
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

      <section className="site-facts" aria-label="Hechos de la plataforma">
        <div className="site-shell site-facts-row">
          {facts.map((fact) => (
            <div key={fact.label} className="site-fact">
              <strong>{fact.value}</strong>
              <span>{fact.label}</span>
              <em>{fact.hint}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="site-shell" id="plataforma">
        <div className="site-kicker">Regla de producto</div>
        <h2 className="site-h2">Quién hace qué. Sin ambigüedad.</h2>
        <ol className="site-principles">
          {principles.map((item, i) => (
            <li key={item.k}>
              <span className="site-principle-n">0{i + 1}</span>
              <div>
                <strong>{item.k}</strong>
                <p>{item.v}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="site-kicker site-kicker-spaced">Flujo</div>
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
          <div className="site-kicker">Módulos</div>
          <h2 className="site-h2">Una consola. Varias capas. El mismo criterio.</h2>
          <p className="site-lead">
            Del repo al gate: el Hub agrupa lo que los motores encuentran. Pulse llega después; no sustituye la auditoría.
          </p>
          <div className="site-modules">
            {modules.map((item) => (
              <article key={item.name}>
                <span>{item.layer}</span>
                <h3>{item.name}</h3>
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
            <p>REST en <code>/api/v1</code>. OpenAPI en <code>/docs</code> cuando el core está arriba. Auth SSO en <code>/api/v1/auth/&#123;github|gitlab|google|microsoft&#125;</code>.</p>
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
              const panelId = `faq-panel-${index}`;
              return (
                <div key={item.q} className={`site-faq-item ${open ? 'open' : ''}`}>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenFaq(open ? null : index)}
                  >
                    <span>{item.q}</span>
                    <ChevronDown size={16} />
                  </button>
                  <div className="site-faq-panel" id={panelId} role="region">
                    <p>{item.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="site-cta" id="cuenta-cta">
        <div className="site-shell">
          <div className="site-kicker">Siguiente paso</div>
          <h2>El cierre lo firma un auditor. Empieza por la consola.</h2>
          <p>
            SSO con GitHub, GitLab, Google o Microsoft. Sin segunda cuenta. El worker real (Semgrep primero) es el siguiente tramo de código; el Hub ya está para recorrer el flujo.
          </p>
          <div className="site-hero-actions">
            <button className="btn btn-primary" onClick={user ? onOpenConsole : onCuenta}>
              <span>{user ? 'Abrir consola' : 'Empezar'}</span>
              <ArrowRight size={16} />
            </button>
            <a href="#faq" className="btn btn-secondary site-hero-docs">FAQ</a>
          </div>
        </div>
      </section>

      <section className="site-shell" id="privacidad">
        <div className="site-kicker">Legal</div>
        <h2 className="site-h2">Privacidad y cookies</h2>
        <div className="site-privacy">
          <article>
            <h3>Qué guardamos en el navegador</h3>
            <p>
              Sesión de cuenta (SSO) y preferencia de cookies. El sidebar de la consola recuerda si está plegado.
              No vendemos datos. El login ocurre en GitHub, GitLab, Google o Microsoft; ellos autentican, nosotros recibimos email y nombre.
            </p>
          </article>
          <article>
            <h3>Cookies</h3>
            <p>
              <strong>Necesarias:</strong> funcionamiento del Hub y esta elección. <strong>Opcionales:</strong> hoy no hay analítica ni anuncios de terceros; «Aceptar» deja constancia de la preferencia.
            </p>
            <button
              type="button"
              className="site-footer-link"
              onClick={() => window.dispatchEvent(new Event('sspillowy-cookie-open'))}
            >
              Cambiar preferencia de cookies
            </button>
          </article>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-shell site-footer-grid">
          <div>
            <strong>SSPILLOWY</strong>
            <p>Software Security Platform for Intelligent, Low-latency Oversight &amp; Warning Yield.</p>
          </div>
          <div>
            <span>Plataforma</span>
            <a href="#plataforma">Flujo HITL</a>
            <a href="#servicios">Módulos</a>
            <a href="#motores">Motores</a>
          </div>
          <div>
            <span>Documentación</span>
            <a href="#documentacion">API y stack</a>
            <a href="#faq">FAQ</a>
            <button type="button" onClick={user ? onOpenConsole : onCuenta}>{user ? 'Consola' : 'Empezar'}</button>
          </div>
          <div>
            <span>Legal</span>
            <a href="#privacidad">Privacidad</a>
            <button type="button" onClick={() => window.dispatchEvent(new Event('sspillowy-cookie-open'))}>Cookies</button>
          </div>
        </div>
      </footer>
    </div>
  );
};
