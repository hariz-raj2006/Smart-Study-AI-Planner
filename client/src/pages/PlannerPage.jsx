import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, History, Sparkles, Wand2 } from 'lucide-react';
import Alert from '../components/Alert.jsx';
import Badge, { PriorityBadge } from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import Card, { CardHeader } from '../components/Card.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { SelectField } from '../components/Field.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SessionRow from '../components/SessionRow.jsx';
import Spinner from '../components/Spinner.jsx';
import StatCard from '../components/StatCard.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useFetch } from '../hooks/useFetch.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { aiApi, plansApi } from '../services/endpoints.js';
import { isAiError, isConfirmRequired } from '../utils/errors.js';
import { formatDate, formatMinutes } from '../utils/format.js';
import './planner.css';

const DAY_OPTIONS = [7, 14, 21, 28];
const COLLAPSED_DAYS = 5;

function groupByDate(sessions) {
  const groups = new Map();
  for (const s of sessions) {
    if (!groups.has(s.date)) groups.set(s.date, []);
    groups.get(s.date).push(s);
  }
  return [...groups.entries()];
}

function FailureAlert({ failure, busy, onRetry, onLocal }) {
  const { err, kind } = failure;
  const conflicts = err.code === 'NO_SESSIONS' && Array.isArray(err.details) ? err.details : [];
  const aiProblem = kind === 'ai' && (isAiError(err) || err.status === 429);
  return (
    <Alert
      variant="error"
      title={kind === 'ai' ? 'The AI plan could not be created' : 'The plan could not be created'}
      actions={
        <>
          <Button size="sm" variant="secondary" onClick={onRetry} disabled={Boolean(busy)}>
            Try again
          </Button>
          {aiProblem && (
            <Button size="sm" variant="secondary" icon={Wand2} onClick={onLocal} disabled={Boolean(busy)}>
              Create a scheduler-only plan instead
            </Button>
          )}
          {err.code === 'INCOMPLETE_DATA' && (
            <>
              <Link className="btn btn--secondary btn--sm" to="/subjects">
                Subjects
              </Link>
              <Link className="btn btn--secondary btn--sm" to="/availability">
                Availability
              </Link>
            </>
          )}
        </>
      }
    >
      <p>{err.message}</p>
      {conflicts.length > 1 && (
        <ul>
          {conflicts.map((c, i) => (
            <li key={i}>{c.message}</li>
          ))}
        </ul>
      )}
      <p className="text-sm" style={{ marginTop: '0.4rem' }}>
        Nothing was changed: your existing timetable is untouched. No AI result was made up.
      </p>
    </Alert>
  );
}

