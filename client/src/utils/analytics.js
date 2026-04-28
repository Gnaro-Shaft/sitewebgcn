import { useEffect } from 'react';
import { useLocation } from 'react-router';
import api from '../api/axios';

const SESSION_KEY = 'gcn_analytics_session';
const ADMIN_PATHS = ['/dashboard', '/admin', '/login'];

function isAdminPath(path) {
  return ADMIN_PATHS.some((p) => path.startsWith(p));
}

function shouldTrack() {
  if (typeof window === 'undefined') return false;
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return false;
  return true;
}

let lastTracked = null;

export async function trackPageView(path, articleSlug = null) {
  if (!shouldTrack()) return;
  if (isAdminPath(path)) return;

  if (lastTracked === path) return;
  lastTracked = path;

  try {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, '1');
    }
    await api.post('/analytics/track', {
      path,
      referrer: document.referrer || '',
      articleSlug,
    });
  } catch {
    // Silent fail — analytics must never break UX
  }
}

export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const articleMatch = path.match(/^\/blog\/([^/]+)$/);
    const articleSlug = articleMatch ? articleMatch[1] : null;
    trackPageView(path, articleSlug);
  }, [location.pathname]);
}
