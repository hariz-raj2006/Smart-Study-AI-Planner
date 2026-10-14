import { Link } from 'react-router-dom';

export function LogoMark({ className = 'logo__mark' }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="smartstudy-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#smartstudy-logo-gradient)" />
      <path d="M9 21l5-10 4 7 2-4 3 7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="logo" aria-label="SmartStudy AI home">
      <LogoMark />
      <span>
        SmartStudy <span className="logo__accent">AI</span>
      </span>
    </Link>
  );
}