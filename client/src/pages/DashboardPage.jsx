import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, CalendarCheck, CheckCircle2, Clock, GraduationCap, ListTodo, Percent, Sparkles } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Alert, { ErrorState } from '../components/Alert.jsx';
import Badge, { PriorityBadge, StatusBadge } from '../components/Badge.jsx';
import Card, { CardHeader } from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import OnboardingChecklist from '../components/OnboardingChecklist.jsx';
import PageHeader from '../components/PageHeader.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { PageLoader } from '../components/Spinner.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useFetch } from '../hooks/useFetch.js';
import { statsApi } from '../services/endpoints.js';
import { ACTIVITY_LABELS, formatLongDate, formatMinutes, formatTime, relativeDays } from '../utils/format.js';
import './dashboard.css';

const TOOLTIP_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  boxShadow: 'var(--shadow-md)',
};

function WeeklyChart({ weekly }) {
  const hasData = weekly.some((d) => d.plannedHours > 0 || d.completedHours > 0);
  if (!hasData) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="No sessions planned this week"
        description="Generate a study plan and your planned and completed hours will appear here."
        action={
          <Link className="btn btn--primary btn--md" to="/planner">
            Open the AI Planner
          </Link>
        }
      />
    );
  }
  return (
    <>
      <div className="chart-box" role="img" aria-label="Bar chart of planned and completed study hours for each day of this week. The same numbers are in the table below.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} unit="h" allowDecimals />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => [`${v} h`]} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
            <Bar dataKey="plannedHours" name="Planned" fill="#818cf8" radius={[6, 6, 0, 0]} />
            <Bar dataKey="completedHours" name="Completed" fill="#7c3aed" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Study hours this week</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Planned hours</th>
            <th>Completed hours</th>
          </tr>
        </thead>
        <tbody>
          {weekly.map((d) => (
            <tr key={d.date}>
              <td>{d.label}</td>
              <td>{d.plannedHours}</td>
              <td>{d.completedHours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch((signal) => statsApi.dashboard({ signal }), []);

  if (loading && !data) {
    return (
      <div className="page">
        <PageLoader label="Loading your dashboard..." />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="page">
        <ErrorState error={error} onRetry={reload} title="Could not load your dashboard" />
      </div>
    );
  }

  const { totals, todaySessions, deadlines, priorities, weekly } = data;
  const firstName = (user?.name || 'there').split(' ')[0];

  return (
    <div className="page">
      <PageHeader
        title={`Hello, ${firstName}`}
        subtitle={formatLongDate(data.today)}
        actions={
          <Link className="btn btn--gradient btn--md" to="/planner">
            <Sparkles size={16} aria-hidden="true" />
            Generate AI Study Plan
          </Link>
        }
      />

      {error && <ErrorState error={error} onRetry={reload} title="Could not refresh the dashboard" />}

      {totals.overdueTasks > 0 && (
        <Alert
          variant="warning"
          title={`${totals.overdueTasks} session${totals.overdueTasks === 1 ? ' is' : 's are'} overdue`}
          actions={
            <Link className="btn btn--secondary btn--sm" to="/timetable">
              Review and reschedule
            </Link>
          }
        >
          Their time has passed and they are not marked done. Reschedule them so they still fit before your exams.
        </Alert>
      )}

      <OnboardingChecklist totals={totals} hasSessionsToday={todaySessions.length > 0} />

      <div className="stats-grid">
        <StatCard icon={BookOpen} label="Subjects" value={totals.subjects} />
        <StatCard icon={GraduationCap} label="Upcoming exams" value={totals.upcomingExams} tone="info" />
        <StatCard
          icon={Clock}
          label="Today's study time"
          value={formatMinutes(totals.todayPlannedMinutes)}
          hint={`${formatMinutes(totals.todayCompletedMinutes)} done`}
          tone="warning"
        />
        <StatCard icon={CheckCircle2} label="Completed tasks" value={totals.completedTasks} tone="success" />
        <StatCard icon={ListTodo} label="Pending tasks" value={totals.pendingTasks} hint={totals.overdueTasks ? `${totals.overdueTasks} overdue` : undefined} tone={totals.overdueTasks ? 'danger' : 'primary'} />
        <StatCard icon={Percent} label="Completion" value={`${totals.completionPercent}%`} hint="of sessions due so far" tone="success" />
      </div>

      <div className="dash-grid">
        <div className="dash-col">
          <Card aria-labelledby="today-title">
            <CardHeader
              icon={CalendarCheck}
              title={<span id="today-title">Today&apos;s timetable</span>}
              action={
                <Link className="btn btn--ghost btn--sm" to="/timetable">
                  Open timetable
                </Link>
              }
            />
            {todaySessions.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="Nothing scheduled today"
                description={totals.pendingTasks > 0 ? 'Your next sessions are on the timetable.' : 'Generate a plan to fill your timetable.'}
              />
            ) : (
              <div>
                {todaySessions.map((s) => (
                  <div key={s.id} className="session-row" style={{ borderLeftColor: s.subjectColor }}>
                    <div className="session-row__time">
                      {formatTime(s.startTime)} - {formatTime(s.endTime)}
                    </div>
                    <div className="session-row__main">
                      <div className="session-row__title truncate">{s.subjectName}</div>
                      <div className="session-row__sub truncate">
                        {ACTIVITY_LABELS[s.activityType] || s.activityType}: {s.topic}
                      </div>
                    </div>
                    <StatusBadge status={s.status} overdue={s.overdue} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card aria-labelledby="week-title">
            <CardHeader icon={Clock} title={<span id="week-title">Weekly progress</span>} subtitle="Planned and completed study hours, Monday to Sunday." />
            <WeeklyChart weekly={weekly} />
          </Card>
        </div>

        <div className="dash-col">
          <Card aria-labelledby="deadlines-title">
            <CardHeader icon={GraduationCap} title={<span id="deadlines-title">Upcoming deadlines</span>} />
            {deadlines.length === 0 ? (
              <EmptyState icon={GraduationCap} title="No deadlines yet" description="Add exams and assignments to see them here." />
            ) : (
              <ul className="list">
                {deadlines.map((d) => (
                  <li key={`${d.type}-${d.id}`} className="list__item">
                    <div className="grow">
                      <div className="strong truncate">{d.title}</div>
                      <div className="deadline__when">
                        {d.subjectName} · {relativeDays(d.daysRemaining)}
                      </div>
                    </div>
                    <Badge tone={d.type === 'exam' ? (d.daysRemaining <= 7 ? 'danger' : 'info') : 'primary'}>{d.type === 'exam' ? 'Exam' : 'Assignment'}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card aria-labelledby="priority-title">
            <CardHeader icon={AlertTriangle} title={<span id="priority-title">Subject priorities</span>} subtitle="Calculated from exam urgency, performance gap, difficulty and workload." />
            {priorities.length === 0 ? (
              <EmptyState icon={BookOpen} title="No subjects yet" description="Add a subject to see its priority score." />
            ) : (
              <div>
                {priorities.map((p) => (
                  <div key={p.subjectId} className="priority">
                    <div className="priority__head">
                      <span className="color-dot" style={{ background: p.color }} aria-hidden="true" />
                      <span className="strong grow truncate">{p.subjectName}</span>
                      <PriorityBadge priority={p.label} />
                    </div>
                    <ProgressBar value={p.score} max={100} small label="Priority score" valueLabel={`${Math.round(p.score)} / 100`} />
                    <div className="priority__reason">{p.nextExam ? `Exam ${relativeDays(p.nextExam.daysUntil).toLowerCase()} (${p.nextExam.title})` : 'No upcoming exam'}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}