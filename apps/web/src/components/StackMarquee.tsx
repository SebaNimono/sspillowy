import React from 'react';
import { BrandChip, type BrandKey } from './BrandMarks';

type Item = { mark: BrandKey; label: string };

const ITEMS: Item[] = [
  { mark: 'semgrep', label: 'Semgrep' },
  { mark: 'trivy', label: 'Trivy' },
  { mark: 'gitleaks', label: 'GitLeaks' },
  { mark: 'owasp', label: 'OWASP ZAP' },
  { mark: 'iso', label: 'ISO/IEC 27001' },
  { mark: 'owasp', label: 'OWASP Top 10' },
  { mark: 'cwe', label: 'CWE' },
  { mark: 'hitl', label: 'HITL' },
  { mark: 'github', label: 'GitHub' },
  { mark: 'gitlab', label: 'GitLab' },
  { mark: 'google', label: 'Google' },
  { mark: 'microsoft', label: 'Microsoft' },
];

export const StackMarquee: React.FC = () => {
  const row = [...ITEMS, ...ITEMS];

  return (
    <div className="site-marquee" aria-label="Capas que orquesta SSPILLOWY">
      <div className="site-marquee-label">Stack · estándares · SSO</div>
      <div className="site-marquee-viewport">
        <div className="site-marquee-track">
          {row.map((item, i) => (
            <BrandChip
              key={`${item.label}-${i}`}
              mark={item.mark}
              label={item.label}
              className="site-marquee-item"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
