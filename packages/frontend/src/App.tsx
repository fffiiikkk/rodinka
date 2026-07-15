import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeProvider } from './theme/ThemeProvider.js';
import { useAuth } from './hooks/useAuth.js';
import { BadgeToastProvider } from './components/badges/BadgeToastProvider.js';
import { ToastProvider } from './components/ui/Toast.js';
import LoadingScreen from './components/ui/LoadingScreen.js';
import BottomNav from './components/layout/BottomNav.js';
import TopBar from './components/layout/TopBar.js';
import PushPrompt from './components/ui/PushPrompt.js';

const LoginPage = lazy(() => import('./pages/LoginPage.js'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.js'));
const CalendarPage = lazy(() => import('./pages/CalendarPage.js'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage.js'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.js'));
const AdminPage = lazy(() => import('./pages/AdminPage.js'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.js'));
const BadgesPage = lazy(() => import('./pages/BadgesPage.js'));
const WeeklyOverviewPage = lazy(() => import('./pages/WeeklyOverviewPage.js'));
const SchedulePage = lazy(() => import('./pages/SchedulePage.js'));
const KidsTimelinePage = lazy(() => import('./pages/KidsTimelinePage.js'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.js'));

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'PARENT') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AnimatedContent({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const theme = (user?.theme ?? 'klasika') as any;
  const colorMode = (user?.colorMode ?? 'SYSTEM') as any;
  const fontScale = (user?.fontScale ?? 'NORMAL') as any;

  return (
    <ThemeProvider initialTheme={theme} initialColorMode={colorMode} initialFontScale={fontScale}>
      <ToastProvider>
        <BadgeToastProvider>
          <div className="flex flex-col min-h-dvh">
            <TopBar />
            <main className="flex-1 pb-nav">
              <AnimatedContent>
                {children}
              </AnimatedContent>
            </main>
            <BottomNav />
            <PushPrompt />
          </div>
        </BadgeToastProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/*"
            element={
              <AuthGuard>
                <AppShell>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/event/:id" element={<EventDetailPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/badges" element={<BadgesPage />} />
                    <Route path="/week" element={<WeeklyOverviewPage />} />
                    <Route path="/schedule" element={<SchedulePage />} />
                    <Route path="/kids-timeline" element={<KidsTimelinePage />} />
                    <Route
                      path="/admin/*"
                      element={
                        <AdminGuard>
                          <AdminPage />
                        </AdminGuard>
                      }
                    />
                    <Route
                      path="/reports/*"
                      element={
                        <AdminGuard>
                          <ReportsPage />
                        </AdminGuard>
                      }
                    />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </AppShell>
              </AuthGuard>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
