import React, { useEffect, useRef } from 'react';

interface AnimatedBackgroundProps {
  contained?: boolean;
}

/** Fondo clásico: rejilla + carriles de pipeline. Sin cubos ni tokens a la deriva. */
export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ contained = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = 0;
    let width = 0;
    let height = 0;

    const measure = () => {
      if (contained && wrapRef.current) {
        return {
          width: wrapRef.current.clientWidth || window.innerWidth,
          height: wrapRef.current.clientHeight || 420,
        };
      }
      return { width: window.innerWidth, height: window.innerHeight };
    };

    const applySize = () => {
      const next = measure();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = next.width;
      height = next.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    applySize();

    const dark = contained;
    const lanes = dark
      ? [
          { label: 'SAST', color: '#58a6ff' },
          { label: 'SCA', color: '#8250df' },
          { label: 'SECRETS', color: '#f85149' },
          { label: 'DAST', color: '#3fb950' },
        ]
      : [
          { label: 'SAST', color: '#0969da' },
          { label: 'SCA', color: '#8250df' },
          { label: 'SECRETS', color: '#cf222e' },
          { label: 'DAST', color: '#1a7f37' },
        ];

    type Packet = { lane: number; x: number; speed: number; r: number };
    const packets: Packet[] = [];
    const seedPackets = () => {
      packets.length = 0;
      const count = dark ? 14 : 8;
      for (let i = 0; i < count; i++) {
        packets.push({
          lane: i % lanes.length,
          x: Math.random() * width,
          speed: 0.35 + Math.random() * 0.45,
          r: 1.6 + Math.random() * 1.1,
        });
      }
    };
    seedPackets();

    let scanX = 0;

    const handleResize = () => {
      applySize();
      seedPackets();
    };
    window.addEventListener('resize', handleResize);
    const ro = contained && wrapRef.current ? new ResizeObserver(handleResize) : null;
    if (wrapRef.current && ro) ro.observe(wrapRef.current);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const grid = dark ? 'rgba(88, 166, 255, 0.07)' : 'rgba(208, 215, 222, 0.55)';
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      const gridSize = 32;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const padY = height * 0.18;
      const usable = Math.max(height - padY * 2, 80);

      lanes.forEach((lane, i) => {
        const y = padY + (usable / (lanes.length - 1 || 1)) * i;
        ctx.strokeStyle = dark ? 'rgba(88, 166, 255, 0.18)' : 'rgba(9, 105, 218, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(24, y);
        ctx.lineTo(width - 24, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
        ctx.fillStyle = lane.color;
        ctx.globalAlpha = dark ? 0.55 : 0.35;
        ctx.fillText(lane.label, 28, y - 8);
        ctx.globalAlpha = 1;
      });

      packets.forEach((p) => {
        const y = padY + (usable / (lanes.length - 1 || 1)) * p.lane;
        p.x += p.speed;
        if (p.x > width + 12) p.x = -12;
        ctx.beginPath();
        ctx.fillStyle = lanes[p.lane].color;
        ctx.globalAlpha = dark ? 0.7 : 0.28;
        ctx.arc(p.x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      if (dark) {
        scanX = (scanX + 0.9) % (width + 80);
        const grad = ctx.createLinearGradient(scanX - 40, 0, scanX + 40, 0);
        grad.addColorStop(0, 'rgba(88, 166, 255, 0)');
        grad.addColorStop(0.5, 'rgba(88, 166, 255, 0.07)');
        grad.addColorStop(1, 'rgba(88, 166, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(scanX - 40, 0, 80, height);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      ro?.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, [contained]);

  return (
    <div
      ref={wrapRef}
      style={
        contained
          ? { position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }
          : undefined
      }
    >
      <canvas
        ref={canvasRef}
        style={{
          position: contained ? 'absolute' : 'fixed',
          top: 0,
          left: 0,
          width: contained ? '100%' : '100vw',
          height: contained ? '100%' : '100vh',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
    </div>
  );
};
