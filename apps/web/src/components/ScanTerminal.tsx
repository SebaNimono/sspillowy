import React, { useEffect, useRef, useState } from 'react';

const LINES = [
  '$ sspillowy scan --repo payment-gateway \\',
  '    --engines semgrep,trivy,gitleaks',
  '',
  ' GitLeaks   CRITICAL  CWE-798   secret in history',
  ' Semgrep    CRITICAL  CWE-89    sql concat  [AI 94%]',
  ' Trivy      HIGH      CVE-2024  runc in base image',
  '',
  ' SecurityGate  BLOCKED  max_critical=0',
  ' HITL          waiting  auditor must confirm',
];

const FULL = LINES.join('\n');

export const ScanTerminal: React.FC = () => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setText(FULL);
      return;
    }
    let i = 0;
    let frame = 0;
    const step = () => {
      i += 2;
      setText(FULL.slice(0, i));
      if (i < FULL.length) frame = window.setTimeout(step, 16);
    };
    frame = window.setTimeout(step, 280);
    return () => window.clearTimeout(frame);
  }, []);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: py * -6, y: px * 7 });
  };

  return (
    <div
      ref={wrapRef}
      className="site-terminal"
      aria-hidden="true"
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{ transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
    >
      <div className="site-terminal-bar">
        <span />
        <span />
        <span />
        <em>sspillowy scan</em>
      </div>
      <pre>
        {text}
        <span className="site-cursor">█</span>
      </pre>
    </div>
  );
};
