export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <span className="empty-state__icon">
          <Icon size={28} aria-hidden="true" />
        </span>
      )}
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__text">{description}</p>}
      {action}
    </div>
  );
}