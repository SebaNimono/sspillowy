import React, { useEffect, useState } from 'react';
import { ArrowRight, UserRound, LogOut, ChevronDown } from 'lucide-react';
import { AnimatedBackground } from '../components/AnimatedBackground';
import { Reveal } from '../components/Reveal';
import { StackMarquee } from '../components/StackMarquee';
import { CountUp } from '../components/CountUp';
import { ScrollProgress } from '../components/ScrollProgress';
import { ScanTerminal } from '../components/ScanTerminal';
import { HubPreview } from '../components/HubPreview';
import { HeroMotion } from '../components/HeroMotion';
import { PipelineScrollScene } from '../components/PipelineScrollScene';
import { EngineOrchestrator } from '../components/EngineOrchestrator';
import { ModuleMotionGrid } from '../components/ModuleMotionGrid';
import { PrinciplesScene } from '../components/PrinciplesScene';
import { motion, MotionConfig } from 'framer-motion';

interface LandingPageProps {
  user: { email: string; name: string } | null;
  onCuenta: () => void;
  onOpenConsole: () => void;
  onLogout: () => void;
}

const steps = [
  {
    n: '01',
    title: 'Disparador',
    text: 'Webhook de Git (push/PR) o un escaneo manual desde el Web Hub.',
    marks: ['github', 'gitlab'] as const,
  },
  {
    n: '02',
    title: 'Workers',
    text: 'ARQ clona el repo y corre Semgrep, Trivy y GitLeaks en paralelo.',
    marks: ['semgrep', 'trivy', 'gitleaks'] as const,
  },
  {
    n: '03',
    title: 'Normalización',
    text: 'Las salidas se unifican en un JSON común. Sin inventar hallazgos.',
    marks: ['cwe'] as const,
  },
  {
    n: '04',
    title: 'Triaje HITL',
    text: 'La IA propone alcanzabilidad y parche. Un auditor valida o descarta.',
    marks: ['hitl'] as const,
  },
  {
    n: '05',
    title: 'Gobernanza',
    text: 'Security Gate bloquea el pipeline. Pulse aprueba excepciones. Queda evidencia.',
    marks: ['iso'] as const,
  },
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

const facts: Array<{ count?: number; text?: string; label: string; hint: string }> = [
  { count: 4, label: 'Motores OSS', hint: 'Semgrep, Trivy, GitLeaks, ZAP' },
  { count: 5, label: 'Estados HITL', hint: 'OPEN hasta riesgo aceptado' },
  { count: 4, label: 'Proveedores SSO', hint: 'GitHub, GitLab, Google, Microsoft' },
  { text: 'ISO', label: 'Evidencia 27001', hint: 'Paquete JSON de controles' },
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
  const [factsOn, setFactsOn] = useState(false);
  const [activeNav, setActiveNav] = useState('plataforma');

  useEffect(() => {
    const ids = ['plataforma', 'servicios', 'documentacion', 'faq'];
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!nodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveNav(visible.target.id);
      },
      { rootMargin: '-28% 0px -55% 0px', threshold: [0.1, 0.25, 0.5] },
    );
    nodes.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const handleCuenta = () => {
    if (user) {
      setAccountOpen((open) => !open);
      return;
    }
    onCuenta();
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="site">
      <ScrollProgress />
      <header className="site-nav">
        <div className="site-nav-inner">
          <a href="#inicio" className="site-brand">
            <img src="/sspillowy_favicon.png" alt="" width={22} height={22} />
            <span>SSPILLOWY</span>
          </a>

          <nav className="site-nav-links">
            <a href="#plataforma" className={activeNav === 'plataforma' ? 'is-active' : ''}>Plataforma</a>
            <a href="#servicios" className={activeNav === 'servicios' ? 'is-active' : ''}>Módulos</a>
            <a href="#documentacion" className={activeNav === 'documentacion' ? 'is-active' : ''}>Documentación</a>
            <a href="#faq" className={activeNav === 'faq' ? 'is-active' : ''}>FAQ</a>
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
          <HeroMotion user={user} onCuenta={onCuenta} onOpenConsole={onOpenConsole} />

          <motion.div
            initial={{ opacity: 0, x: 24, rotateY: -6 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <ScanTerminal />
          </motion.div>
        </div>
      </section>

      <StackMarquee />

      <Reveal as="section" className="site-facts" aria-label="Hechos de la plataforma" onInView={() => setFactsOn(true)}>
        <div className="site-shell site-facts-row">
          {facts.map((fact) => (
            <div key={fact.label} className="site-fact">
              <strong>
                {fact.count != null ? <CountUp to={fact.count} active={factsOn} /> : fact.text}
              </strong>
              <span>{fact.label}</span>
              <em>{fact.hint}</em>
            </div>
          ))}
        </div>
      </Reveal>

      <section className="site-stage" id="plataforma">
        <div className="site-shell">
          <Reveal>
            <div className="site-kicker">Flujo</div>
            <h2 className="site-h2 site-h2-dark">De un push a una decisión auditada</h2>
            <PipelineScrollScene steps={steps} />
            <div className="site-kicker site-kicker-spaced">Quién hace qué</div>
            <PrinciplesScene principles={principles} />
          </Reveal>
        </div>
      </section>

      <section className="site-shell">
        <Reveal>
          <HubPreview />
        </Reveal>
      </section>

      <section className="site-band" id="servicios">
        <div className="site-shell">
          <Reveal>
          <div className="site-kicker">Módulos</div>
          <h2 className="site-h2">Una consola. Varias capas. El mismo criterio.</h2>
          <p className="site-lead">
            Del repo al gate: el Hub agrupa lo que los motores encuentran. Pulse llega después; no sustituye la auditoría.
          </p>
          <ModuleMotionGrid modules={modules} />
          </Reveal>
        </div>
      </section>

      <section className="site-shell" id="motores">
        <Reveal>
        <div className="site-kicker">Detección determinista</div>
        <h2 className="site-h2">Quién detecta. Quién interpreta.</h2>
        <p className="site-lead">
          Los motores no alucinan. La IA no abre ni cierra tickets. Ese corte es el producto.
        </p>
        <div className="site-frame site-frame-light site-engines-scene">
          <div className="site-frame-bar">
            <span />
            <span />
            <span />
            <em>engines · orchestration</em>
          </div>
          <EngineOrchestrator />
        </div>
        </Reveal>
      </section>

      <section className="site-shell" id="documentacion">
        <Reveal>
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
        </Reveal>
      </section>

      <section className="site-band" id="faq">
        <div className="site-shell">
          <Reveal>
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
          </Reveal>
        </div>
      </section>

      <section className="site-cta" id="cuenta-cta">
        <div className="site-shell">
          <Reveal>
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
          </Reveal>
        </div>
      </section>

      <section className="site-shell" id="privacidad">
        <Reveal>
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
        </Reveal>
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
    </MotionConfig>
  );
};
