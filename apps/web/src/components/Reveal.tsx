import React, { useEffect, useRef, useState } from 'react';

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section';
  onInView?: () => void;
} & React.HTMLAttributes<HTMLElement>;

export const Reveal: React.FC<RevealProps> = ({ children, className = '', as = 'div', onInView, ...rest }) => {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const onInViewRef = useRef(onInView);
  onInViewRef.current = onInView;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => {
      setVisible(true);
      onInViewRef.current?.();
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      show();
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          show();
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Tag = as;
  return (
    <Tag ref={ref as never} className={`site-reveal ${visible ? 'is-in' : ''} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
};
