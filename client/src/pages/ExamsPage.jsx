import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ClipboardList, GraduationCap } from 'lucide-react';
import { ErrorState } from '../components/Alert.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { PageLoader } from '../components/Spinner.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useFetch } from '../hooks/useFetch.js';
import { assignmentsApi, examsApi, subjectsApi } from '../services/endpoints.js';
import AssignmentsPanel from './exams/AssignmentsPanel.jsx';
import ExamsPanel from './exams/ExamsPanel.jsx';
import './items.css';

export default function ExamsPage() {
  useDocumentTitle('Exams & assignments');
  const [tab, setTab] = useState('exams');
  const { data, loading, error, reload } = useFetch(
    async (signal) => {
      const [subjects, exams, assignments] = await Promise.all([
        subjectsApi.list({ signal }),
        examsApi.list({ signal }),
        assignmentsApi.list({ signal }),
      ]);
      return { subjects: subjects.subjects, exams: exams.exams, assignments: assignments.assignments };
    },
    []
  );

  return (
    <div className="page">
      <PageHeader
        title="Exams & assignments"
        subtitle="Dates and importance feed the priority score and set the deadlines the timetable must respect."
        actions={
          <div className="segmented" role="group" aria-label="Choose a list">
            <button type="button" className="segmented__btn" aria-pressed={tab === 'exams'} onClick={() => setTab('exams')}>
              <GraduationCap size={16} aria-hidden="true" /> Exams
            </button>
            <button type="button" className="segmented__btn" aria-pressed={tab === 'assignments'} onClick={() => setTab('assignments')}>
              <ClipboardList size={16} aria-hidden="true" /> Assignments
            </button>
          </div>
        }
      />

      {loading && !data ? (
        <PageLoader label="Loading..." />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} title="Could not load this page" />
      ) : data.subjects.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="Add a subject first"
            description="Exams and assignments belong to a subject, so you need at least one subject before adding them."
            action={
              <Link className="btn btn--primary btn--md" to="/subjects">
                Go to Subjects
              </Link>
            }
          />
        </Card>
      ) : tab === 'exams' ? (
        <ExamsPanel subjects={data.subjects} exams={data.exams} onChanged={reload} />
      ) : (
        <AssignmentsPanel subjects={data.subjects} assignments={data.assignments} onChanged={reload} />
      )}
    </div>
  );
}