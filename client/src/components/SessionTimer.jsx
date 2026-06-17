import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Decode JWT payload without a library — used only to detect access-token
// rotation, not to drive a countdown (the user no longer needs to know).
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

// With refresh-token rotation, the access token transparently refreshes
// every ~15min for up to 7 days. We don't show a countdown anymore — it
// was misleading (the dashboard would say "0:30 left" while the user was
// still perfectly logged in). Instead, show a small "Active" dot whose
// pulse animation acknowledges the user that their session is healthy.
//
// On hover, the tooltip shows the last rotation time so power-users can
// verify the refresh loop is alive.
export default function SessionTimer() {
  const { accessToken } = useAuth();
  const [lastRotation, setLastRotation] = useState(null);

  // Watch for access-token rotation by tracking the JWT's "iat" claim
  useEffect(() => {
    if (!accessToken) return;
    const payload = decodeToken(accessToken);
    if (payload?.iat) {
      setLastRotation(new Date(payload.iat * 1000));
    }
  }, [accessToken]);

  if (!accessToken) return null;

  const tooltip = lastRotation
    ? `Session active — last refresh ${lastRotation.toLocaleTimeString()}`
    : 'Session active';

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent"
      title={tooltip}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
      </span>
      Active
    </div>
  );
}
