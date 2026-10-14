import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, List, Plus, RefreshCw } from 'lucide-react';
import Alert, { ErrorState } from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Modal from '../components/Modal.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { PageLoader } from '../components/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useFetch } from '../hooks/useFetch.js';
import { useLocalStorage } from '../hooks/useLocalStorage.js';
import { sessionsApi, subjectsApi } from '../services/endpoints.js';
import { errorMessage } from '../utils/errors.js';
import { todayStr } from '../utils/format.js';
import CompleteDialog from './timetable/CompleteDialog.jsx';
import DayView from './timetable/DayView.jsx';
import MonthView from './timetable/MonthView.jsx';
import ProposalDialog from './timetable/ProposalDialog.jsx';
import RescheduleDialog from './timetable/RescheduleDialog.jsx';
import SessionDetail from './timetable/SessionDetail.jsx';
import SessionForm from './timetable/SessionForm.jsx';
import SkipDialog from './timetable/SkipDialog.jsx';
import WeekView from './timetable/WeekView.jsx';
import { rangeFor, shiftAnchor, titleFor } from './timetable/range.js';
import './timetable.css';

const VIEWS = [
  { id: 'day', label: 'Day', icon: List },
  { id: 'week', label: 'Week', icon: CalendarDays },
  { id: 'month', label: 'Calendar', icon: LayoutGrid },
];

