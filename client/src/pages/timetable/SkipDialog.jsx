import { useState } from 'react';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import { TextareaField } from '../../components/Field.jsx';
import Modal from '../../components/Modal.jsx';
import { sessionsApi } from '../../services/endpoints.js';
import { errorMessage } from '../../utils/errors.js';

/** Mark a session as missed or skipped. The next step previews how it could be rescheduled. */
export default function SkipDialog({ session, onClose, onDone }) {
  const [status, setStatus] = useState('missed');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await sessionsApi.skip(session.id, { status, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      onDone(res);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={busy ? undefined : onClose} title="Mark session as missed or skipped" description={`${session.subjectName}: ${session.topic}`}>
      <form className="form" onSubmit={handleSubmit} noValidate>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="radio-row" role="radiogroup" aria-label="What happened">
          <label className="radio">
            <input type="radio" name="status" checked={status === 'missed'} onChange={() => setStatus('missed')} />
            I missed it
          </label>
          <label className="radio">
            <input type="radio" name="status" checked={status === 'skipped'} onChange={() => setStatus('skipped')} />
            I chose to skip it
          </label>
        </div>
        <TextareaField label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
        <p className="text-sm muted">Next you will see a preview of where the planner could move it. Nothing changes until you confirm.</p>
        <div className="form-actions">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Continue
          </Button>
        </div>
      </form>
    </Modal>
  );
}