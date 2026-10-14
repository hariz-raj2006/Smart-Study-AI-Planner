import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CalendarCheck, LogIn, Sparkles } from 'lucide-react';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import { CheckboxField, TextField } from '../components/Field.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { errorMessage, fieldErrors } from '../utils/errors.js';
import './auth.css';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function LoginPage() {
  useDocumentTitle('Log in');
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function validate() {
    const next = {};
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (!form.password) next.password = 'Enter your password';
    return next;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      await login(form.email.trim(), form.password);
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      setFormError(Object.keys(fe).length ? '' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-aside" aria-hidden="true">
        <h2>Welcome back to your study plan</h2>
        <p>Pick up where you left off: today&apos;s sessions, upcoming deadlines and your progress are waiting.</p>
        <ul>
          <li>
            <CalendarCheck size={20} /> Daily and weekly timetables
          </li>
          <li>
            <Sparkles size={20} /> AI recommendations from Gemini
          </li>
        </ul>
      </aside>
      <div className="auth-main">
        <Card className="auth-card">
          <h1>Log in</h1>
          <p className="auth-card__sub">Enter your email and password to continue.</p>
          <form className="form" onSubmit={handleSubmit} noValidate>
            {formError && <Alert variant="error">{formError}</Alert>}
            <TextField label="Email" type="email" name="email" autoComplete="email" value={form.email} onChange={update('email')} error={errors.email} required />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              value={form.password}
              onChange={update('password')}
              error={errors.password}
              required
            />
            <CheckboxField label="Show password" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            <Button type="submit" size="lg" icon={LogIn} loading={busy} block>
              Log in
            </Button>
          </form>
          <p className="auth-switch">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}