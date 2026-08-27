import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const STREAM = [
  { engine: 'GitLeaks', sev: 'CRITICAL', status: 'OPEN', title: 'CWE-798  secret in history' },
  { engine: 'Semgrep', sev: 'CRITICAL', status: 'IN_REVIEW', title: 'CWE-89  sql concat' },
  { engine: 'Trivy', sev: 'HIGH', status: 'OPEN', title: 'CVE-2024  runc in base image' },
  { engine: 'ZAP', sev: 'MEDIUM', status: 'OPEN', title: 'A05  missing CSP header' },
];

const list = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.05 } },
};

const row = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32 } },
};

export const LiveOpsPanel: React.FC<{ pane: 'hub' | 'pulse' }> = ({ pane }) => {
  const [shown, setShown] = useState(1);

  useEffect(() => {
    if (pane !== 'hub') return;
    setShown(1);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(STREAM.length);
      return;
    }
    const id = window.setInterval(() => {
      setShown((n) => (n >= STREAM.length ? STREAM.length : n + 1));
    }, 900);
    return () => window.clearInterval(id);
  }, [pane]);

  return (
    <div className="site-frame site-live" aria-hidden="true">
      <div className="site-frame-bar">
        <span />
        <span />
        <span />
        <em>{pane === 'hub' ? 'hub · live findings' : 'pulse · exception'}</em>
        <b className="site-live-dot">LIVE</b>
      </div>
      <AnimatePresence mode="wait">
        {pane === 'hub' ? (
          <motion.div
            key="hub"
            className="site-frame-body"
            initial="hidden"
            animate="show"
            variants={list}
          >
            {STREAM.slice(0, shown).map((item) => (
              <motion.div key={item.title} className="site-frame-row" variants={row} layout>
                <code>{item.engine}</code>
                <b className={`sev-${item.sev.toLowerCase()}`}>{item.sev}</b>
                <span>{item.title}</span>
                <i>{item.status}</i>
              </motion.div>
            ))}
            <motion.div
              className="site-frame-foot"
              initial={{ opacity: 0 }}
              animate={{ opacity: shown >= 3 ? 1 : 0.35 }}
            >
              SecurityGate BLOCKED · HITL waiting
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="pulse"
            className="site-frame-body site-frame-pulse"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28 }}
          >
            <strong>CRITICAL · payment-gateway</strong>
            <p>Secreto en historial. Pipeline detenido. Aprobar bypass requiere biometría.</p>
            <div className="site-frame-actions">
              <em>Revisar en Hub</em>
              <em className="is-warn">Bypass</em>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
