import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { ProtectedRoute, GuestRoute } from '@/components/common/Guards';
import { ErrorBoundary, FullPageLoader } from '@/components/common/States';
import { AppShell } from '@/components/layout/AppShell';
import { BackendStatus } from '@/components/common/BackendStatus';

const Landing = lazy(() => import('@/pages/Landing'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const Home = lazy(() => import('@/pages/Home'));
const Meetings = lazy(() => import('@/pages/Meetings'));
const MeetingRecord = lazy(() => import('@/pages/MeetingRecord'));
const Lobby = lazy(() => import('@/pages/Lobby'));
const MeetingRoom = lazy(() => import('@/pages/MeetingRoom'));
const CallEnded = lazy(() => import('@/pages/CallEnded'));
const Assistant = lazy(() => import('@/pages/Assistant'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const Settings = lazy(() => import('@/pages/Settings'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider delayDuration={300}>
              <BrowserRouter>
                <ScrollToTop />
                <Suspense fallback={<FullPageLoader />}>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
                    <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
                    <Route path="/app/meet/:code/lobby" element={<Lobby />} />
                    <Route path="/app/meet/:code" element={<ProtectedRoute><MeetingRoom /></ProtectedRoute>} />
                    <Route path="/app/meet/:code/ended" element={<ProtectedRoute><CallEnded /></ProtectedRoute>} />
                    <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
                      <Route index element={<Home />} />
                      <Route path="meetings" element={<Meetings />} />
                      <Route path="meetings/:code" element={<MeetingRecord />} />
                      <Route path="assistant" element={<Assistant />} />
                      <Route path="assistant/:id" element={<Assistant />} />
                      <Route path="action-items" element={<Tasks />} />
                      <Route path="settings/*" element={<Settings />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
              <BackendStatus />
              <Toaster
                position="bottom-right"
                visibleToasts={1}
                toastOptions={{
                  unstyled: true,
                  classNames: {
                    toast: 'flex items-center gap-3 rounded-[16px] bg-[#1A2042] text-white pl-4 pr-3 py-3 shadow-float text-[14px] font-medium min-w-[280px] max-w-[440px]',
                    actionButton: '!bg-transparent !text-[#9DB0FF] font-semibold ml-auto px-2 hover:!text-white',
                    title: 'flex-1',
                  },
                }}
              />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
