import { useState } from 'react';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import { SelectField, TextField, TextareaField } from '../../components/Field.jsx';
import { sessionsApi } from '../../services/endpoints.js';
import { errorMessage, fieldErrors } from '../../utils/errors.js';
import { ACTIVITY_OPTIONS, timeToMinutes, todayStr } from '../../utils/format.js';

/** Add a study session by hand, or edit a planned one. The server re-checks every rule. */
export default function SessionForm({ session, subjects, defaultDate, onSaved, onCancel }) {
  const [values, setValues] = useState({
    subjectId: session ? session.subjectId : subjects[0]?.id || '',
    date: session ? session.date : defaultDate >= todayStr() ? defaultDate : todayStr(),
    startTime: session ? session.startTime : '16:00',
    endTime: session ? session.endTime : '16:50',
    topic: session ? session.topic : '',
    activityType: session ? session.activityType : 'learning',
    notes: session ? session.notes || '' : '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  function validate() {
    const e = {};
    if (!values.subjectId) e.subjectId = 'Choose a subject';
    if (!values.topic.trim()) e.topic = 'Topic is required';
    if (!values.date) e.date = 'Choose a date';
    if (!values.startTime) e.startTime = 'Choose a start time';
    if (!values.endTime) e.endTime = 'Choose an end time';
    else if (values.startTime && timeToMinutes(values.endTime) <= timeToMinutes(values.startTime)) e.endTime = 'End time must be after start time';
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    const payload = {
      subjectId: values.subjectId,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime,
      topic: values.topic.trim(),
      activityType: values.activityType,
      ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
    };
    setBusy(true);
    try {
      const res = session ? await sessionsApi.update(session.id, payload) : await sessionsApi.create(payload);
      onSaved(res);
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      const list = err.code === 'SCHEDULE_CONFLICT' && Array.isArray(err.details) ? err.details.map((d) => d.message) : null;
      setFormError({ message: Object.keys(fe).length ? 'Please fix the highlighted fields.' : errorMessage(err), list });
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {formError && (
        <Alert variant="error" title={formError.list ? 'This does not fit your timetable' : undefined}>
          {formError.list ? (
            <ul>
              {formError.list.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          ) : (
            formError.message
          )}
        </Alert>
      )}
      <SelectField label="Subject" value={values.subjectId} onChange={set('subjectId')} error={errors.subjectId} required>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>
      <TextField label="Topic" value={values.topic} onChange={set('topic')} error={errors.topic} maxLength={120} required />
      <SelectField label="Activity" value={values.activityType} onChange={set('activityType')} error={errors.activityType}>
        {ACTIVITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectField>
      <div className="field-row">
        <TextField label="Date" type="date" min={todayStr()} value={values.date} onChange={set('date')} error={errors.date} required />
        <TextField label="Start time" type="time" value={values.startTime} onChange={set('startTime')} error={errors.startTime} required />
        <TextField label="End time" type="time" value={values.endTime} onChange={set('endTime')} error={errors.endTime} required />
      </div>
      <TextareaField label="Notes (optional)" value={values.notes} onChange={set('notes')} maxLength={300} />
      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {session ? 'Save changes' : 'Add session'}
        </Button>
      </div>
    </form>
  );
}