import { useState } from 'react';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { ErrorState } from '../components/Alert.jsx';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { PageLoader } from '../components/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useFetch } from '../hooks/useFetch.js';
import { subjectsApi } from '../services/endpoints.js';
import { errorMessage } from '../utils/errors.js';
import SubjectForm, { DIFFICULTY_LABELS } from './subjects/SubjectForm.jsx';
import './items.css';

function SubjectCard({ subject, busy, onEdit, onDelete, onToggleTopic }) {
  const done = subject.topics.filter((t) => t.completed).length;
  return (
    <Card className="subject-card" style={{ borderTopColor: subject.color }} as="article" aria-label={subject.name}>
      <div className="subject-card__head">
        <div>
          <h2 className="subject-card__name">{subject.name}</h2>
          <div className="subject-card__meta" style={{ marginTop: '0.35rem' }}>
            <Badge tone={subject.difficulty >= 4 ? 'danger' : subject.difficulty === 3 ? 'warning' : 'success'}>
              Difficulty {subject.difficulty}/5 · {DIFFICULTY_LABELS[subject.difficulty]}
            </Badge>
          </div>
        </div>
        <div className="subject-card__actions">
          <Button variant="ghost" size="sm" iconOnly icon={Pencil} onClick={() => onEdit(subject)} aria-label={`Edit ${subject.name}`} />
          <Button variant="ghost" size="sm" iconOnly icon={Trash2} onClick={() => onDelete(subject)} aria-label={`Delete ${subject.name}`} />
        </div>
      </div>

      <ProgressBar
        value={subject.currentPerformance}
        max={Math.max(subject.targetPerformance, 1)}
        label="Progress towards target"
        valueLabel={`${subject.currentPerformance}% of ${subject.targetPerformance}%`}
        color={subject.color}
      />

      <dl className="subject-card__stats">
        <div>
          <dt>Workload</dt>
          <dd>{subject.estimatedWorkloadHours} h</dd>
        </div>
        <div>
          <dt>Topics done</dt>
          <dd>{subject.topics.length ? `${done} / ${subject.topics.length}` : 'None added'}</dd>
        </div>
      </dl>

      {subject.topics.length > 0 && (
        <details className="topic-details">
          <summary>
            Topics ({done}/{subject.topics.length} completed)
          </summary>
          <ul className="topic-list">
            {subject.topics.map((t) => (
              <li key={t.id}>
                <label className="check">
                  <input type="checkbox" checked={t.completed} disabled={busy} onChange={() => onToggleTopic(subject, t.id)} />
                  <span className="check__text">{t.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

export default function SubjectsPage() {
  useDocumentTitle('Subjects');
  const toast = useToast();
  const { data, loading, error, reload } = useFetch((signal) => subjectsApi.list({ signal }), []);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const subjects = data ? data.subjects : [];

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(subject) {
    setEditing(subject);
    setFormOpen(true);
  }
  function handleSaved(subject) {
    toast.success(editing ? `"${subject.name}" was updated.` : `"${subject.name}" was added.`);
    setFormOpen(false);
    reload();
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await subjectsApi.remove(toDelete.id);
      toast.success(res.message || 'Subject deleted.');
      setToDelete(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  async function toggleTopic(subject, topicId) {
    setBusyId(subject.id);
    try {
      await subjectsApi.update(subject.id, {
        name: subject.name,
        color: subject.color,
        difficulty: subject.difficulty,
        currentPerformance: subject.currentPerformance,
        targetPerformance: subject.targetPerformance,
        estimatedWorkloadHours: subject.estimatedWorkloadHours,
        topics: subject.topics.map((t) => ({ id: t.id, name: t.name, completed: t.id === topicId ? !t.completed : t.completed })),
      });
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Subjects"
        subtitle="Add each subject with its difficulty, your current and target marks, expected workload and topics. The planner uses all of this."
        actions={
          <Button icon={Plus} onClick={openCreate}>
            Add subject
          </Button>
        }
      />

      {loading && !data ? (
        <PageLoader label="Loading your subjects..." />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} title="Could not load your subjects" />
      ) : subjects.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="No subjects yet"
            description="Start by adding the subjects you are studying. You can add topics now or later."
            action={
              <Button icon={Plus} onClick={openCreate}>
                Add your first subject
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="subject-grid">
          {subjects.map((s) => (
            <SubjectCard key={s.id} subject={s} busy={busyId === s.id} onEdit={openEdit} onDelete={setToDelete} onToggleTopic={toggleTopic} />
          ))}
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit subject' : 'Add a subject'} size="md">
        <SubjectForm key={editing ? editing.id : 'new'} subject={editing} onSaved={handleSaved} onCancel={() => setFormOpen(false)} />
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        loading={deleting}
        title="Delete this subject?"
        confirmLabel="Delete subject"
        message={toDelete ? `"${toDelete.name}" will be deleted together with its exams, assignments and study sessions. This cannot be undone.` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}