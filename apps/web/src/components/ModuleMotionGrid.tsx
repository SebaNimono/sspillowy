import React from 'react';
import { motion } from 'framer-motion';
import { easeOut, fadeUp, staggerContainer } from '../motion/siteMotion';

export type ModuleItem = { name: string; layer: string; text: string };

const BAR_HEIGHTS = [
  [40, 70, 55, 90, 45],
  [60, 85, 50, 70, 55],
  [35, 60, 75, 50, 80],
  [50, 80, 65, 90, 40],
  [45, 55, 70, 60, 85],
  [55, 75, 45, 80, 65],
];

const BAR_COLORS = ['#0969da', '#cf222e', '#1f883d', '#8250df', '#58a6ff', '#6e7681'];

interface ModuleMotionGridProps {
  modules: ModuleItem[];
}

export const ModuleMotionGrid: React.FC<ModuleMotionGridProps> = ({ modules }) => (
  <motion.div
    className="site-modules site-modules-motion"
    variants={staggerContainer}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, margin: '-40px' }}
  >
    {modules.map((item, index) => (
      <motion.article
        key={item.name}
        variants={fadeUp}
        whileHover={{ scale: 1.015, y: -3, transition: { type: 'spring', stiffness: 420, damping: 28 } }}
      >
        <div className="site-module-viz" aria-hidden="true">
          {BAR_HEIGHTS[index % BAR_HEIGHTS.length].map((h, bi) => (
            <motion.i
              key={bi}
              initial={{ scaleY: 0.2 }}
              whileInView={{ scaleY: h / 100 }}
              viewport={{ once: true }}
              transition={{ delay: 0.04 * bi + index * 0.03, duration: 0.45, ease: easeOut }}
              style={{
                transformOrigin: 'bottom',
                background: BAR_COLORS[(index + bi) % BAR_COLORS.length],
              }}
            />
          ))}
        </div>
        <span>{item.layer}</span>
        <h3>{item.name}</h3>
        <p>{item.text}</p>
      </motion.article>
    ))}
  </motion.div>
);
