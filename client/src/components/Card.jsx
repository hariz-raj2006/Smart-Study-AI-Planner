export default function Card({ as: Tag = 'section', className = '', tight = false, flat = false, accent = false, children, ...rest }) {
  const classes = ['card', tight && 'card--tight', flat && 'card--flat', accent && 'card--accent', className].filter(Boolean).join(' ');
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, icon: Icon, action, headingLevel: Heading = 'h2' }) {
  return (
    <div className="card__header">
      <div className="card__heading">
        {Icon && (
          <span className="card__icon">
            <Icon size={20} aria-hidden="true" />
          </span>
        )}
        <div>
          <Heading className="card__title">{title}</Heading>
          {subtitle && <p className="card__subtitle">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}