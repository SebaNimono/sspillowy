import React, { useState } from 'react';
import { motion } from 'framer-motion';
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
          {(['hub', 'pulse'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={pane === key}
              className={pane === key ? 'is-on' : ''}
              onClick={() => setPane(key)}
            >
              {pane === key && (
                <motion.span
                  layoutId="hub-pane-indicator"
                  className="site-pane-indicator"
                  transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                />
              )}
              {key === 'hub' ? 'Web Hub' : 'Pulse'}
            </button>
          ))}
        </div>
        <motion.p
          key={pane}
          className="site-showcase-note"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {pane === 'hub'
            ? 'Repositorios, matriz HITL, mapa de calor, gates e informe ISO/IEC 27001:2022.'
            : 'Push ante crítica o secreto y bypass biométrico. En construcción; el Hub ya reserva la capa.'}
        </motion.p>
      </div>
      <LiveOpsPanel pane={pane} />
    </div>
  );
};
