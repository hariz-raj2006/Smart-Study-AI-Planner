import { Link } from 'react-router-dom';
import { BarChart3, Brain, CalendarClock, ListChecks, MessageCircle, RefreshCw, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useAuth } from '../context/AuthContext.jsx';
import './landing.css';

const FEATURES = [
  { icon: Target, title: 'Priority scoring', text: 'Every subject gets a score from exam urgency, the gap to your target, difficulty and remaining workload, so the most important work comes first.' },
  { icon: CalendarClock, title: 'Timetables that fit your life', text: 'Plans respect your study days, daily window, breaks, weekly commitments and rest days. Nothing is booked outside your availability.' },
  { icon: Brain, title: 'AI recommendations', text: 'Google Gemini analyses your subjects and suggests focus topics and a mix of learning, revision and practice, with a short reason for each.' },
  { icon: RefreshCw, title: 'Adaptive rescheduling', text: 'Missed a session? The planner finds a new slot before your exam or deadline, never overlaps, and tells you exactly what changed.' },
  { icon: BarChart3, title: 'Real progress tracking', text: 'Charts use only what you enter and complete: planned vs actual hours, subject progress, topic completion and your study streak.' },
  { icon: MessageCircle, title: 'Study assistant', text: 'Ask what to study today, how to prepare for your next exam, or what to do with only two hours free.' },
];

const STEPS = [
  { title: 'Create your account', text: 'Sign up in a minute. Your data is saved on your own computer.' },
  { title: 'Add subjects and topics', text: 'Set difficulty, your current and target marks, and the topics you still need to cover.' },
  { title: 'Add exams and assignments', text: 'Enter dates and importance so the planner knows what is coming.' },
  { title: 'Set your availability', text: 'Choose study days, hours, session length, breaks and commitments.' },
  { title: 'Generate your AI plan', text: 'One click builds a validated daily and weekly timetable.' },
  { title: 'Study, tick off, adapt', text: 'Mark sessions done, partly done or missed and let the plan adjust.' },
];

const STAGES = [
  { label: 'Stage A', title: 'Academic analysis (Gemini)', text: 'Gemini reads your subjects, marks, topics, exams and deadlines and returns structured recommendations: which topics to focus on, the learning / revision / practice mix, and a short note for each subject.' },
  { label: 'Stage B', title: 'Scheduling algorithm (rules)', text: 'A deterministic JavaScript algorithm turns priorities into a timetable. It checks availability, overlaps, breaks, daily limits and deadlines. It is not a trained machine-learning model.' },
  { label: 'Stage C', title: 'Adaptation', text: 'When you complete, skip or partly finish a session, progress is updated and unfinished work is rescheduled into free slots, with your confirmation for bigger changes.' },
];

export default function LandingPage() {
  useDocumentTitle('');
  const { user } = useAuth();

  return (
    <>
      <section className="landing-section hero" aria-labelledby="hero-title">
        <div>
          <span className="eyebrow">AI-powered study planner</span>
          <h1 id="hero-title">
            Study smarter with a plan that <span className="hero__accent">adapts to you</span>
          </h1>
          <p className="hero__lead">
            SmartStudy AI combines Google Gemini with an intelligent scheduling algorithm to build personalised daily and weekly timetables from your subjects, exams, marks and available time.
          </p>
          <div className="hero__cta">
            {user ? (
              <Link className="btn btn--gradient btn--lg" to="/dashboard">
                Open your dashboard
              </Link>
            ) : (
              <>
                <Link className="btn btn--gradient btn--lg" to="/register">
                  Get started
                </Link>
                <Link className="btn btn--secondary btn--lg" to="/login">
                  Log in
                </Link>
              </>
            )}
          </div>
          <p className="hero__note">Free to run on your own computer. You bring your own Gemini API key.</p>
        </div>

        <div className="preview" aria-hidden="true">
          <div className="preview__head">
            <span>Today</span>
            <span className="preview__tag">Illustration</span>
          </div>
          <div className="preview__row" style={{ borderLeftColor: '#4f46e5' }}>
            <span className="preview__time">4:00 - 4:50 pm</span>
            <div>
              <div className="preview__title">Calculus</div>
              <div className="preview__sub">Learning · High priority</div>
            </div>
          </div>
          <div className="preview__break">10 minute break</div>
          <div className="preview__row" style={{ borderLeftColor: '#10b981' }}>
            <span className="preview__time">5:00 - 5:50 pm</span>
            <div>
              <div className="preview__title">Modern history</div>
              <div className="preview__sub">Revision · Medium priority</div>
            </div>
          </div>
          <div className="preview__break">10 minute break</div>
          <div className="preview__row" style={{ borderLeftColor: '#7c3aed' }}>
            <span className="preview__time">6:00 - 6:50 pm</span>
            <div>
              <div className="preview__title">Physics</div>
              <div className="preview__sub">Practice questions · High priority</div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="landing-section landing-section--tight" aria-labelledby="features-title">
        <div className="section-head">
          <span className="eyebrow">Features</span>
          <h2 id="features-title">Everything you need to plan, study and adapt</h2>
          <p>Built for students who juggle several subjects, exams and deadlines.</p>
        </div>
        <div className="feature-grid">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="card feature">
              <span className="feature__icon">
                <Icon size={22} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="landing-section landing-section--tight" aria-labelledby="how-title">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2 id="how-title">From sign-up to a working timetable in minutes</h2>
        </div>
        <ol className="steps">
          {STEPS.map((s) => (
            <li key={s.title} className="step">
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="ai" className="landing-section landing-section--tight" aria-labelledby="ai-title">
        <div className="section-head">
          <span className="eyebrow">The AI explained</span>
          <h2 id="ai-title">Generative AI suggests. A scheduling algorithm decides.</h2>
          <p>Gemini never writes your timetable on its own. Its recommendations are validated, and every hard rule is enforced by code.</p>
        </div>
        <div className="ai-grid">
          {STAGES.map((s) => (
            <article key={s.label} className="card ai-stage">
              <span className="ai-stage__label">{s.label}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
        <div className="alert alert--info ai-note" role="note">
          <ShieldCheck className="alert__icon" size={20} aria-hidden="true" />
          <div className="alert__body">
            If Gemini is unavailable you get an honest error, never a made-up AI answer. You can still generate a plan with the scheduling algorithm alone, and it is labelled as such.
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--tight" aria-labelledby="cta-title">
        <div className="cta-band">
          <ListChecks size={34} aria-hidden="true" />
          <h2 id="cta-title" style={{ marginTop: '0.75rem' }}>
            Ready to build your first plan?
          </h2>
          <p>Add your subjects and exams, set your availability and click one button.</p>
          <Link className="btn btn--secondary btn--lg" to={user ? '/planner' : '/register'}>
            <Sparkles size={18} aria-hidden="true" />
            {user ? 'Go to the AI Planner' : 'Create your free account'}
          </Link>
        </div>
      </section>
    </>
  );
}