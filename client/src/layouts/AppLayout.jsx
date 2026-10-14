import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { initials } from '../utils/format.js';
import { NAV_ITEMS } from './navItems.js';

/** Layout for every logged-in page: sidebar on desktop, slide-in menu on phones and tablets. */
export default function AppLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close the menu after navigating, and move keyboard focus to the new page.
  useEffect(() => {
    setOpen(false);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function handleLogout() {
    await logout();
    toast.success('You have been logged out.');
  }

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <aside id="app-sidebar" className={`sidebar${open ? ' is-open' : ''}`} aria-label="Sidebar">
        <div className="sidebar__top">
          <Logo to="/dashboard" />
          <button type="button" className="btn btn--ghost btn--sm btn--icon sidebar__close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <nav className="nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="nav__link">
              <Icon size={19} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__bottom">
          <div className="sidebar__user">
            <span className="avatar" aria-hidden="true">
              {initials(user?.name)}
            </span>
            <div className="grow">
              <div className="strong truncate">{user?.name}</div>
              <div className="text-xs muted truncate">{user?.email}</div>
            </div>
            <ThemeToggle />
          </div>
          <button type="button" className="btn btn--secondary btn--md btn--block" onClick={handleLogout}>
            <LogOut size={16} aria-hidden="true" />
            Log out
          </button>
        </div>
      </aside>

      <div className={`scrim${open ? ' is-open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />

      <div className="app-main">
        <div className="topbar">
          <button type="button" className="btn btn--secondary btn--sm btn--icon" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="app-sidebar">
            <Menu size={18} aria-hidden="true" />
          </button>
          <Logo to="/dashboard" />
          <ThemeToggle />
        </div>
        <main id="main" tabIndex={-1} style={{ outline: 'none' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}