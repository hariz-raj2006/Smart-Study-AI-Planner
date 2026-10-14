import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import EmptyState from '../components/EmptyState.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  const { user } = useAuth();
  return (
    <div style={{ maxWidth: '36rem', margin: '0 auto', padding: '3rem 1rem' }}>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for does not exist or may have moved."
        action={
          <Link className="btn btn--primary btn--md" to={user ? '/dashboard' : '/'}>
            {user ? 'Back to the dashboard' : 'Back to the home page'}
          </Link>
        }
      />
    </div>
  );
}