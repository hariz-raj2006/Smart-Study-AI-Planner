import { BarChart3, BookOpen, CalendarClock, CalendarDays, GraduationCap, LayoutDashboard, MessageCircle, Settings, Sparkles } from 'lucide-react';

/** The sidebar menu. Each `to` must match a route in App.jsx. */
export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/subjects', label: 'Subjects', icon: BookOpen },
  { to: '/exams', label: 'Exams', icon: GraduationCap },
  { to: '/availability', label: 'Availability', icon: CalendarClock },
  { to: '/planner', label: 'AI Planner', icon: Sparkles },
  { to: '/timetable', label: 'Timetable', icon: CalendarDays },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
  { to: '/assistant', label: 'AI Assistant', icon: MessageCircle },
  { to: '/settings', label: 'Settings', icon: Settings },
];