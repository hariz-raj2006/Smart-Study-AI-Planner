import Card from './Card.jsx';

/** tone: primary | success | warning | danger | info */
export default function StatCard({ icon: Icon, label, value, hint, tone = 'primary' }) {
  return (
    <Card tight className={`stat-card stat-card--${tone}`}>
      {Icon && (
        <span className="stat-card__icon">
          <Icon size={22} aria-hidden="true" />
        </span>
      )}
      <div>
        <div className="stat-card__label">{label}</div>
        <div className="stat-card__value">{value}</div>
        {hint && <div className="stat-card__hint">{hint}</div>}
      </div>
    </Card>
  );
}