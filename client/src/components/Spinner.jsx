import { Loader2 } from 'lucide-react';

export default function Spinner({ size = 22, label = 'Loading' }) {
  return (
    <span role="status" aria-live="polite" style={{ display: 'inline-flex' }}>
      <Loader2 className="spinner" size={size} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader({ label = 'Loading...' }) {
  return (
    <div className="page-loader">
      <Spinner size={30} label={label} />
      <p aria-hidden="true">{label}</p>
    </div>
  );
}

export function Skeleton({ height = '1rem', width = '100%', style }) {
  return <span className="skeleton" style={{ height, width, ...style }} aria-hidden="true" />;
}