function PlanResult({ result }) {
  const [showAll, setShowAll] = useState(false);
  const groups = groupByDate(result.sessions);
  const visible = showAll ? groups : groups.slice(0, COLLAPSED_DAYS);
  const { summary } = result;
  const errorsFirst = [...result.conflicts].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));

  return (
    <div className="stack">
      <Alert variant="success" title={result.aiUsed ? 'Your AI-assisted study plan is ready' : 'Your scheduler-only study plan is ready'}>
        {result.aiUsed
          ? 'Gemini analysed your data and the scheduling algorithm built and validated the timetable.'
          : 'This plan was built by the scheduling algorithm alone. Gemini was not used.'}
        {result.replaced > 0 && ` ${result.replaced} earlier planned session${result.replaced === 1 ? ' was' : 's were'} replaced.`}
      </Alert>

      <div className="stats-grid">
        <StatCard icon={CalendarDays} label="Sessions planned" value={summary.sessionCount} hint={`${formatDate(summary.startDate)} to ${formatDate(summary.endDate)}`} />
        <StatCard icon={CheckCircle2} label="Time scheduled" value={formatMinutes(summary.scheduledMinutes)} hint={`of ${formatMinutes(summary.requiredMinutes)} needed`} tone={summary.scheduledMinutes >= summary.requiredMinutes ? 'success' : 'warning'} />
      </div>

      {result.conflicts.length > 0 && (
        <Alert variant={errorsFirst.some((c) => c.severity === 'error') ? 'error' : 'warning'} title="Not everything fits in your available time">
          <ul className="conflict-list">
            {errorsFirst.map((c, i) => (
              <li key={i}>{c.message}</li>
            ))}
          </ul>
        </Alert>
      )}

      {result.aiAdvice && (
        <Card accent>
          <CardHeader icon={Sparkles} title="Advice from Gemini" />
          <p>{result.aiAdvice}</p>
        </Card>
      )}
      {result.aiWarnings.length > 0 && (
        <Alert variant="info" title="Some AI suggestions were ignored">
          <ul>
            {result.aiWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Card aria-labelledby="prio-title">
        <CardHeader icon={AlertTriangle} title={<span id="prio-title">How your subjects were prioritised</span>} subtitle="Score = exam urgency 40% + performance gap 30% + difficulty 20% + workload 10% (Gemini can nudge it by at most 10 points)." />
        <div className="table-wrap">
          <table className="table priority-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Score</th>
                <th>Priority</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {result.priorities.map((p) => (
                <tr key={p.subjectId}>
                  <td>{p.subjectName}</td>
                  <td>
                    {Math.round(p.score)}
                    {p.aiNudge !== 0 && <span className="faint text-xs"> (AI {p.aiNudge > 0 ? '+' : ''}{p.aiNudge})</span>}
                  </td>
                  <td>
                    <PriorityBadge priority={p.label} />
                  </td>
                  <td className="text-sm muted">{p.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card aria-labelledby="plan-title">
        <CardHeader
          icon={CalendarDays}
          title={<span id="plan-title">Your plan</span>}
          action={
            <Link className="btn btn--secondary btn--sm" to="/timetable">
              Open timetable
            </Link>
          }
        />
        {visible.map(([date, list]) => (
          <section key={date} className="day-group" aria-label={formatDate(date)}>
            <h3 className="day-group__title">{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            {list.map((s) => (
              <SessionRow key={s.id} session={s} showExplanation />
            ))}
          </section>
        ))}
        {groups.length > COLLAPSED_DAYS && (
          <Button variant="secondary" onClick={() => setShowAll((v) => !v)} style={{ marginTop: '1rem' }}>
            {showAll ? 'Show fewer days' : `Show all ${groups.length} days`}
          </Button>
        )}
      </Card>
    </div>
  );
}

export default function PlannerPage() {
  useDocumentTitle('AI Planner');
  const toast = useToast();
  const [planDays, setPlanDays] = useLocalStorage('smartstudy.planDays', 14);
  const aiStatus = useFetch((signal) => aiApi.status({ signal }), []);
  const history = useFetch((signal) => plansApi.list({ signal }), []);

  const [busy, setBusy] = useState(null); // 'ai' | 'local' | null
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const status = aiStatus.data ? aiStatus.data.status : null;
  const aiReady = !status || status.configured;

  async function generate(kind, confirm = false) {
    setBusy(kind);
    setFailure(null);
    try {
      const body = { planDays: Number(planDays), confirm };
      const res = kind === 'ai' ? await aiApi.generatePlan(body) : await plansApi.generateLocal(body);
      setResult(res);
      setConfirmState(null);
      toast.success(kind === 'ai' ? 'AI study plan created.' : 'Scheduler-only study plan created.');
      history.reload();
    } catch (err) {
      if (isConfirmRequired(err)) {
        setConfirmState({ kind, message: err.message });
      } else {
        setConfirmState(null);
        setFailure({ kind, err });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page">
      <PageHeader title="AI Study Planner" subtitle="Generate a personalised timetable from your subjects, exams, assignments and availability." />

      <Card>
        <div className="planner-hero">
          <div className="stack">
            <h2>How your plan is made</h2>
            <ol className="planner-hero__steps">
              <li>Your academic data is checked and each subject gets a priority score.</li>
              <li>Gemini analyses it and recommends focus topics and a learning / revision / practice mix.</li>
              <li>The scheduling algorithm validates those suggestions and builds the timetable within your availability.</li>
              <li>The plan is saved and you can follow, adjust and reschedule it on the Timetable.</li>
            </ol>
          </div>
          <div className="planner-actions">
            <SelectField label="Planning window" value={planDays} onChange={(e) => setPlanDays(Number(e.target.value))}>
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  Next {d} days
                </option>
              ))}
            </SelectField>

            {status && !status.configured && (
              <Alert variant="warning" title="Gemini is not configured">
                {status.message} You can still create a scheduler-only plan below.
              </Alert>
            )}

            <Button variant="gradient" size="lg" icon={Sparkles} onClick={() => generate('ai')} loading={busy === 'ai'} disabled={Boolean(busy) || !aiReady} block>
              Generate AI Study Plan
            </Button>
            <Button variant="secondary" icon={Wand2} onClick={() => generate('local')} loading={busy === 'local'} disabled={Boolean(busy)} block>
              Generate without AI (scheduler only)
            </Button>
            {status && status.configured && (
              <p className="text-xs muted">
                Model: {status.model}. The scheduler-only plan never calls Gemini and is labelled as such.
              </p>
            )}
          </div>
        </div>
      </Card>

      {busy && (
        <Card>
          <div className="generating" role="status" aria-live="polite">
            <Spinner size={30} label="Generating your plan" />
            <div>
              <strong>{busy === 'ai' ? 'Asking Gemini and building your timetable...' : 'Building your timetable...'}</strong>
              <ul>
                <li>Checking your data and calculating priorities</li>
                {busy === 'ai' && <li>Waiting for Gemini (this can take up to 45 seconds)</li>}
                <li>Validating and scheduling sessions</li>
              </ul>
            </div>
          </div>
        </Card>
      )}

      {failure && !busy && <FailureAlert failure={failure} busy={busy} onRetry={() => generate(failure.kind)} onLocal={() => generate('local')} />}

      {result && !busy && <PlanResult result={result} />}

      <Card aria-labelledby="history-title">
        <CardHeader icon={History} title={<span id="history-title">Plan history</span>} />
        {history.data && history.data.plans.length > 0 ? (
          <ul className="list">
            {history.data.plans.slice(0, 5).map((p) => (
              <li key={p.id} className="list__item">
                <div className="grow">
                  <div className="strong">{p.title}</div>
                  <div className="text-sm muted">
                    Created {formatDate(p.createdAt.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })} · {p.sessionCount} session{p.sessionCount === 1 ? '' : 's'} remaining
                  </div>
                </div>
                <Badge tone={p.aiUsed ? 'primary' : 'neutral'}>{p.aiUsed ? 'AI-assisted' : 'Scheduler only'}</Badge>
                <Badge tone={p.status === 'active' ? 'success' : 'neutral'}>{p.status === 'active' ? 'Active' : 'Archived'}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted text-sm">{history.loading ? 'Loading...' : 'No plans yet. Your first one will show up here.'}</p>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title="Replace your upcoming plan?"
        message={confirmState ? confirmState.message : ''}
        confirmLabel="Replace and generate"
        loading={Boolean(busy)}
        onConfirm={() => generate(confirmState.kind, true)}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}