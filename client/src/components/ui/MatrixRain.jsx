import { useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function MatrixRain() {
  const canvasRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let columns;
    let drops;

    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>/{}[]();=+*&%$#@!';
    const fontSize = 14;
    const isDark = theme === 'dark';

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      columns = Math.floor(canvas.width / fontSize);
      drops = Array(columns).fill(1).map(() => Math.random() * -100);
    }

    function draw() {
      if (isDark) {
        ctx.fillStyle = 'rgba(10, 10, 10, 0.05)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Head character
        ctx.fillStyle = isDark ? '#00ff88' : '#00cc6a';
        ctx.fillText(char, x, y);

        // Trail character
        ctx.fillStyle = isDark ? 'rgba(0, 255, 136, 0.15)' : 'rgba(0, 180, 100, 0.12)';
        if (y > fontSize) {
          const trailChar = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillText(trailChar, x, y - fontSize);
        }

        if (y > canvas.height && Math.random() > 0.985) {
          drops[i] = 0;
        }
        drops[i] += 0.3;
      }

      animationId = requestAnimationFrame(draw);
    }

    resize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw();

    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: theme === 'dark' ? 0.25 : 0.18 }}
    />
  );
}
