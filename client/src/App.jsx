import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import PublicLayout from './layouts/PublicLayout.jsx';
import AssistantPage from './pages/AssistantPage.jsx';
import AvailabilityPage from './pages/AvailabilityPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ExamsPage from './pages/ExamsPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import PlannerPage from './pages/PlannerPage.jsx';
import ProgressPage from './pages/ProgressPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import SubjectsPage from './pages/SubjectsPage.jsx';
import TimetablePage from './pages/TimetablePage.jsx';

/**
 * Route map
 *   Public:     /  /login  /register   (login and register redirect to /dashboard when already logged in)
 *   Logged in:  /dashboard /subjects /exams /availability /planner /timetable /progress /assistant /settings
 */
export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route element={<PublicOnlyRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="availability" element={<AvailabilityPage />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="timetable" element={<TimetablePage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}