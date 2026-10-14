import { useState } from 'react';
import { GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import Alert from '../../components/Alert.jsx';
import Badge from '../../components/Badge.jsx';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SelectField, TextField } from '../../components/Field.jsx';
import Modal from '../../components/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { examsApi } from '../../services/endpoints.js';
import { errorMessage, fieldErrors } from '../../utils/errors.js';
import { formatTime, relativeDays, todayStr } from '../../utils/format.js';
import { isoDateValid } from './helpers.js';
import ItemRow from './ItemRow.jsx';

export const IMPORTANCE_LABELS = { 1: 'Low', 2: 'Minor', 3: 'Moderate', 4: 'High', 5: 'Critical' };

function ExamForm({ exam, subjects, onSaved, onCancel }) {
  const [values, setValues] = useState({
    subjectId: exam ? exam.subjectId : subjects[0]?.id || '',
    title: exam ? exam.title : '',
    date: exam ? exam.date : '',
    startTime: exam && exam.startTime ? exam.startTime : '',
    importance: String(exam ? exam.importance : 3),
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  function validate() {
    const e = {};
    if (!values.subjectId) e.subjectId = 'Choose a subject';
    if (!values.title.trim()) e.title = 'Exam title is required';
    if (!isoDateValid(values.date)) e.date = 'Choose a valid date';
    else if (values.date < todayStr() && !(exam && exam.date === values.date)) e.date = 'Choose today or a future date';
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    const payload = {
      subjectId: values.subjectId,
      title: values.title.trim(),
      date: values.date,
      importance: Number(values.importance),
      ...(values.startTime ? { startTime: values.startTime } : {}),
    };
    setBusy(true);
    try {
      const res = exam ? await examsApi.update(exam.id, payload) : await examsApi.create(payload);
      onSaved(res.exam);
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      setFormError(Object.keys(fe).length ? 'Please fix the highlighted fields.' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {formError && <Alert variant="error">{formError}</Alert>}
      <SelectField label="Subject" value={values.subjectId} onChange={set('subjectId')} error={errors.subjectId} required>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>
      <TextField label="Exam title" value={values.title} onChange={set('title')} error={errors.title} placeholder="e.g. Mathematics mid-term" maxLength={100} required />
      <div className="field-row">
        <TextField label="Date" type="date" min={exam ? undefined : todayStr()} value={values.date} onChange={set('date')} error={errors.date} required />
        <TextField label="Start time (optional)" type="time" value={values.startTime} onChange={set('startTime')} error={errors.startTime} hint="With a time, only that part of the day is kept free. Without one, the whole day is." />
      </div>
      <SelectField label="Importance" value={values.importance} onChange={set('importance')} error={errors.importance} hint="Important exams get more urgency in the priority score." required>
        {Object.entries(IMPORTANCE_LABELS).map(([n, label]) => (
          <option key={n} value={n}>
            {n} - {label}
          </option>
        ))}
      </SelectField>
      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {exam ? 'Save changes' : 'Add exam'}
        </Button>
      </div>
    </form>
  );
}

export default function ExamsPanel({ subjects, exams, onChanged }) {
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const upcoming = exams.filter((e) => e.status !== 'past');
  const past = exams.filter((e) => e.status === 'past').reverse();

  function open(exam) {
    setEditing(exam);
    setFormOpen(true);
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await examsApi.remove(toDelete.id);
      toast.success('Exam deleted.');
      setToDelete(null);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  function renderRow(exam) {
    const subject = subjectById.get(exam.subjectId);
    const isPast = exam.status === 'past';
    const countdownTone = isPast ? 'neutral' : exam.daysRemaining <= 3 ? 'danger' : exam.daysRemaining <= 7 ? 'warning' : 'info';
    return (
      <ItemRow
        key={exam.id}
        dateStr={exam.date}
        title={exam.title}
        subjectName={subject ? subject.name : 'Deleted subject'}
        subjectColor={subject ? subject.color : '#64748b'}
        details={exam.startTime ? <span>· {formatTime(exam.startTime)}</span> : null}
        done={isPast}
        badges={
          <>
            <Badge tone={countdownTone}>{isPast ? 'Past' : relativeDays(exam.daysRemaining)}</Badge>
            <Badge tone="primary">
              Importance {exam.importance}/5 · {IMPORTANCE_LABELS[exam.importance]}
            </Badge>
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" iconOnly icon={Pencil} onClick={() => open(exam)} aria-label={`Edit ${exam.title}`} />
            <Button variant="ghost" size="sm" iconOnly icon={Trash2} onClick={() => setToDelete(exam)} aria-label={`Delete ${exam.title}`} />
          </>
        }
      />
    );
  }

  return (
    <>
      <div className="row row--between">
        <p className="muted">Exam days are kept free of study sessions, and every subject's sessions are scheduled before its exam.</p>
        <Button icon={Plus} onClick={() => open(null)}>
          Add exam
        </Button>
      </div>

      {exams.length === 0 ? (
        <Card>
          <EmptyState
            icon={GraduationCap}
            title="No exams yet"
            description="Add your exam dates so the planner can calculate urgency and schedule revision at the right time."
            action={
              <Button icon={Plus} onClick={() => open(null)}>
                Add your first exam
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {upcoming.length === 0 ? <p className="muted">No upcoming exams.</p> : <ul className="item-list">{upcoming.map(renderRow)}</ul>}
          {past.length > 0 && (
            <details className="past-details">
              <summary>Past exams ({past.length})</summary>
              <ul className="item-list">{past.map(renderRow)}</ul>
            </details>
          )}
        </>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit exam' : 'Add an exam'}>
        <ExamForm
          key={editing ? editing.id : 'new'}
          exam={editing}
          subjects={subjects}
          onCancel={() => setFormOpen(false)}
          onSaved={() => {
            toast.success(editing ? 'Exam updated.' : 'Exam added.');
            setFormOpen(false);
            onChanged();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        loading={deleting}
        title="Delete this exam?"
        confirmLabel="Delete exam"
        message={toDelete ? `"${toDelete.title}" will be removed. Study sessions already in your timetable are not deleted.` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}