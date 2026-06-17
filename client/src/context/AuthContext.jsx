import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

// Backend issues short-lived access tokens (15min) + long-lived refresh
// tokens (7d). On 401 from any API call, we transparently call /auth/refresh
// to get a fresh access token and replay the original request. The user
// stays logged in until the refresh token itself expires.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('accessToken') || localStorage.getItem('token'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('refreshToken'));
  const [loading, setLoading] = useState(true);

  // Refs that the axios interceptor reads — useState reads would be stale
  // because the interceptor is set up once at mount.
  const accessTokenRef = useRef(accessToken);
  const refreshTokenRef = useRef(refreshToken);

  // Set axios default header when access token changes + persist both tokens
  useEffect(() => {
    accessTokenRef.current = accessToken;
    if (accessToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      localStorage.setItem('accessToken', accessToken);
      localStorage.removeItem('token'); // clear legacy key
    } else {
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
    }
  }, [accessToken]);

  useEffect(() => {
    refreshTokenRef.current = refreshToken;
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    } else {
      localStorage.removeItem('refreshToken');
    }
  }, [refreshToken]);

  // Fetch user profile on mount if a token exists
  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => {
        // The interceptor below will have already tried to refresh and failed.
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  // We intentionally don't put accessToken in deps — we run this once at
  // mount. After mount, accessToken changes are driven by login/refresh
  // and we don't want to refetch /me on every silent token rotation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const at = res.data.accessToken || res.data.token;
    const rt = res.data.refreshToken;
    setAccessToken(at);
    setRefreshToken(rt);
    setUser(res.data.user);
    return res.data;
  };

  const logout = useCallback(async () => {
    const rt = refreshTokenRef.current;
    // Best-effort: tell the server to revoke the refresh token. Don't
    // block the UI if the server is down — clear local state regardless.
    if (rt) {
      api.post('/auth/logout', { refreshToken: rt }).catch(() => {});
    }
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  // --- Axios interceptor: refresh-and-retry on 401 -----------------------
  // We track in-flight refresh calls so concurrent 401s don't trigger N
  // parallel refresh requests (each rotation revokes the previous token).
  useEffect(() => {
    let refreshPromise = null;

    async function doRefresh() {
      const rt = refreshTokenRef.current;
      if (!rt) throw new Error('No refresh token available');
      // Use the bare axios instance with no Authorization header — the dead
      // access token would just cause another 401.
      const res = await api.post('/auth/refresh', { refreshToken: rt }, {
        headers: { Authorization: undefined },
      });
      setAccessToken(res.data.accessToken);
      setRefreshToken(res.data.refreshToken);
      return res.data.accessToken;
    }

    const interceptor = api.interceptors.response.use(
      (res) => res,
      async (err) => {
        const original = err.config || {};
        const status = err.response?.status;

        // Bail out conditions that should NOT trigger a refresh-retry:
        //  - not a 401
        //  - already retried (avoid infinite loop)
        //  - the failing request IS /auth/refresh (refresh itself failed)
        //  - no refresh token available
        if (
          status !== 401
          || original._refreshRetry
          || original.url?.includes('/auth/refresh')
          || original.url?.includes('/auth/login')
          || !refreshTokenRef.current
        ) {
          return Promise.reject(err);
        }

        original._refreshRetry = true;

        try {
          if (!refreshPromise) {
            refreshPromise = doRefresh().finally(() => {
              refreshPromise = null;
            });
          }
          const newAccessToken = await refreshPromise;
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(original);
        } catch (refreshErr) {
          // Refresh failed (revoked, expired, server down) → full logout
          setAccessToken(null);
          setRefreshToken(null);
          setUser(null);
          return Promise.reject(refreshErr);
        }
      }
    );
    return () => api.interceptors.response.eject(interceptor);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token: accessToken, // back-compat: some components read `token`
        accessToken,
        refreshToken,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
