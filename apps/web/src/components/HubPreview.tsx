import React, { useState } from 'react';
import { LiveOpsPanel } from './LiveOpsPanel';

export const HubPreview: React.FC = () => {
  const [pane, setPane] = useState<'hub' | 'pulse'>('hub');

  return (
    <div className="site-showcase">
      <div className="site-showcase-copy">
        <div className="site-kicker">Consola</div>
        <h2 className="site-h2">El Hub se ve como el scan. Pulse llega después.</h2>
        <p className="site-lead">
          Panel en vivo: los hallazgos entran en cola. El móvil no sustituye la auditoría; firma excepciones cuando el pipeline está bloqueado.
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
      <LiveOpsPanel pane={pane} />
    </div>
  );
};
