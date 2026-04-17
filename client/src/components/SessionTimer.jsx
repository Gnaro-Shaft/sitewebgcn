import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Decode JWT payload without library
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export default function SessionTimer() {
  const { token, logout } = useAuth();
  const [remaining, setRemaining] = useState(null);
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    if (!token) return;

    const payload = decodeToken(token);
    if (!payload?.exp) return;

    const expiresAt = payload.exp * 1000; // ms

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = expiresAt - now;

      if (diff <= 0) {
        clearInterval(interval);
        logout();
        return;
      }

      setRemaining(diff);
      setWarning(diff < 2 * 60 * 1000); // warning at < 2min
    }, 1000);

    return () => clearInterval(interval);
  }, [token, logout]);

  if (remaining === null) return null;

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium transition-all ${
        warning
          ? 'bg-red-500/20 text-red-400 animate-pulse'
          : 'bg-accent/10 text-accent'
      }`}
      title="Session expires in"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {display}
    </div>
  );
}
