import { useState } from 'react';
import { Check, ClipboardList, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import Alert from '../../components/Alert.jsx';
import Badge from '../../components/Badge.jsx';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { SelectField, TextField } from '../../components/Field.jsx';
import Modal from '../../components/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { assignmentsApi } from '../../services/endpoints.js';
import { errorMessage, fieldErrors } from '../../utils/errors.js';
import { formatMinutes, relativeDays } from '../../utils/format.js';
import { isoDateValid } from './helpers.js';
import ItemRow from './ItemRow.jsx';

function AssignmentForm({ assignment, subjects, onSaved, onCancel }) {
  const [values, setValues] = useState({
    subjectId: assignment ? assignment.subjectId : subjects[0]?.id || '',
    title: assignment ? assignment.title : '',
    dueDate: assignment ? assignment.dueDate : '',
    estimatedHours: assignment ? String(assignment.estimatedHours) : '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  function validate() {
    const e = {};
    if (!values.subjectId) e.subjectId = 'Choose a subject';
    if (!values.title.trim()) e.title = 'Assignment title is required';
    if (!isoDateValid(values.dueDate)) e.dueDate = 'Choose a valid due date';
    const hours = values.estimatedHours.trim() === '' ? NaN : Number(values.estimatedHours);
    if (Number.isNaN(hours) || hours < 0.25 || hours > 100) e.estimatedHours = 'Enter hours from 0.25 to 100';
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
      dueDate: values.dueDate,
      estimatedHours: Number(values.estimatedHours),
      completed: assignment ? assignment.completed : false,
    };
    setBusy(true);
    try {
      const res = assignment ? await assignmentsApi.update(assignment.id, payload) : await assignmentsApi.create(payload);
      onSaved(res.assignment);
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
      <TextField label="Assignment title" value={values.title} onChange={set('title')} error={errors.title} placeholder="e.g. Lab report 3" maxLength={100} required />
      <div className="field-row">
        <TextField label="Due date" type="date" value={values.dueDate} onChange={set('dueDate')} error={errors.dueDate} required />
        <TextField
          label="Estimated hours"
          type="number"
          inputMode="decimal"
          min="0.25"
          max="100"
          step="0.25"
          value={values.estimatedHours}
          onChange={set('estimatedHours')}
          error={errors.estimatedHours}
          hint="How long the work will take in total."
          required
        />
      </div>
      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {assignment ? 'Save changes' : 'Add assignment'}
        </Button>
      </div>
    </form>
  );
}

export default function AssignmentsPanel({ subjects, assignments, onChanged }) {
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const open = (assignment) => {
    setEditing(assignment);
    setFormOpen(true);
  };

  async function toggleDone(a) {
    setBusyId(a.id);
    try {
      await assignmentsApi.update(a.id, {
        subjectId: a.subjectId,
        title: a.title,
        dueDate: a.dueDate,
        estimatedHours: a.estimatedHours,
        completed: !a.completed,
      });
      toast.success(a.completed ? 'Marked as not done.' : 'Nice work! Assignment marked as done.');
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await assignmentsApi.remove(toDelete.id);
      toast.success('Assignment deleted.');
      setToDelete(null);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="row row--between">
        <p className="muted">Assignments become &quot;Assignment work&quot; sessions that always finish on or before the due date.</p>
        <Button icon={Plus} onClick={() => open(null)}>
          Add assignment
        </Button>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="No assignments yet"
            description="Add assignments with a due date and the time they need, and the planner will fit them in."
            action={
              <Button icon={Plus} onClick={() => open(null)}>
                Add your first assignment
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="item-list">
          {assignments.map((a) => {
            const subject = subjectById.get(a.subjectId);
            const tone = a.status === 'done' ? 'success' : a.status === 'overdue' ? 'danger' : a.status === 'today' ? 'warning' : 'info';
            const label = a.status === 'done' ? 'Done' : a.status === 'overdue' ? 'Overdue' : relativeDays(a.daysRemaining);
            return (
              <ItemRow
                key={a.id}
                dateStr={a.dueDate}
                title={a.title}
                subjectName={subject ? subject.name : 'Deleted subject'}
                subjectColor={subject ? subject.color : '#64748b'}
                details={<span>· about {formatMinutes(a.estimatedHours * 60)}</span>}
                done={a.completed}
                badges={<Badge tone={tone}>{label}</Badge>}
                actions={
                  <>
                    <Button variant="secondary" size="sm" icon={a.completed ? RotateCcw : Check} loading={busyId === a.id} onClick={() => toggleDone(a)}>
                      {a.completed ? 'Undo' : 'Mark done'}
                    </Button>
                    <Button variant="ghost" size="sm" iconOnly icon={Pencil} onClick={() => open(a)} aria-label={`Edit ${a.title}`} />
                    <Button variant="ghost" size="sm" iconOnly icon={Trash2} onClick={() => setToDelete(a)} aria-label={`Delete ${a.title}`} />
                  </>
                }
              />
            );
          })}
        </ul>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit assignment' : 'Add an assignment'}>
        <AssignmentForm
          key={editing ? editing.id : 'new'}
          assignment={editing}
          subjects={subjects}
          onCancel={() => setFormOpen(false)}
          onSaved={() => {
            toast.success(editing ? 'Assignment updated.' : 'Assignment added.');
            setFormOpen(false);
            onChanged();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        loading={deleting}
        title="Delete this assignment?"
        confirmLabel="Delete assignment"
        message={toDelete ? `"${toDelete.title}" will be removed from your list.` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}