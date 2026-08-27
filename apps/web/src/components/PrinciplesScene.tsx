import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, Sparkles, PenLine } from 'lucide-react';
import { fadeUp, staggerContainer } from '../motion/siteMotion';

export type Principle = { k: string; v: string };

const META = [
  { icon: Radar, accent: '#0969da', role: 'Motor OSS', tone: 'detect' as const },
  { icon: Sparkles, accent: '#8250df', role: 'LLM Router', tone: 'propose' as const },
  { icon: PenLine, accent: '#1a7f37', role: 'Auditor', tone: 'sign' as const },
];

interface PrinciplesSceneProps {
  principles: Principle[];
}

export const PrinciplesScene: React.FC<PrinciplesSceneProps> = ({ principles }) => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setActive((n) => (n + 1) % principles.length), 2800);
    return () => window.clearInterval(id);
  }, [principles.length]);

  return (
    <div className="site-principles-scene">
      <div className="site-principles-flow" aria-hidden="true">
        {principles.map((item, i) => (
          <React.Fragment key={item.k}>
            <button
              type="button"
              className={`site-principles-node ${active === i ? 'is-on' : ''}`}
              style={{ '--p-accent': META[i].accent } as React.CSSProperties}
              onClick={() => setActive(i)}
            >
              {item.k}
            </button>
            {i < principles.length - 1 && (
              <span className={`site-principles-arrow ${active > i ? 'is-lit' : ''}`}>→</span>
            )}
          </React.Fragment>
        ))}
      </div>

      <motion.ol
        className="site-principles site-principles-live"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-40px' }}
      >
        {principles.map((item, i) => {
          const meta = META[i];
          const Icon = meta.icon;
          const on = active === i;
          return (
            <motion.li
              key={item.k}
              variants={fadeUp}
              className={`tone-${meta.tone} ${on ? 'is-active' : ''}`}
              style={{ '--p-accent': meta.accent } as React.CSSProperties}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            >
              <div className="site-principle-head">
                <span className="site-principle-n">0{i + 1}</span>
                <span className="site-principle-icon" aria-hidden="true">
                  <Icon size={16} strokeWidth={2.2} />
                </span>
              </div>
              <strong>{item.k}</strong>
              <em className="site-principle-role">{meta.role}</em>
              <p>{item.v}</p>
              <AnimatePresence>
                {on && (
                  <motion.div
                    className="site-principle-glow"
                    layoutId="principle-glow"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    aria-hidden="true"
                  />
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </motion.ol>
    </div>
  );
};
