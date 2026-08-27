import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Engine = { name: string; layer: string; role: string; color: string };

const ENGINES: Engine[] = [
  { name: 'Semgrep', layer: 'SAST', role: 'Patrones de código vulnerable sobre el AST. OWASP Top 10.', color: '#0969da' },
  { name: 'Trivy', layer: 'SCA / IaC', role: 'CVEs en dependencias, Dockerfiles y manifiestos.', color: '#8250df' },
  { name: 'GitLeaks', layer: 'Secretos', role: 'Tokens, claves y credenciales en historial Git.', color: '#cf222e' },
  { name: 'OWASP ZAP', layer: 'DAST', role: 'Encabezados, CORS y endpoints HTTP en runtime.', color: '#1f883d' },
];

const FINDINGS: Record<string, string> = {
  Semgrep: 'CWE-89 · sql concat · CRITICAL',
  Trivy: 'CVE-2024 · runc in base · HIGH',
  GitLeaks: 'CWE-798 · secret in history · CRITICAL',
  'OWASP ZAP': 'A05 · missing CSP · MEDIUM',
};

export const EngineOrchestrator: React.FC = () => {
  const [active, setActive] = useState(0);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % ENGINES.length);
      setScanning(true);
      window.setTimeout(() => setScanning(false), 700);
    }, 3200);
    return () => window.clearInterval(id);
  }, []);

  const pick = (index: number) => {
    setActive(index);
    setScanning(true);
    window.setTimeout(() => setScanning(false), 700);
  };

  const engine = ENGINES[active];

  return (
    <div className="site-orchestrator">
      <div className="site-orchestrator-top">
        <motion.div
          className="site-orchestrator-repo"
          animate={scanning ? { boxShadow: '0 0 0 2px rgba(88,166,255,0.35)' } : { boxShadow: '0 0 0 0px rgba(88,166,255,0)' }}
          transition={{ duration: 0.35 }}
        >
          <code>payment-gateway</code>
          <span>git push · webhook</span>
        </motion.div>
        <svg className="site-orchestrator-svg" viewBox="0 0 520 88" aria-hidden="true">
          {ENGINES.map((_, i) => {
            const x = 65 + i * 130;
            const lit = active === i;
            return (
              <line
                key={i}
                x1="260"
                y1="8"
                x2={x}
                y2="80"
                stroke={lit && scanning ? '#58a6ff' : '#30363d'}
                strokeWidth={lit ? 2 : 1}
                strokeDasharray={lit && scanning ? '4 6' : '0'}
                opacity={lit ? 0.95 : 0.35}
                className={lit && scanning ? 'is-flowing' : undefined}
              />
            );
          })}
        </svg>
      </div>

      <div className="site-orchestrator-engines" role="tablist" aria-label="Motores de detección">
        {ENGINES.map((item, i) => (
          <motion.button
            key={item.name}
            type="button"
            role="tab"
            aria-selected={active === i}
            className={`site-orchestrator-node ${active === i ? 'is-on' : ''}`}
            onClick={() => pick(i)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            style={{ '--node-accent': item.color } as React.CSSProperties}
          >
            <b>{item.layer}</b>
            <strong>{item.name}</strong>
            <AnimatePresence mode="wait">
              {active === i && (
                <motion.span
                  key="pulse"
                  className="site-orchestrator-pulse"
                  initial={{ scale: 0.6, opacity: 0.8 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.65 }}
                />
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>

      <motion.div
        className="site-orchestrator-detail"
        key={engine.name}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        <div className="site-orchestrator-detail-head">
          <span className="badge badge-engine">{engine.layer}</span>
          <strong>{engine.name}</strong>
        </div>
        <p>{engine.role}</p>
        <AnimatePresence mode="wait">
          <motion.div
            key={FINDINGS[engine.name]}
            className="site-orchestrator-finding"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.22 }}
          >
            <em>sample finding</em>
            <code>{FINDINGS[engine.name]}</code>
          </motion.div>
        </AnimatePresence>
        <div className="site-orchestrator-flow">
          <span>normalize</span>
          <i aria-hidden="true">→</i>
          <span>HITL</span>
          <i aria-hidden="true">→</i>
          <span className="is-block">SecurityGate</span>
        </div>
      </motion.div>
    </div>
  );
};
