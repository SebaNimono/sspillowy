import React, { useState } from 'react';

const HUB_ROWS = [
  { engine: 'GitLeaks', sev: 'CRITICAL', status: 'OPEN', title: 'CWE-798  secret in history' },
  { engine: 'Semgrep', sev: 'CRITICAL', status: 'IN_REVIEW', title: 'CWE-89  sql concat' },
  { engine: 'Trivy', sev: 'HIGH', status: 'OPEN', title: 'CVE-2024  runc in base image' },
];

export const HubPreview: React.FC = () => {
  const [pane, setPane] = useState<'hub' | 'pulse'>('hub');

  return (
    <div className="site-showcase">
      <div className="site-showcase-copy">
        <div className="site-kicker">Consola</div>
        <h2 className="site-h2">El Hub se ve como el scan. Pulse llega después.</h2>
        <p className="site-lead">
          Misma paleta que el hero: hallazgos unificados, gate y evidencia. El móvil no sustituye la auditoría; firma excepciones cuando el pipeline está bloqueado.
        </p>
        <div className="site-pane-switch" role="tablist" aria-label="Capa">
          <button type="button" role="tab" aria-selected={pane === 'hub'} className={pane === 'hub' ? 'is-on' : ''} onClick={() => setPane('hub')}>
            Web Hub
          </button>
          <button type="button" role="tab" aria-selected={pane === 'pulse'} className={pane === 'pulse' ? 'is-on' : ''} onClick={() => setPane('pulse')}>
            Pulse
          </button>
        </div>
        <p className="site-showcase-note">
          {pane === 'hub'
            ? 'Repositorios, matriz HITL, mapa de calor, gates e informe ISO/IEC 27001:2022.'
            : 'Push ante crítica o secreto y bypass biométrico. En construcción; el Hub ya reserva la capa.'}
        </p>
      </div>

      <div className="site-frame" aria-hidden="true">
        <div className="site-frame-bar">
          <span />
          <span />
          <span />
          <em>{pane === 'hub' ? 'hub · findings' : 'pulse · exception'}</em>
        </div>
        {pane === 'hub' ? (
          <div className="site-frame-body">
            {HUB_ROWS.map((row) => (
              <div key={row.title} className="site-frame-row">
                <code>{row.engine}</code>
                <b className={`sev-${row.sev.toLowerCase()}`}>{row.sev}</b>
                <span>{row.title}</span>
                <i>{row.status}</i>
              </div>
            ))}
            <div className="site-frame-foot">SecurityGate BLOCKED · HITL waiting</div>
          </div>
        ) : (
          <div className="site-frame-body site-frame-pulse">
            <strong>CRITICAL · payment-gateway</strong>
            <p>Secreto en historial. Pipeline detenido. Aprobar bypass requiere biometría.</p>
            <div className="site-frame-actions">
              <em>Revisar en Hub</em>
              <em className="is-warn">Bypass</em>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
