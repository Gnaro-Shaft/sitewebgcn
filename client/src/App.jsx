import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import RouteLoading from './components/RouteLoading';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import { usePageTracking } from './utils/analytics';

const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const ArticlePage = lazy(() => import('./pages/ArticlePage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminDrafts = lazy(() => import('./pages/AdminDrafts'));
const AdminProjects = lazy(() => import('./pages/AdminProjects'));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'));
const TikTokStudio = lazy(() => import('./pages/TikTokStudio'));
const StackPage = lazy(() => import('./pages/StackPage'));

function AnalyticsTracker() {
  usePageTracking();
  return null;
}

function PublicLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto px-4 w-full pt-16">
        {children}
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <HelmetProvider>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AnalyticsTracker />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              {/* Home — full-screen snap layout, no wrapper */}
              <Route path="/" element={<><Navbar /><Home /></>} />

              {/* Login — standalone layout */}
              <Route path="/login" element={<Login />} />

              {/* Dashboard — protected, own layout */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />

              {/* Admin drafts review */}
              <Route path="/admin/drafts" element={
                <ProtectedRoute>
                  <AdminDrafts />
                </ProtectedRoute>
              } />

              {/* Admin projects management */}
              <Route path="/admin/projects" element={
                <ProtectedRoute>
                  <AdminProjects />
                </ProtectedRoute>
              } />

              {/* Admin analytics */}
              <Route path="/admin/analytics" element={
                <ProtectedRoute>
                  <AdminAnalytics />
                </ProtectedRoute>
              } />

              {/* Admin TikTok Studio */}
              <Route path="/admin/tiktok" element={
                <ProtectedRoute>
                  <TikTokStudio />
                </ProtectedRoute>
              } />

              {/* Public pages with shared layout */}
              <Route path="/projects" element={<PublicLayout><ProjectsPage /></PublicLayout>} />
              <Route path="/stack" element={<PublicLayout><StackPage /></PublicLayout>} />
              <Route path="/blog" element={<PublicLayout><BlogPage /></PublicLayout>} />
              <Route path="/blog/:slug" element={<PublicLayout><ArticlePage /></PublicLayout>} />
              <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
    </HelmetProvider>
    </ErrorBoundary>
  );
}
