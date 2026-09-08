import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import RouteLoading from './components/RouteLoading';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import NotFound from './pages/NotFound';

// Depuis septembre 2026, gcn-data.fr n'a plus de partie publique : le site
// vitrine est gnaro.fr. Il ne reste que le tableau de bord et ses pages
// d'administration, toutes derrière le login.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminGnaro = lazy(() => import('./pages/AdminGnaro'));
const TikTokStudio = lazy(() => import('./pages/TikTokStudio'));

function protege(page) {
  return <ProtectedRoute>{page}</ProtectedRoute>;
}

export default function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              {/* La racine mène au tableau de bord ; non connecté, on tombe
                  sur le login via ProtectedRoute. */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={protege(<Dashboard />)} />

              {/* Brouillons du site gnaro.fr — stockés dans son dépôt Git,
                  pas en base : voir server/services/gnaroRepo.js */}
              <Route path="/admin/gnaro" element={protege(<AdminGnaro />)} />
              <Route path="/admin/tiktok" element={protege(<TikTokStudio />)} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
    </ErrorBoundary>
  );
}
