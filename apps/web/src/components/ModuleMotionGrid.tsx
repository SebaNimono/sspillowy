import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, FileCheck2, Smartphone, Table2 } from 'lucide-react';
import { easeOut, fadeUp, staggerContainer } from '../motion/siteMotion';
import { BrandMarks } from './BrandMarks';

export type ModuleItem = { name: string; layer: string; text: string };

interface ModuleMotionGridProps {
  modules: ModuleItem[];
}

const HeatmapViz: React.FC = () => {
  const cells = [0.2, 0.45, 0.7, 0.35, 0.9, 0.55, 0.3, 0.8, 0.6, 0.4, 0.95, 0.5];
  return (
    <div className="site-module-viz site-module-viz-heat" aria-hidden="true">
      {cells.map((v, i) => (
        <motion.i
          key={i}
          initial={{ opacity: 0.15, scale: 0.6 }}
          whileInView={{ opacity: 0.25 + v * 0.75, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.03, duration: 0.35, ease: easeOut }}
          style={{ background: `rgba(9, 105, 218, ${0.2 + v * 0.75})` }}
        />
      ))}
    </div>
  );
};

const HitlViz: React.FC = () => {
  const rows = [
    { sev: 'CRIT', status: 'OPEN', color: '#cf222e' },
    { sev: 'HIGH', status: 'REVIEW', color: '#bf8700' },
    { sev: 'MED', status: 'FIXED', color: '#1f883d' },
  ];
  return (
    <div className="site-module-viz site-module-viz-rows" aria-hidden="true">
      {rows.map((r, i) => (
        <motion.div
          key={r.sev}
          className="site-module-row"
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.08 * i, duration: 0.35 }}
        >
          <b style={{ color: r.color }}>{r.sev}</b>
          <span />
          <em>{r.status}</em>
        </motion.div>
      ))}
    </div>
  );
};

const GateViz: React.FC = () => (
  <div className="site-module-viz site-module-viz-icon" aria-hidden="true">
    <motion.div
      className="site-module-gate"
      initial={{ scale: 0.85, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true }}
      animate={{ boxShadow: ['0 0 0 0 rgba(207,34,46,0.0)', '0 0 0 6px rgba(207,34,46,0.12)', '0 0 0 0 rgba(207,34,46,0.0)'] }}
      transition={{ duration: 2.2, repeat: Infinity }}
    >
      <ShieldAlert size={22} color="#cf222e" />
      <em>BLOCKED</em>
    </motion.div>
  </div>
);

const IsoViz: React.FC = () => (
  <div className="site-module-viz site-module-viz-icon" aria-hidden="true">
    <motion.div
      className="site-module-iso"
      initial={{ y: 8, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true }}
    >
      <FileCheck2 size={20} color="#1f883d" />
      <code>A.8 · A.14</code>
    </motion.div>
  </div>
);

const PulseViz: React.FC = () => (
  <div className="site-module-viz site-module-viz-icon" aria-hidden="true">
    <motion.div
      className="site-module-pulse-phone"
      animate={{ y: [0, -3, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Smartphone size={20} color="#8250df" />
      <motion.span
        className="site-module-pulse-dot"
        animate={{ scale: [1, 1.6, 1], opacity: [0.9, 0.2, 0.9] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      />
    </motion.div>
  </div>
);

const SsoViz: React.FC = () => {
  const icons = [BrandMarks.github, BrandMarks.gitlab, BrandMarks.google, BrandMarks.microsoft];
  return (
    <div className="site-module-viz site-module-viz-sso" aria-hidden="true">
      {icons.map((Icon, i) => (
        <motion.i
          key={i}
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.06 * i, duration: 0.35 }}
          whileHover={{ y: -2, color: '#0969da' }}
        >
          <Icon />
        </motion.i>
      ))}
    </div>
  );
};

const DefaultViz: React.FC = () => (
  <div className="site-module-viz site-module-viz-icon" aria-hidden="true">
    <Table2 size={20} color="#0969da" />
  </div>
);

const VIZ: Record<string, React.FC> = {
  'Matriz HITL': HitlViz,
  'Security Gates': GateViz,
  'Informes ISO 27001': IsoViz,
  'Mapa de calor': HeatmapViz,
  Pulse: PulseViz,
  SSO: SsoViz,
};

export const ModuleMotionGrid: React.FC<ModuleMotionGridProps> = ({ modules }) => (
  <motion.div
    className="site-modules site-modules-motion"
    variants={staggerContainer}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, margin: '-40px' }}
  >
    {modules.map((item) => {
      const Viz = VIZ[item.name] ?? DefaultViz;
      return (
        <motion.article
          key={item.name}
          variants={fadeUp}
          whileHover={{ scale: 1.015, y: -4, transition: { type: 'spring', stiffness: 420, damping: 28 } }}
        >
          <Viz />
          <span>{item.layer}</span>
          <h3>{item.name}</h3>
          <p>{item.text}</p>
        </motion.article>
      );
    })}
  </motion.div>
);
