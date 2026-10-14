import { useState } from 'react';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import { TextField } from '../../components/Field.jsx';
import Modal from '../../components/Modal.jsx';
import { sessionsApi } from '../../services/endpoints.js';
import { errorMessage } from '../../utils/errors.js';
import { formatMinutes } from '../../utils/format.js';

/** Mark a session completed or partly completed, and tick off the topics you finished. */
export default function CompleteDialog({ session, subject, onClose, onDone }) {
  const [mode, setMode] = useState('full');
  const [minutes, setMinutes] = useState('');
  const [topicIds, setTopicIds] = useState([]);
  const [error, setError] = useState('');
  const [minutesError, setMinutesError] = useState('');
  const [busy, setBusy] = useState(false);

  const openTopics = subject ? (subject.topics || []).filter((t) => !t.completed) : [];
  const toggleTopic = (id) => setTopicIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMinutesError('');
    const body = { completedTopicIds: topicIds };
    if (mode === 'partial') {
      const m = Number(minutes);
      if (!Number.isInteger(m) || m < 1 || m >= session.durationMinutes) {
        setMinutesError(`Enter a whole number from 1 to ${session.durationMinutes - 1}`);
        return;
      }
      body.completedMinutes = m;
    }
    setBusy(true);
    try {
      const res = await sessionsApi.complete(session.id, body);
      onDone(res);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={busy ? undefined : onClose} title="How did the session go?" description={`${session.subjectName}: ${session.topic} (${formatMinutes(session.durationMinutes)})`}>
      <form className="form" onSubmit={handleSubmit} noValidate>
        {error && <Alert variant="error">{error}</Alert>}

        <div className="radio-row" role="radiogroup" aria-label="Completion">
          <label className="radio">
            <input type="radio" name="mode" checked={mode === 'full'} onChange={() => setMode('full')} />
            I finished the whole session
          </label>
          <label className="radio">
            <input type="radio" name="mode" checked={mode === 'partial'} onChange={() => setMode('partial')} />
            I did part of it
          </label>
        </div>

        {mode === 'partial' && (
          <TextField
            label="Total minutes you completed"
            type="number"
            inputMode="numeric"
            min="1"
            max={session.durationMinutes - 1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            error={minutesError}
            hint="The rest can be rescheduled in the next step."
            required
          />
        )}

        {openTopics.length > 0 && (
          <fieldset className="field-group">
            <legend>Topics you have now completed (optional)</legend>
            <div className="stack stack--sm" style={{ marginTop: '0.5rem' }}>
              {openTopics.map((t) => (
                <label key={t.id} className="check">
                  <input type="checkbox" checked={topicIds.includes(t.id)} onChange={() => toggleTopic(t.id)} />
                  <span className="check__text">{t.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="form-actions">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {mode === 'full' ? 'Mark as completed' : 'Save partial progress'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}