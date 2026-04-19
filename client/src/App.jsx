import { BrowserRouter, Routes, Route } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Home from './pages/Home';
import ProjectsPage from './pages/ProjectsPage';
import BlogPage from './pages/BlogPage';
import ArticlePage from './pages/ArticlePage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminDrafts from './pages/AdminDrafts';
import NotFound from './pages/NotFound';

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

            {/* Public pages with shared layout */}
            <Route path="/projects" element={<PublicLayout><ProjectsPage /></PublicLayout>} />
            <Route path="/blog" element={<PublicLayout><BlogPage /></PublicLayout>} />
            <Route path="/blog/:slug" element={<PublicLayout><ArticlePage /></PublicLayout>} />
            <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
    </HelmetProvider>
    </ErrorBoundary>
  );
}
