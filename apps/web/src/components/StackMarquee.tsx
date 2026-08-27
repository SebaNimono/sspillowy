import React from 'react';

const ITEMS = [
  'Semgrep',
  'Trivy',
  'GitLeaks',
  'OWASP ZAP',
  'ISO/IEC 27001',
  'OWASP Top 10',
  'CWE',
  'HITL',
  'GitHub',
  'GitLab',
  'Google',
  'Microsoft',
];

export const StackMarquee: React.FC = () => {
  const row = [...ITEMS, ...ITEMS];

  return (
    <div className="site-marquee" aria-label="Capas que orquesta SSPILLOWY">
      <div className="site-marquee-track">
        {row.map((item, i) => (
          <span key={`${item}-${i}`} className="site-marquee-item">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};
