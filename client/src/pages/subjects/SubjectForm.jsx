import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import { FieldGroup, SelectField, TextField } from '../../components/Field.jsx';
import { subjectsApi } from '../../services/endpoints.js';
import { errorMessage, fieldErrors } from '../../utils/errors.js';

export const DIFFICULTY_LABELS = { 1: 'Very easy', 2: 'Easy', 3: 'Medium', 4: 'Hard', 5: 'Very hard' };
const SWATCHES = ['#4f46e5', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

let keyCounter = 0;
const nextKey = () => `topic-${(keyCounter += 1)}`;

function initialValues(subject) {
  return {
    name: subject ? subject.name : '',
    difficulty: String(subject ? subject.difficulty : 3),
    currentPerformance: subject ? String(subject.currentPerformance) : '',
    targetPerformance: subject ? String(subject.targetPerformance) : '',
    estimatedWorkloadHours: subject ? String(subject.estimatedWorkloadHours) : '',
    color: subject ? subject.color : '',
    topics: (subject ? subject.topics : []).map((t) => ({ key: nextKey(), id: t.id, name: t.name, completed: t.completed })),
  };
}

const toNumber = (v) => (String(v).trim() === '' ? NaN : Number(v));

function validate(v) {
  const e = {};
  const name = v.name.trim();
  if (!name) e.name = 'Subject name is required';
  else if (name.length > 80) e.name = 'Keep the name under 80 characters';

  const cur = toNumber(v.currentPerformance);
  if (Number.isNaN(cur) || cur < 0 || cur > 100) e.currentPerformance = 'Enter a number from 0 to 100';
  const target = toNumber(v.targetPerformance);
  if (Number.isNaN(target) || target < 0 || target > 100) e.targetPerformance = 'Enter a number from 0 to 100';
  const hours = toNumber(v.estimatedWorkloadHours);
  if (Number.isNaN(hours) || hours < 0.5 || hours > 500) e.estimatedWorkloadHours = 'Enter hours from 0.5 to 500';
  if (v.topics.some((t) => t.name.trim().length > 100)) e.topics = 'Topic names must be under 100 characters';
  return e;
}

/** Create / edit form for one subject. Shows server-side validation messages too. */
export default function SubjectForm({ subject, onSaved, onCancel }) {
  const [values, setValues] = useState(() => initialValues(subject));
  const [newTopic, setNewTopic] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const gapWarning =
    !Number.isNaN(toNumber(values.currentPerformance)) &&
    !Number.isNaN(toNumber(values.targetPerformance)) &&
    toNumber(values.targetPerformance) < toNumber(values.currentPerformance);

  function addTopic() {
    const name = newTopic.trim();
    if (!name) return;
    if (values.topics.length >= 100) {
      setErrors((e) => ({ ...e, topics: 'A subject can have at most 100 topics' }));
      return;
    }
    setValues((v) => ({ ...v, topics: [...v.topics, { key: nextKey(), name, completed: false }] }));
    setNewTopic('');
  }

  const updateTopic = (key, patch) =>
    setValues((v) => ({ ...v, topics: v.topics.map((t) => (t.key === key ? { ...t, ...patch } : t)) }));
  const removeTopic = (key) => setValues((v) => ({ ...v, topics: v.topics.filter((t) => t.key !== key) }));

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    const payload = {
      name: values.name.trim(),
      difficulty: Number(values.difficulty),
      currentPerformance: Number(values.currentPerformance),
      targetPerformance: Number(values.targetPerformance),
      estimatedWorkloadHours: Number(values.estimatedWorkloadHours),
      topics: values.topics
        .filter((t) => t.name.trim())
        .map((t) => ({ ...(t.id ? { id: t.id } : {}), name: t.name.trim(), completed: t.completed })),
      ...(values.color ? { color: values.color } : {}),
    };

    setBusy(true);
    try {
      const res = subject ? await subjectsApi.update(subject.id, payload) : await subjectsApi.create(payload);
      onSaved(res.subject);
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      setFormError(Object.keys(fe).length && err.status !== 409 ? 'Please fix the highlighted fields.' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {formError && <Alert variant="error">{formError}</Alert>}

      <TextField label="Subject name" value={values.name} onChange={set('name')} error={errors.name} placeholder="e.g. Mathematics" maxLength={80} required />

      <div className="field-row">
        <SelectField label="Difficulty" value={values.difficulty} onChange={set('difficulty')} error={errors.difficulty} required>
          {Object.entries(DIFFICULTY_LABELS).map(([n, label]) => (
            <option key={n} value={n}>
              {n} - {label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Estimated workload (hours)"
          type="number"
          inputMode="decimal"
          min="0.5"
          max="500"
          step="0.5"
          value={values.estimatedWorkloadHours}
          onChange={set('estimatedWorkloadHours')}
          error={errors.estimatedWorkloadHours}
          hint="Total study time you expect this subject to need."
          required
        />
      </div>

      <div className="field-row">
        <TextField
          label="Current performance (%)"
          type="number"
          inputMode="decimal"
          min="0"
          max="100"
          value={values.currentPerformance}
          onChange={set('currentPerformance')}
          error={errors.currentPerformance}
          hint="Your latest mark or estimate."
          required
        />
        <TextField
          label="Target performance (%)"
          type="number"
          inputMode="decimal"
          min="0"
          max="100"
          value={values.targetPerformance}
          onChange={set('targetPerformance')}
          error={errors.targetPerformance}
          hint={gapWarning ? 'Your target is below your current mark, so this subject will get a low performance-gap score.' : 'The mark you are aiming for.'}
          required
        />
      </div>

      <FieldGroup legend="Colour" hint="Used on your timetable. Leave on Auto to let the app choose.">
        <div className="swatches">
          <button type="button" className="swatch swatch--auto" aria-pressed={values.color === ''} onClick={() => setValues((v) => ({ ...v, color: '' }))} aria-label="Automatic colour">
            Auto
          </button>
          {SWATCHES.map((hex) => (
            <button key={hex} type="button" className="swatch" style={{ background: hex }} aria-pressed={values.color === hex} onClick={() => setValues((v) => ({ ...v, color: hex }))} aria-label={`Colour ${hex}`} />
          ))}
          <input type="color" className="color-input" value={values.color || '#4f46e5'} onChange={set('color')} aria-label="Pick a custom colour" />
        </div>
      </FieldGroup>

      <FieldGroup legend="Topics" hint="Tick the topics you have already completed. The planner schedules the rest." error={errors.topics}>
        <div className="topic-editor">
          {values.topics.map((t, i) => (
            <div key={t.key} className="topic-row">
              <input type="checkbox" checked={t.completed} onChange={(e) => updateTopic(t.key, { completed: e.target.checked })} aria-label={`Topic ${i + 1} completed`} />
              <input className="input" value={t.name} onChange={(e) => updateTopic(t.key, { name: e.target.value })} aria-label={`Topic ${i + 1} name`} maxLength={100} />
              <Button variant="ghost" size="sm" iconOnly icon={Trash2} onClick={() => removeTopic(t.key)} aria-label={`Remove topic ${t.name || i + 1}`} />
            </div>
          ))}
          <div className="topic-add">
            <input
              className="input"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTopic();
                }
              }}
              placeholder="Add a topic and press Enter"
              aria-label="New topic name"
              maxLength={100}
            />
            <Button variant="secondary" icon={Plus} onClick={addTopic}>
              Add
            </Button>
          </div>
        </div>
      </FieldGroup>

      <div className="form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {subject ? 'Save changes' : 'Add subject'}
        </Button>
      </div>
    </form>
  );
}