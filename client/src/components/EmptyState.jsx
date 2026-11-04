
export default function EmptyState({
  icon: Icon,
  title = 'Nothing here',
  description,
  action,
}) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="empty-state__icon">
          <Icon size={32} aria-hidden="true" />
        </div>
      )}

      <h3 className="empty-state__title">{title}</h3>

      {description && (
        <p className="empty-state__description">
          {description}
        </p>
      )}

      {action && (
        <div className="empty-state__action">
          {action}
        </div>
      )}
    </div>
  );
}
