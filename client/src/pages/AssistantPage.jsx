import { useEffect, useState } from 'react';
import { CalendarClock, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import Alert, { ErrorState } from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import Card, { CardHeader } from '../components/Card.jsx';
import { FieldGroup, SelectField, TextField } from '../components/Field.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { PageLoader } from '../components/Spinner.jsx';
import { AVAILABILITY_FLAG } from '../components/OnboardingChecklist.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useFetch } from '../hooks/useFetch.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { availabilityApi } from '../services/endpoints.js';
import { errorMessage, fieldErrors } from '../utils/errors.js';
import { DAY_NAMES_LONG, DAY_NAMES_SHORT, PERIOD_OPTIONS, formatDate, formatMinutes, timeToMinutes } from '../utils/format.js';
import './availability.css';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

let keyCounter = 0;
const nextKey = () => `c-${(keyCounter += 1)}`;

function toForm(a) {
  return {
    studyDays: [...a.studyDays],
    startTime: a.startTime,
    endTime: a.endTime,
    breakMinutes: String(a.breakMinutes),
    sessionMinutes: String(a.sessionMinutes),
    maxDailyHours: String(a.maxDailyHours),
    preferredPeriod: a.preferredPeriod,
    restDates: [...a.restDates].sort(),
    commitments: a.commitments.map((c) => ({
      key: nextKey(),
      id: c.id,
      title: c.title,
      dayOfWeek: String(c.dayOfWeek),
      startTime: c.startTime,
      endTime: c.endTime,
    })),
  };
}

/** Comparable snapshot (ignores React keys) used to detect unsaved changes. */
const snapshot = (f) => JSON.stringify({ ...f, studyDays: [...f.studyDays].sort(), commitments: f.commitments.map(({ key, ...rest }) => rest) });

const num = (v) => (String(v).trim() === '' ? NaN : Number(v));

function validate(f) {
  const e = {};
  if (f.studyDays.length === 0) e.studyDays = 'Select at least one study day';
  if (!f.startTime) e.startTime = 'Choose a start time';
  if (!f.endTime) e.endTime = 'Choose an end time';
  const session = num(f.sessionMinutes);
  if (Number.isNaN(session) || session < 15 || session > 180) e.sessionMinutes = 'Enter 15 to 180 minutes';
  const brk = num(f.breakMinutes);
  if (Number.isNaN(brk) || brk < 0 || brk > 60) e.breakMinutes = 'Enter 0 to 60 minutes';
  const maxH = num(f.maxDailyHours);
  if (Number.isNaN(maxH) || maxH < 0.5 || maxH > 16) e.maxDailyHours = 'Enter 0.5 to 16 hours';

  if (f.startTime && f.endTime) {
    const len = timeToMinutes(f.endTime) - timeToMinutes(f.startTime);
    if (len <= 0) e.endTime = 'End time must be after start time';
    else if (!Number.isNaN(session) && len < session) e.endTime = 'The study window must be at least as long as one session';
  }
  f.commitments.forEach((c, i) => {
    if (!c.title.trim()) e[`commitment.${i}.title`] = 'Give it a name';
    if (!c.startTime) e[`commitment.${i}.startTime`] = 'Start time needed';
    if (!c.endTime) e[`commitment.${i}.endTime`] = 'End time needed';
    else if (c.startTime && timeToMinutes(c.endTime) <= timeToMinutes(c.startTime)) e[`commitment.${i}.endTime`] = 'Must end after it starts';
  });
  return e;
}

/** Rough weekly study capacity: per study day, the window minus commitments, capped by the daily limit. */
function weeklyMinutes(f) {
  if (!f.startTime || !f.endTime) return 0;
  const start = timeToMinutes(f.startTime);
  const end = timeToMinutes(f.endTime);
  if (end <= start) return 0;
  const cap = (num(f.maxDailyHours) || 0) * 60;
  let total = 0;
  for (const day of f.studyDays) {
    let free = end - start;
    for (const c of f.commitments) {
      if (Number(c.dayOfWeek) !== day || !c.startTime || !c.endTime) continue;
      const overlap = Math.min(end, timeToMinutes(c.endTime)) - Math.max(start, timeToMinutes(c.startTime));
      if (overlap > 0) free -= overlap;
    }
    total += Math.max(0, Math.min(free, cap));
  }
  return total;
}

/** Maps server messages such as "commitments.0.endTime" to this form's error keys. */
const mapServerErrors = (fe) =>
  Object.fromEntries(Object.entries(fe).map(([k, v]) => [k.replace(/^commitments\.(\d+)\./, 'commitment.$1.'), v]));

export default function AvailabilityPage() {
  useDocumentTitle('Availability');
  const toast = useToast();
  const [, setSavedFlag] = useLocalStorage(AVAILABILITY_FLAG, false);
  const { data, loading, error, reload, setData } = useFetch((signal) => availabilityApi.get({ signal }), []);

  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState('');
  const [restInput, setRestInput] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      const f = toForm(data.availability);
      setForm(f);
      setSaved(snapshot(f));
    }
  }, [data]);

  if (loading && !data) {
    return (
      <div className="page">
        <PageLoader label="Loading your availability..." />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="page">
        <ErrorState error={error} onRetry={reload} title="Could not load your availability" />
      </div>
    );
  }
  if (!form) return null;

  const dirty = snapshot(form) !== saved;
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleDay = (day) =>
    setForm((f) => ({ ...f, studyDays: f.studyDays.includes(day) ? f.studyDays.filter((d) => d !== day) : [...f.studyDays, day] }));

  function addRestDate() {
    if (!restInput) return;
    if (form.restDates.includes(restInput)) {
      setRestInput('');
      return;
    }
    setForm((f) => ({ ...f, restDates: [...f.restDates, restInput].sort() }));
    setRestInput('');
  }

  const updateCommitment = (key, patch) => setForm((f) => ({ ...f, commitments: f.commitments.map((c) => (c.key === key ? { ...c, ...patch } : c)) }));
  const addCommitment = () =>
    setForm((f) => ({ ...f, commitments: [...f.commitments, { key: nextKey(), title: '', dayOfWeek: '1', startTime: '09:00', endTime: '10:00' }] }));
  const removeCommitment = (key) => setForm((f) => ({ ...f, commitments: f.commitments.filter((c) => c.key !== key) }));

  async function handleSave(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) {
      setFormError('Please fix the highlighted fields before saving.');
      return;
    }
    const payload = {
      studyDays: form.studyDays,
      startTime: form.startTime,
      endTime: form.endTime,
      breakMinutes: Number(form.breakMinutes),
      sessionMinutes: Number(form.sessionMinutes),
      maxDailyHours: Number(form.maxDailyHours),
      preferredPeriod: form.preferredPeriod,
      restDates: form.restDates,
      commitments: form.commitments.map((c) => ({
        ...(c.id ? { id: c.id } : {}),
        title: c.title.trim(),
        dayOfWeek: Number(c.dayOfWeek),
        startTime: c.startTime,
        endTime: c.endTime,
      })),
    };
    setBusy(true);
    try {
      const res = await availabilityApi.update(payload);
      setData(res);
      setSavedFlag(true);
      toast.success('Availability saved. New plans will use these settings.');
    } catch (err) {
      const fe = mapServerErrors(fieldErrors(err));
      setErrors(fe);
      setFormError(Object.keys(fe).length ? 'Please fix the highlighted fields.' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    setForm(toForm(data.availability));
    setErrors({});
    setFormError('');
  }

  const weekly = weeklyMinutes(form);

  return (
    <div className="page">
      <PageHeader title="Availability & preferences" subtitle="Tell the planner when you can study. Sessions are never scheduled outside these settings." />

      <form className="stack" onSubmit={handleSave} noValidate>
        {formError && <Alert variant="error">{formError}</Alert>}

        <Card aria-labelledby="days-title">
          <CardHeader icon={CalendarClock} title={<span id="days-title">Study days and hours</span>} />
          <div className="stack">
            <FieldGroup legend="Study days" hint="Days you are willing to study. Leave a day unticked to make it a rest day." error={errors.studyDays}>
              <div className="day-chips">
                {WEEK_ORDER.map((day) => (
                  <label key={day} className="chip-toggle">
                    <input type="checkbox" checked={form.studyDays.includes(day)} onChange={() => toggleDay(day)} />
                    <span>
                      {DAY_NAMES_SHORT[day]}
                      <span className="sr-only"> ({DAY_NAMES_LONG[day]})</span>
                    </span>
                  </label>
                ))}
              </div>
            </FieldGroup>

            <div className="field-row">
              <TextField label="Daily start time" type="time" value={form.startTime} onChange={set('startTime')} error={errors.startTime} required />
              <TextField label="Daily end time" type="time" value={form.endTime} onChange={set('endTime')} error={errors.endTime} required />
            </div>

            <div className="field-row">
              <TextField label="Preferred session length (minutes)" type="number" inputMode="numeric" min="15" max="180" step="5" value={form.sessionMinutes} onChange={set('sessionMinutes')} error={errors.sessionMinutes} required />
              <TextField label="Break between sessions (minutes)" type="number" inputMode="numeric" min="0" max="60" step="5" value={form.breakMinutes} onChange={set('breakMinutes')} error={errors.breakMinutes} required />
              <TextField label="Maximum study per day (hours)" type="number" inputMode="decimal" min="0.5" max="16" step="0.5" value={form.maxDailyHours} onChange={set('maxDailyHours')} error={errors.maxDailyHours} required />
            </div>

            <SelectField label="Preferred study period" value={form.preferredPeriod} onChange={set('preferredPeriod')} hint="The planner fills this part of the day first when it can.">
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectField>

            <div className="capacity" aria-live="polite">
              <strong>{formatMinutes(weekly)}</strong>
              <span className="muted">of study time available per week (estimate, after commitments and your daily limit)</span>
            </div>
          </div>
        </Card>

        <Card aria-labelledby="rest-title">
          <CardHeader title={<span id="rest-title">Rest days</span>} subtitle="Specific dates with no studying, for example a holiday or a trip." />
          <div className="add-row">
            <TextField label="Add a rest date" type="date" value={restInput} onChange={(e) => setRestInput(e.target.value)} />
            <Button variant="secondary" icon={Plus} onClick={addRestDate} disabled={!restInput}>
              Add date
            </Button>
          </div>
          {form.restDates.length === 0 ? (
            <p className="muted text-sm" style={{ marginTop: '0.75rem' }}>
              No rest dates added.
            </p>
          ) : (
            <ul className="tag-list" aria-label="Rest dates">
              {form.restDates.map((d) => (
                <li key={d} className="tag">
                  {formatDate(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  <Button variant="ghost" size="sm" iconOnly icon={X} onClick={() => setForm((f) => ({ ...f, restDates: f.restDates.filter((x) => x !== d) }))} aria-label={`Remove rest date ${d}`} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card aria-labelledby="commit-title">
          <CardHeader
            title={<span id="commit-title">Weekly commitments</span>}
            subtitle="Classes, tuition, work or anything else that repeats every week. Study sessions are kept clear of them."
            action={
              <Button variant="secondary" icon={Plus} onClick={addCommitment}>
                Add commitment
              </Button>
            }
          />
          {form.commitments.length === 0 ? (
            <p className="muted text-sm">No weekly commitments added.</p>
          ) : (
            form.commitments.map((c, i) => (
              <div key={c.key} className="commitment-row">
                <TextField label="Name" value={c.title} onChange={(e) => updateCommitment(c.key, { title: e.target.value })} error={errors[`commitment.${i}.title`]} maxLength={80} placeholder="e.g. Maths tuition" />
                <SelectField label="Day" value={c.dayOfWeek} onChange={(e) => updateCommitment(c.key, { dayOfWeek: e.target.value })}>
                  {WEEK_ORDER.map((d) => (
                    <option key={d} value={d}>
                      {DAY_NAMES_LONG[d]}
                    </option>
                  ))}
                </SelectField>
                <TextField label="From" type="time" value={c.startTime} onChange={(e) => updateCommitment(c.key, { startTime: e.target.value })} error={errors[`commitment.${i}.startTime`]} />
                <TextField label="Until" type="time" value={c.endTime} onChange={(e) => updateCommitment(c.key, { endTime: e.target.value })} error={errors[`commitment.${i}.endTime`]} />
                <Button className="commitment-row__remove" variant="ghost" size="sm" iconOnly icon={Trash2} onClick={() => removeCommitment(c.key)} aria-label={`Remove commitment ${c.title || i + 1}`} />
              </div>
            ))
          )}
        </Card>

        <div className="form-actions">
          <span className="muted text-sm grow" aria-live="polite">
            {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
          </span>
          <Button variant="secondary" icon={RotateCcw} onClick={handleReset} disabled={!dirty || busy}>
            Discard changes
          </Button>
          <Button type="submit" icon={Save} loading={busy} disabled={!dirty}>
            Save availability
          </Button>
        </div>
      </form>
    </div>
  );
}