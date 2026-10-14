import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import { CheckboxField } from '../../components/Field.jsx';
import Modal from '../../components/Modal.jsx';
import { sessionsApi } from '../../services/endpoints.js';
import { errorMessage } from '../../utils/errors.js';
import { formatDate, formatTime } from '../../utils/format.js';

/**
 * Shows what rescheduling would change and asks for confirmation BEFORE anything is saved.
 * `sessionIds` limits the change to specific sessions; leave it undefined for "all missed sessions".
 */
export default function ProposalDialog({ proposal, sessionIds, onClose, onApplied }) {
  const [askAi, setAskAi] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { moves, unplaced, skipped } = proposal;
  const nothing = moves.length === 0 && unplaced.length === 0 && skipped.length === 0;

  async function apply() {
    setBusy(true);
    setError('');
    try {
      const body = { confirm: true, askAi, ...(sessionIds && sessionIds.length ? { sessionIds } : {}) };
      const res = await sessionsApi.rescheduleMissed(body);
      onApplied(res);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      size="lg"
      title="Review the timetable change"
      description="This is only a preview. Your timetable changes when you press Apply."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {moves.length ? 'Not now' : 'Close'}
          </Button>
          {moves.length > 0 && (
            <Button onClick={apply} loading={busy}>
              Apply {moves.length} change{moves.length === 1 ? '' : 's'}
            </Button>
          )}
        </>
      }
    >
      <div className="stack">
        {error && <Alert variant="error">{error}</Alert>}
        {nothing && <Alert variant="info">There is nothing to reschedule right now.</Alert>}

        {moves.map((m) => (
          <div key={m.fromSessionId} className="move">
            <div className="strong">
              {m.to.topic}
              <span className="faint"> · {m.to.durationMinutes} min</span>
            </div>
            <div className="move__arrow">
              {formatDate(m.from.date)} {formatTime(m.from.startTime)} <ArrowRight size={14} aria-label="moves to" style={{ verticalAlign: '-2px' }} />{' '}
              <strong style={{ color: 'var(--text)' }}>
                {formatDate(m.to.date)} {formatTime(m.to.startTime)} - {formatTime(m.to.endTime)}
              </strong>
            </div>
            <p className="text-sm muted" style={{ marginTop: '0.3rem' }}>
              {m.explanation}
            </p>
          </div>
        ))}

        {unplaced.length > 0 && (
          <Alert variant="warning" title="Could not be placed">
            <ul>
              {unplaced.map((u) => (
                <li key={u.sessionId}>
                  <strong>{u.topic}</strong>: {u.reason}
                </li>
              ))}
            </ul>
          </Alert>
        )}
        {skipped.length > 0 && (
          <Alert variant="info" title="Left as they are">
            <ul>
              {skipped.map((u) => (
                <li key={u.sessionId}>
                  <strong>{u.topic}</strong>: {u.reason}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        {moves.length > 0 && <CheckboxField label="Also ask Gemini for short advice on staying on track" checked={askAi} onChange={(e) => setAskAi(e.target.checked)} hint="Optional. If Gemini is unavailable, the change is still saved." />}
      </div>
    </Modal>
  );
}