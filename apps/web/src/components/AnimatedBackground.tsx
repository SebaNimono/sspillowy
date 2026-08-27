import React, { useEffect, useRef } from 'react';

interface AnimatedBackgroundProps {
  contained?: boolean;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ contained = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const measure = () => {
      if (contained && wrapRef.current) {
        return {
          width: wrapRef.current.clientWidth || window.innerWidth,
          height: wrapRef.current.clientHeight || 420,
        };
      }
      return { width: window.innerWidth, height: window.innerHeight };
    };

    const first = measure();
    let width = (canvas.width = first.width);
    let height = (canvas.height = first.height);

    const handleResize = () => {
      if (!canvas) return;
      const next = measure();
      width = canvas.width = next.width;
      height = canvas.height = next.height;
    };

    window.addEventListener('resize', handleResize);

    // DevSecOps subtle code & security tokens to stream left-to-right
    const tokens = [
      'const scan = await semgrep.scan()',
      'CVE-2024-21626 [PATCHED]',
      'GitLeaks: 0 secrets exposed',
      'OWASP A03: Injection Filtered',
      'AES-256-GCM',
      'OAuth2 / OIDC Verified',
      'CWE-798: remediated',
      'FastAPI uvicorn 8000',
      'PostgreSQL 16 SSL',
      'ARQ Redis Worker active',
      'SecurityGate [PASS]',
      'Pulse Mobile Sync: True',
      'SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    ];

    // Floating particles/text items
    const items: Array<{
      x: number;
      y: number;
      speed: number;
      text: string;
      fontSize: number;
      opacity: number;
      isCode: boolean;
      color: string;
    }> = [];

    const colors = ['#0969da', '#8250df', '#1a7f37', '#656d76'];

    // Populate initial items
    for (let i = 0; i < 22; i++) {
      items.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 0.3 + Math.random() * 0.5, // gentle left-to-right drift
        text: tokens[Math.floor(Math.random() * tokens.length)],
        fontSize: 11 + Math.random() * 3,
        opacity: 0.12 + Math.random() * 0.12,
        isCode: true,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // Floating subtle geometric squares/cubes
    const cubes: Array<{
      x: number;
      y: number;
      size: number;
      speed: number;
      opacity: number;
      color: string;
    }> = [];

    for (let i = 0; i < 15; i++) {
      cubes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 12 + Math.random() * 24,
        speed: 0.2 + Math.random() * 0.4,
        opacity: 0.04 + Math.random() * 0.06,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw faint background grid
      ctx.strokeStyle = 'rgba(208, 215, 222, 0.25)';
      ctx.lineWidth = 1;
      const gridSize = 40;

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

      // Render floating subtle geometric cubes drifting left-to-right
      cubes.forEach((cube) => {
        cube.x += cube.speed;
        if (cube.x > width + 40) {
          cube.x = -40;
          cube.y = Math.random() * height;
        }

        ctx.fillStyle = cube.color;
        ctx.globalAlpha = cube.opacity;
        ctx.beginPath();
        ctx.roundRect(cube.x, cube.y, cube.size, cube.size, 4);
        ctx.fill();
        ctx.strokeStyle = cube.color;
        ctx.stroke();
      });

      // Render floating code streams
      ctx.font = '12px ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';
      items.forEach((item) => {
        item.x += item.speed;
        if (item.x > width + 200) {
          item.x = -250;
          item.y = Math.random() * height;
          item.text = tokens[Math.floor(Math.random() * tokens.length)];
        }

        ctx.fillStyle = item.color;
        ctx.globalAlpha = item.opacity;
        ctx.fillText(item.text, item.x, item.y);
      });

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

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
