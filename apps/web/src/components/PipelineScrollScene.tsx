import React, { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { prefersReducedMotion } from '../motion/siteMotion';

gsap.registerPlugin(ScrollTrigger);

export type PipelineStep = { n: string; title: string; text: string };

interface PipelineScrollSceneProps {
  steps: PipelineStep[];
}

export const PipelineScrollScene: React.FC<PipelineScrollSceneProps> = ({ steps }) => {
  const rootRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  useGSAP(
    () => {
      const root = rootRef.current;
      const progress = progressRef.current;
      if (!root || !progress) return;

      const reduced = prefersReducedMotion();
      if (reduced) {
        gsap.set(progress, { scaleX: 1 });
        stepRefs.current.forEach((el) => el && gsap.set(el, { opacity: 1, y: 0 }));
        return;
      }

      gsap.set(progress, { scaleX: 0, transformOrigin: 'left center' });
      stepRefs.current.forEach((el) => {
        if (el) gsap.set(el, { opacity: 0.35, y: 6 });
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root,
          start: 'top 75%',
          end: 'bottom 35%',
          scrub: 0.55,
        },
      });

      tl.to(progress, { scaleX: 1, ease: 'none', duration: 1 }, 0);

      steps.forEach((_, i) => {
        const el = stepRefs.current[i];
        if (!el) return;
        const t = i / Math.max(steps.length - 1, 1);
        tl.to(
          el,
          {
            opacity: 1,
            y: 0,
            duration: 0.15,
            onStart: () => el.classList.add('is-active'),
          },
          t * 0.85,
        );
      });
    },
    { scope: rootRef, dependencies: [steps.length] },
  );

  return (
    <section className="site-pipeline-scene" ref={rootRef} aria-label="Pipeline de escaneo">
      <div className="site-pipeline-track" aria-hidden="true">
        <div className="site-pipeline-track-base" />
        <div className="site-pipeline-track-fill" ref={progressRef} />
      </div>
      <ol className="site-pipeline site-pipeline-scroll">
        {steps.map((step, i) => (
          <li
            key={step.n}
            ref={(el) => {
              stepRefs.current[i] = el;
            }}
          >
            <span>{step.n}</span>
            <strong>{step.title}</strong>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
};
