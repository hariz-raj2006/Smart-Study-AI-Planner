import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

const ORDER = ['light', 'dark', 'system'];
const LABELS = { light: 'Light', dark: 'Dark', system: 'System' };
const ICONS = { light: Sun, dark: Moon, system: Monitor };

/** Compact button that cycles light -> dark -> system. */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const Icon = ICONS[theme];
  return (
    <button
      type="button"
      className="btn btn--ghost btn--icon btn--md"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${LABELS[theme]}. Switch to ${LABELS[next]}.`}
      title={`Theme: ${LABELS[theme]}`}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}

/** Three-button selector used on the Settings page. onChange is optional (for saving to the account). */
export function ThemeSelector({ onChange }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="segmented" role="group" aria-label="Colour theme">
      {ORDER.map((key) => {
        const Icon = ICONS[key];
        return (
          <button
            key={key}
            type="button"
            className="segmented__btn"
            aria-pressed={theme === key}
            onClick={() => {
              setTheme(key);
              onChange?.(key);
            }}
          >
            <Icon size={16} aria-hidden="true" />
            {LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}