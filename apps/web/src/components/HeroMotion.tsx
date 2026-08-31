import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen } from 'lucide-react';
import { fadeUp, staggerContainer } from '../motion/siteMotion';

interface HeroMotionProps {
  user: { email: string; name: string } | null;
  onCuenta: () => void;
  onOpenConsole: () => void;
}

const CHIPS = ['SAST · Semgrep', 'SCA · Trivy', 'Secretos · GitLeaks', 'DAST · ZAP'];

export const HeroMotion: React.FC<HeroMotionProps> = ({ user, onCuenta, onOpenConsole }) => (
  <motion.div className="site-hero-copy" variants={staggerContainer} initial="hidden" animate="show">
    <motion.div className="site-kicker" variants={fadeUp}>
      Web Hub · DevSecOps
    </motion.div>
    <motion.h1 variants={fadeUp}>
      Gobernanza de seguridad de software, sin mezclar detección e interpretación.
    </motion.h1>
    <motion.p variants={fadeUp}>
      SSPILLOWY orquesta Semgrep, Trivy, GitLeaks y OWASP ZAP, unifica los hallazgos. Impulsado con IA.
    </motion.p>
    <motion.ul className="site-hero-chips" variants={fadeUp}>
      {CHIPS.map((chip) => (
        <motion.li
          key={chip}
          variants={fadeUp}
          whileHover={{ borderColor: '#58a6ff', color: '#e6edf3' }}
          transition={{ duration: 0.18 }}
        >
          {chip}
        </motion.li>
      ))}
    </motion.ul>
    <motion.div className="site-hero-actions" variants={fadeUp}>
      <motion.button
        className="btn btn-primary"
        onClick={user ? onOpenConsole : onCuenta}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span>{user ? 'Abrir consola' : 'Empezar'}</span>
        <ArrowRight size={16} />
      </motion.button>
      <motion.a
        href="#servicios"
        className="btn btn-secondary site-hero-docs"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span>Ver la plataforma</span>
      </motion.a>
      <motion.a
        href="#documentacion"
        className="btn btn-secondary site-hero-docs"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <BookOpen size={15} />
        <span>Docs</span>
      </motion.a>
    </motion.div>
  </motion.div>
);
