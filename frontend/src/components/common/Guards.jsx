import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@/context/AuthContext';
import { FullPageLoader } from './States';

export function ProtectedRoute({ children }) {
  const { status } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status !== 'authed') return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return children;
}

export function GuestRoute({ children }) {
  const { status } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authed') {
    const next = new URLSearchParams(loc.search).get('next');
    return <Navigate to={next && next.startsWith('/') && !next.startsWith('//') ? next : '/app'} replace />;
  }
  return children;
}
