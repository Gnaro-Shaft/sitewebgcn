import { useEffect, useState } from 'react';

export default function GlitchLogo({ size = 180 }) {
  const [cursorVisible, setCursorVisible] = useState(true);

  // Blinking cursor
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  const fontSize = size * 0.35;

  return (
    <div
      className="relative inline-flex items-end justify-center select-none"
      style={{ height: size }}
    >
      {/* Glow background */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0,255,136,0.1) 0%, transparent 70%)',
        }}
      />

      {/* GCN text */}
      <span
        className="text-accent"
        style={{
          fontFamily: "'Press Start 2P', cursive",
          fontWeight: 400,
          fontSize,
          lineHeight: 1,
          textShadow: '0 0 30px rgba(0,255,136,0.5), 0 0 60px rgba(0,255,136,0.2)',
        }}
      >
        GCN
      </span>

      {/* Green colon */}
      <span
        className="text-accent"
        style={{
          fontFamily: "'Press Start 2P', cursive",
          fontWeight: 400,
          fontSize,
          lineHeight: 1,
          textShadow: '0 0 30px rgba(0,255,136,0.5), 0 0 60px rgba(0,255,136,0.2)',
        }}
      >
        :
      </span>

      {/* Blinking red underscore cursor */}
      <span
        className="transition-opacity duration-100"
        style={{
          fontFamily: "'Press Start 2P', cursive",
          fontWeight: 400,
          fontSize: fontSize * 0.6,
          lineHeight: 1,
          color: '#ff3333',
          opacity: cursorVisible ? 1 : 0,
          textShadow: '0 0 15px rgba(255,51,51,0.6), 0 0 30px rgba(255,51,51,0.3)',
          marginBottom: size * 0.05,
        }}
      >
        _
      </span>
    </div>
  );
}
