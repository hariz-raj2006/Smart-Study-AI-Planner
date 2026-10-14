import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/** Layout for the landing page, login and registration. */
export default function PublicLayout() {
  const { user } = useAuth();
  const location = useLocation();

  // Make links like /#features scroll to the right section.
  useEffect(() => {
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [location.pathname, location.hash]);

  return (
    <div className="public-shell">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className="public-header">
        <Logo />
        <nav className="public-nav" aria-label="Site sections">
          <Link to={{ pathname: '/', hash: '#features' }}>Features</Link>
          <Link to={{ pathname: '/', hash: '#how-it-works' }}>How it works</Link>
          <Link to={{ pathname: '/', hash: '#ai' }}>The AI</Link>
        </nav>
        <div className="public-actions">
          <ThemeToggle />
          {user ? (
            <Link className="btn btn--primary btn--md" to="/dashboard">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link className="btn btn--ghost btn--md" to="/login">
                Log in
              </Link>
              <Link className="btn btn--primary btn--md" to="/register">
                Get started
              </Link>
            </>
          )}
        </div>
      </header>
      <main id="main" tabIndex={-1} className="public-main">
        <Outlet />
      </main>
      <footer className="public-footer">
        <span>SmartStudy AI: a college project combining Generative AI with a deterministic scheduling algorithm.</span>
        <span>Your data stays on your own computer.</span>
      </footer>
    </div>
  );
}