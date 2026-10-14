import { useState } from 'react';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import { TextField } from '../../components/Field.jsx';
import Modal from '../../components/Modal.jsx';
import { Skeleton } from '../../components/Spinner.jsx';
import { useFetch } from '../../hooks/useFetch.js';
import { sessionsApi } from '../../services/endpoints.js';
import { errorMessage } from '../../utils/errors.js';
import { formatDate, formatMinutes, formatTime, todayStr } from '../../utils/format.js';
import { isMovable } from './range.js';

/** Pick a new time yourself (suggestions are offered) or let the planner choose for missed sessions. */
export default function RescheduleDialog({ session, onClose, onMoved, onProposal }) {
  const slots = useFetch((signal) => sessionsApi.slots(session.id, { signal }), [session.id]);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const movable = isMovable(session);
  const minutes = session.status === 'partial' ? session.durationMinutes - (session.completedMinutes || 0) : session.durationMinutes;

  async function handleManual(e) {
    e.preventDefault();
    const found = {};
    if (!date) found.date = 'Choose a date';
    if (!startTime) found.startTime = 'Choose a start time';
    setErrors(found);
    setError('');
    if (Object.keys(found).length) return;
    setBusy('manual');
    try {
      const res = await sessionsApi.reschedule(session.id, { mode: 'manual', date, startTime });
      onMoved(res);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  async function handleAuto() {
    setBusy('auto');
    setError('');
    try {
      const res = await sessionsApi.reschedule(session.id, { mode: 'auto', preview: true });
      onProposal(res.proposal, [session.id]);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  const suggestions = slots.data ? slots.data.slots : [];

  return (
    <Modal open onClose={busy ? undefined : onClose} title={movable ? 'Reschedule session' : 'Move session'} description={`${session.subjectName}: ${session.topic} · ${formatMinutes(minutes)}`}>
      <div className="stack">
        {error && <Alert variant="error">{error}</Alert>}

        {movable && (
          <div className="stack stack--sm">
            <p className="strong">Let the planner choose</p>
            <p className="text-sm muted">It finds the earliest free slot before your exam or deadline, shows you the result, and only changes the timetable after you confirm.</p>
            <div>
              <Button onClick={handleAuto} loading={busy === 'auto'} disabled={Boolean(busy)}>
                Suggest a new time
              </Button>
            </div>
            <hr className="divider" />
          </div>
        )}

        <div className="stack stack--sm">
          <p className="strong">Choose a time yourself</p>
          {slots.loading && !slots.data ? (
            <Skeleton height="2.2rem" />
          ) : suggestions.length > 0 ? (
            <div className="slot-list" role="group" aria-label="Suggested free times">
              {suggestions.map((s) => (
                <button
                  key={`${s.date}-${s.startTime}`}
                  type="button"
                  className="slot-btn"
                  aria-pressed={date === s.date && startTime === s.startTime}
                  onClick={() => {
                    setDate(s.date);
                    setStartTime(s.startTime);
                  }}
                >
                  {formatDate(s.date)} · {formatTime(s.startTime)}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm muted">{slots.error ? 'Could not load suggestions. You can still pick a time below.' : 'No free slots were found in the next two weeks.'}</p>
          )}
        </div>

        <form className="form" onSubmit={handleManual} noValidate>
          <div className="field-row">
            <TextField label="Date" type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} required />
            <TextField label="Start time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} error={errors.startTime} required />
          </div>
          <p className="text-sm muted">The session keeps its length. The planner checks your availability, breaks, daily limit and exam dates before saving.</p>
          <div className="form-actions">
            <Button variant="secondary" onClick={onClose} disabled={Boolean(busy)}>
              Cancel
            </Button>
            <Button type="submit" variant={movable ? 'secondary' : 'primary'} loading={busy === 'manual'} disabled={Boolean(busy)}>
              Move to this time
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}