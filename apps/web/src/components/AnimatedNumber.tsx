import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  className?: string;
  style?: React.CSSProperties;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, className, style }) => {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 18 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString('es-ES'));
  const [text, setText] = useState('0');

  useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  useEffect(() => {
    const unsub = display.on('change', (v) => setText(v));
    return () => unsub();
  }, [display]);

  return (
    <motion.span className={className} style={style}>
      {text}
    </motion.span>
  );
};
