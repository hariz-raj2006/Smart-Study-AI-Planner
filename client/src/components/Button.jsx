import { Loader2 } from 'lucide-react';

/**
 * variant: primary | gradient | secondary | ghost | danger     size: sm | md | lg
 * Pass `icon={SomeLucideIcon}` for a leading icon. For icon-only buttons set iconOnly and an aria-label.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  iconOnly = false,
  block = false,
  type = 'button',
  className = '',
  disabled,
  children,
  ...rest
}) {
  const classes = ['btn', `btn--${variant}`, `btn--${size}`, iconOnly && 'btn--icon', block && 'btn--block', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="spin" size={16} aria-hidden="true" /> : Icon ? <Icon size={16} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}