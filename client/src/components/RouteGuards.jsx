import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PageLoader } from './Spinner.jsx';
import { ErrorState } from './Alert.jsx';

/** Pages inside this guard need a login. Everyone else is sent to /login (and brought back afterwards). */
export function ProtectedRoute() {
  const { user, status, bootError, retry } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader label="Checking your session..." />;
  if (status === 'error') {
    return (
      <div style={{ maxWidth: '32rem', margin: '4rem auto', padding: '0 1rem' }}>
        <ErrorState title="Cannot reach the server" error={bootError} onRetry={retry} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** Login and register pages: a logged-in student goes straight to the dashboard. */
export function PublicOnlyRoute() {
  const { user, status } = useAuth();
  if (status === 'loading') return <PageLoader label="Loading..." />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}