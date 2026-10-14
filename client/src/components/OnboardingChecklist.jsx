import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Rocket, X } from 'lucide-react';
import Button from './Button.jsx';
import Card, { CardHeader } from './Card.jsx';
import ProgressBar from './ProgressBar.jsx';
import { useLocalStorage } from '../hooks/useLocalStorage.js';

/** localStorage flag the Availability page sets when the student saves their settings. */
export const AVAILABILITY_FLAG = 'smartstudy.availabilitySaved';

/**
 * "Getting started" checklist. Every tick comes from the student's real data
 * (nothing is faked): subjects, exams, a generated plan and a completed session.
 */
export default function OnboardingChecklist({ totals, hasSessionsToday }) {
  const [dismissed, setDismissed] = useLocalStorage('smartstudy.onboardingDismissed', false);
  const [availabilitySaved] = useLocalStorage(AVAILABILITY_FLAG, false);

  const steps = [
    { id: 'account', label: 'Create your account', done: true },
    { id: 'subjects', label: 'Add your subjects and topics', done: totals.subjects > 0, to: '/subjects', cta: 'Add subjects' },
    { id: 'exams', label: 'Add your exam dates', done: totals.upcomingExams > 0, to: '/exams', cta: 'Add exams' },
    { id: 'availability', label: 'Set your available study time', done: availabilitySaved, to: '/availability', cta: 'Set availability' },
    { id: 'plan', label: 'Generate your AI study plan', done: totals.pendingTasks + totals.completedTasks > 0 || hasSessionsToday, to: '/planner', cta: 'Open planner' },
    { id: 'complete', label: 'Mark a session as completed and watch your progress update', done: totals.completedTasks > 0, to: '/timetable', cta: 'Open timetable' },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  if (dismissed || doneCount === steps.length) return null;

  return (
    <Card accent aria-labelledby="onboarding-title">
      <CardHeader
        icon={Rocket}
        title={<span id="onboarding-title">Getting started</span>}
        subtitle="Follow these steps to get your first personalised timetable."
        action={
          <Button variant="ghost" size="sm" iconOnly onClick={() => setDismissed(true)} aria-label="Hide the getting started checklist">
            <X size={16} aria-hidden="true" />
          </Button>
        }
      />
      <ProgressBar value={doneCount} max={steps.length} label="Setup progress" valueLabel={`${doneCount} of ${steps.length}`} />
      <ul className="checklist" style={{ marginTop: '1rem' }}>
        {steps.map((s) => (
          <li key={s.id} className="checklist__item" data-done={s.done}>
            {s.done ? <CheckCircle2 className="checklist__icon" size={20} aria-hidden="true" /> : <Circle className="checklist__icon" size={20} aria-hidden="true" />}
            <span className="checklist__label">
              {s.label}
              <span className="sr-only">{s.done ? ' (done)' : ' (to do)'}</span>
            </span>
            {!s.done && s.to && (
              <Link className="btn btn--secondary btn--sm" to={s.to}>
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p className="text-sm muted" style={{ marginTop: '0.9rem' }}>
        Tip: if you miss a session, open the Timetable and use <strong>Reschedule</strong>. The planner finds a new slot and explains the change.
      </p>
    </Card>
  );
}