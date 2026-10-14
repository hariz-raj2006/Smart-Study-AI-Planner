import { AlertTriangle, CheckCircle2, Info, RefreshCw, XCircle } from 'lucide-react';
import Button from './Button.jsx';

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };

/** variant: info | success | warning | error. Errors and warnings are announced to screen readers. */
export default function Alert({ variant = 'info', title, children, actions, className = '' }) {
  const Icon = ICONS[variant] || Info;
  return (
    <div className={`alert alert--${variant} ${className}`} role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}>
      <Icon className="alert__icon" size={20} aria-hidden="true" />
      <div className="alert__body">
        {title && <div className="alert__title">{title}</div>}
        {children}
        {actions && <div className="alert__actions">{actions}</div>}
      </div>
    </div>
  );
}

/** A full error message with an optional "Try again" button. */
export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  return (
    <Alert
      variant="error"
      title={title}
      actions={
        onRetry && (
          <Button size="sm" variant="secondary" icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      {(error && error.message) || 'Please try again.'}
    </Alert>
  );
}