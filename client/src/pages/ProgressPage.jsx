import { Link } from 'react-router-dom';
import { Activity, BarChart3, CheckCircle2, Clock, Flame, Target, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ErrorState } from '../components/Alert.jsx';
import Card, { CardHeader } from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { PageLoader } from '../components/Spinner.jsx';
import StatCard from '../components/StatCard.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useFetch } from '../hooks/useFetch.js';
import { statsApi } from '../services/endpoints.js';
import { formatDate } from '../utils/format.js';
import './dashboard.css';
import './progress.css';

const TOOLTIP_STYLE = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', boxShadow: 'var(--shadow-md)' };
const TICK = { fill: 'var(--text-muted)', fontSize: 12 };

/** One row per date, one column per subject, for the performance line chart. */
function performanceRows(subjects) {
  const dates = [...new Set(subjects.flatMap((s) => s.performanceHistory.map((p) => p.date)))].sort();
  return dates.map((date) => {
    const row = { date, label: formatDate(date, { day: 'numeric', month: 'short' }) };
    for (const s of subjects) {
      const points = s.performanceHistory.filter((p) => p.date === date);
      if (points.length) row[s.subjectId] = points[points.length - 1].value;
    }
    return row;
  });
}

export default function ProgressPage() {
  useDocumentTitle('Progress');
  const { data, loading, error, reload } = useFetch((signal) => statsApi.progress({ signal }), []);

  if (loading && !data) {
    return (
      <div className="page">
        <PageLoader label="Loading your progress..." />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="page">
        <ErrorState error={error} onRetry={reload} title="Could not load your progress" />
      </div>
    );
  }

  const { summary, weeks, subjects } = data;
  const hasStudyData = weeks.some((w) => w.plannedHours > 0 || w.completedHours > 0);
  const withHistory = subjects.filter((s) => s.performanceHistory.length >= 2);
  const perfRows = performanceRows(withHistory);
  const subjectBars = subjects.filter((s) => s.plannedHours > 0);

  return (
    <div className="page">
      <PageHeader title="Progress" subtitle="Everything here is calculated from the sessions you completed and the marks you entered. Nothing is estimated or invented." />

      <div className="stats-grid">
        <StatCard icon={Clock} label="Planned so far" value={`${summary.totalPlannedHours} h`} />
        <StatCard icon={CheckCircle2} label="Actually completed" value={`${summary.totalCompletedHours} h`} tone="success" />
        <StatCard icon={Target} label="Task completion rate" value={`${summary.taskCompletionRate}%`} hint="of sessions due so far" tone="info" />
        <StatCard icon={Flame} label="Study streak" value={`${summary.dayStreak} day${summary.dayStreak === 1 ? '' : 's'}`} hint="in a row" tone="warning" />
        <StatCard icon={Activity} label="Weekly streak" value={`${summary.weekStreak} week${summary.weekStreak === 1 ? '' : 's'}`} hint="with at least one session done" tone="warning" />
        <StatCard icon={BarChart3} label="Sessions completed" value={summary.sessionsCompleted} tone="success" />
      </div>

      <Card aria-labelledby="weeks-title">
        <CardHeader icon={Clock} title={<span id="weeks-title">Planned vs completed hours</span>} subtitle="The last 8 weeks." />
        {!hasStudyData ? (
          <EmptyState
            icon={BarChart3}
            title="No study data yet"
            description="Generate a plan and mark sessions as done. Your hours will show up here."
            action={
              <Link className="btn btn--primary btn--md" to="/planner">
                Open the AI Planner
              </Link>
            }
          />
        ) : (
          <>
            <div className="chart-box" role="img" aria-label="Bar chart of planned and completed study hours per week for the last 8 weeks. The same numbers are in the table below.">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeks} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={TICK} axisLine={false} tickLine={false} unit="h" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => [`${v} h`]} labelFormatter={(l) => `Week of ${l}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="plannedHours" name="Planned" fill="#818cf8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="completedHours" name="Completed" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="sr-only">
              <caption>Planned and completed hours per week</caption>
              <thead>
                <tr>
                  <th>Week starting</th>
                  <th>Planned hours</th>
                  <th>Completed hours</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.weekStart}>
                    <td>{w.weekStart}</td>
                    <td>{w.plannedHours}</td>
                    <td>{w.completedHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>

      <div className="grid grid--2">
        <Card aria-labelledby="subject-title">
          <CardHeader icon={Target} title={<span id="subject-title">Subject-wise completion</span>} subtitle="Completed vs planned time for sessions due so far." />
          {subjectBars.length === 0 ? (
            <EmptyState icon={Target} title="Nothing to compare yet" description="Subjects appear here once they have sessions that were due." />
          ) : (
            <>
              <div className="chart-box" role="img" aria-label="Bar chart of the completion percentage for each subject. The same numbers are in the table below." style={{ height: `${Math.max(12, subjectBars.length * 3.2)}rem` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectBars} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={TICK} axisLine={false} tickLine={false} unit="%" />
                    <YAxis type="category" dataKey="name" tick={TICK} axisLine={false} tickLine={false} width={110} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => [`${v}%`, 'Completed']} />
                    <Bar dataKey="completionPercent" radius={[0, 6, 6, 0]}>
                      {subjectBars.map((s) => (
                        <Cell key={s.subjectId} fill={s.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="sr-only">
                <caption>Completion percentage by subject</caption>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectBars.map((s) => (
                    <tr key={s.subjectId}>
                      <td>{s.name}</td>
                      <td>{s.completionPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Card>

        <Card aria-labelledby="topics-title">
          <CardHeader icon={CheckCircle2} title={<span id="topics-title">Topic completion</span>} subtitle="Topics you have ticked off in each subject." />
          {subjects.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No subjects yet" description="Add subjects and topics to track them here." />
          ) : (
            <div className="progress-list">
              {subjects.map((s) => (
                <ProgressBar
                  key={s.subjectId}
                  label={s.name}
                  value={s.topicsDone}
                  max={Math.max(s.topicsTotal, 1)}
                  valueLabel={s.topicsTotal ? `${s.topicsDone} / ${s.topicsTotal} topics` : 'No topics added'}
                  color={s.color}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card aria-labelledby="perf-title">
        <CardHeader icon={TrendingUp} title={<span id="perf-title">Performance changes</span>} subtitle="Your own recorded marks. A new point is saved whenever you update a subject's current performance." />
        {withHistory.length === 0 ? (
          <EmptyState icon={TrendingUp} title="No changes recorded yet" description="Update a subject's current performance after a test or mock exam and the trend will appear here." action={<Link className="btn btn--secondary btn--md" to="/subjects">Go to Subjects</Link>} />
        ) : (
          <>
            <div className="chart-box chart-box--tall" role="img" aria-label="Line chart of your recorded marks over time for each subject. The same numbers are in the table below.">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={perfRows} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={TICK} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {withHistory.map((s) => (
                    <Line key={s.subjectId} type="monotone" dataKey={s.subjectId} name={s.name} stroke={s.color} strokeWidth={2.5} dot connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
        {subjects.length > 0 && (
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Current</th>
                  <th>Target</th>
                  <th>Change</th>
                  <th>Study time (done / planned)</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.subjectId}>
                    <td>
                      <span className="color-dot" style={{ background: s.color, marginRight: '0.5rem' }} aria-hidden="true" />
                      {s.name}
                    </td>
                    <td>{s.currentPerformance}%</td>
                    <td>{s.targetPerformance}%</td>
                    <td>
                      {s.performanceChange === null ? (
                        <span className="faint">No change recorded</span>
                      ) : (
                        <span className={s.performanceChange >= 0 ? 'change-up' : 'change-down'}>
                          {s.performanceChange > 0 ? '+' : ''}
                          {s.performanceChange} points
                        </span>
                      )}
                    </td>
                    <td>
                      {s.completedHours} h / {s.plannedHours} h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}