export default function TimetablePage() {
  useDocumentTitle('Timetable');
  const toast = useToast();
  const today = todayStr();
  const [storedView, setView] = useLocalStorage('smartstudy.timetableView', 'week');
  const view = VIEWS.some((v) => v.id === storedView) ? storedView : 'week';
  const [anchor, setAnchor] = useState(today);
  const [dialog, setDialog] = useState(null); // { type, session?, proposal?, sessionIds? }
  const [notice, setNotice] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [checking, setChecking] = useState(false);

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const { data, loading, error, reload } = useFetch(
    async (signal) => {
      const [sessionRes, subjectRes] = await Promise.all([
        sessionsApi.list({ from: range.from, to: range.to }, { signal }),
        subjectsApi.list({ signal }),
      ]);
      return { sessions: sessionRes.sessions, breaks: sessionRes.breaks, subjects: subjectRes.subjects };
    },
    [range.from, range.to]
  );

  const close = () => setDialog(null);
  const subjectOf = (session) => (data ? data.subjects.find((s) => s.id === session.subjectId) : undefined);

  function openDay(date) {
    setAnchor(date);
    setView('day');
  }

  function handleAction(type, session) {
    setDialog({ type, session });
  }

  /** After completing / skipping, show the reschedule preview if there is anything to decide. */
  function handleCompleteDone(res) {
    reload();
    if (res.proposal && (res.proposal.moves.length || res.proposal.unplaced.length)) {
      toast.info('Session saved as partly done. Review where the rest could go.');
      setDialog({ type: 'proposal', proposal: res.proposal, sessionIds: [res.session.id] });
    } else {
      close();
      toast.success(res.session.status === 'completed' ? 'Session completed. Well done!' : 'Partial progress saved.');
    }
  }

  function handleSkipDone(res) {
    reload();
    toast.info(`Session marked as ${res.session.status}.`);
    setDialog({ type: 'proposal', proposal: res.proposal, sessionIds: [res.session.id] });
  }

  function handleApplied(res) {
    close();
    reload();
    toast.success(`${res.created.length} session${res.created.length === 1 ? '' : 's'} rescheduled.`);
    setNotice({ explanations: res.proposal.explanation, aiAdvice: res.aiAdvice, aiError: res.aiError });
  }

  async function checkMissed() {
    setChecking(true);
    try {
      const res = await sessionsApi.rescheduleMissed({ preview: true });
      setDialog({ type: 'proposal', proposal: res.proposal, sessionIds: undefined });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setChecking(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await sessionsApi.remove(dialog.session.id);
      toast.success('Session deleted.');
      close();
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  const sessions = data ? data.sessions : [];
  const breaks = data ? data.breaks : [];

  return (
    <div className="page">
      <PageHeader
        title="Timetable"
        subtitle="Follow your plan day by day. Tick sessions off, and reschedule anything you miss."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={checkMissed} loading={checking}>
              Reschedule missed sessions
            </Button>
            <Button icon={Plus} onClick={() => setDialog({ type: 'create' })} disabled={!data || data.subjects.length === 0}>
              Add session
            </Button>
          </>
        }
      />

      {notice && (
        <Alert
          variant="success"
          title="Timetable updated"
          actions={
            <Button size="sm" variant="secondary" onClick={() => setNotice(null)}>
              Dismiss
            </Button>
          }
        >
          <ul>
            {notice.explanations.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
          {notice.aiAdvice && (
            <p style={{ marginTop: '0.5rem' }}>
              <strong>Advice from Gemini:</strong> {notice.aiAdvice}
            </p>
          )}
          {notice.aiError && <p style={{ marginTop: '0.5rem' }}>Gemini advice was not available ({notice.aiError}), but your timetable was updated.</p>}
        </Alert>
      )}

      <div className="tt-toolbar">
        <div className="tt-nav">
          <Button variant="secondary" size="sm" iconOnly icon={ChevronLeft} onClick={() => setAnchor((a) => shiftAnchor(view, a, -1))} aria-label="Previous" />
          <Button variant="secondary" size="sm" onClick={() => setAnchor(today)}>
            Today
          </Button>
          <Button variant="secondary" size="sm" iconOnly icon={ChevronRight} onClick={() => setAnchor((a) => shiftAnchor(view, a, 1))} aria-label="Next" />
          <h2 className="tt-title" aria-live="polite">
            {titleFor(view, anchor)}
          </h2>
        </div>
        <div className="segmented" role="group" aria-label="Timetable view">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className="segmented__btn" aria-pressed={view === id} onClick={() => setView(id)}>
              <Icon size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <PageLoader label="Loading your timetable..." />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} title="Could not load your timetable" />
      ) : (
        <>
          {error && <ErrorState error={error} onRetry={reload} title="Could not refresh the timetable" />}
          {view === 'day' && <DayView date={anchor} today={today} sessions={sessions} breaks={breaks} onOpen={(s) => handleAction('detail', s)} onComplete={(s) => handleAction('complete', s)} />}
          {view === 'week' && <WeekView anchor={anchor} today={today} sessions={sessions} onOpen={(s) => handleAction('detail', s)} onPickDay={openDay} />}
          {view === 'month' && <MonthView anchor={anchor} today={today} sessions={sessions} onPickDay={openDay} />}
        </>
      )}

      {dialog && dialog.type === 'detail' && <SessionDetail session={dialog.session} today={today} onAction={handleAction} onClose={close} />}
      {dialog && dialog.type === 'complete' && <CompleteDialog session={dialog.session} subject={subjectOf(dialog.session)} onClose={close} onDone={handleCompleteDone} />}
      {dialog && dialog.type === 'skip' && <SkipDialog session={dialog.session} onClose={close} onDone={handleSkipDone} />}
      {dialog && dialog.type === 'reschedule' && (
        <RescheduleDialog
          session={dialog.session}
          onClose={close}
          onMoved={(res) => {
            close();
            reload();
            toast.success('Session moved.');
            (res.warnings || []).forEach((w) => toast.warning(w.message));
          }}
          onProposal={(proposal, sessionIds) => setDialog({ type: 'proposal', proposal, sessionIds })}
        />
      )}
      {dialog && dialog.type === 'proposal' && <ProposalDialog proposal={dialog.proposal} sessionIds={dialog.sessionIds} onClose={close} onApplied={handleApplied} />}
      {dialog && (dialog.type === 'create' || dialog.type === 'edit') && data && (
        <Modal open onClose={close} title={dialog.type === 'edit' ? 'Edit session' : 'Add a session'} size="md">
          <SessionForm
            session={dialog.type === 'edit' ? dialog.session : null}
            subjects={data.subjects}
            defaultDate={anchor}
            onCancel={close}
            onSaved={(res) => {
              close();
              reload();
              toast.success(dialog.type === 'edit' ? 'Session updated.' : 'Session added.');
              (res.warnings || []).forEach((w) => toast.warning(w.message));
            }}
          />
        </Modal>
      )}
      <ConfirmDialog
        open={Boolean(dialog && dialog.type === 'delete')}
        danger
        loading={deleting}
        title="Delete this session?"
        confirmLabel="Delete session"
        message={dialog && dialog.type === 'delete' ? `"${dialog.session.topic}" will be removed from your timetable.` : ''}
        onConfirm={confirmDelete}
        onCancel={close}
      />
    </div>
  );
}