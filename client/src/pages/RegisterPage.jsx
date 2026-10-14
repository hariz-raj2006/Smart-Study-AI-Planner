import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Circle, ListChecks, ShieldCheck, UserPlus } from 'lucide-react';
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

/** Same rules the server enforces (the server always re-checks them). */
const passwordChecks = (password, confirm) => [
  { ok: password.length >= 8, label: 'At least 8 characters' },
  { ok: /[A-Za-z]/.test(password), label: 'Contains a letter' },
  { ok: /\d/.test(password), label: 'Contains a number' },
  { ok: password.length > 0 && password === confirm, label: 'Both passwords match' },
];

export default function RegisterPage() {
  useDocumentTitle('Create account');
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const checks = passwordChecks(form.password, form.confirmPassword);

  function validate() {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Name must be at least 2 characters';
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address';
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters';
    else if (!/[A-Za-z]/.test(form.password)) next.password = 'Password must contain a letter';
    else if (!/\d/.test(form.password)) next.password = 'Password must contain a number';
    if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match';
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
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password, confirmPassword: form.confirmPassword });
      toast.success('Your account is ready. Let\u2019s add your subjects.');
      navigate('/dashboard', { replace: true });
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
        <h2>Build a study plan that fits you</h2>
        <p>Create an account, add your subjects and exams, and let SmartStudy AI plan the rest.</p>
        <ul>
          <li>
            <ListChecks size={20} /> Priorities calculated from your real data
          </li>
          <li>
            <ShieldCheck size={20} /> Passwords are hashed and your data stays on your computer
          </li>
        </ul>
      </aside>
      <div className="auth-main">
        <Card className="auth-card">
          <h1>Create your account</h1>
          <p className="auth-card__sub">It only takes a minute.</p>
          <form className="form" onSubmit={handleSubmit} noValidate>
            {formError && <Alert variant="error">{formError}</Alert>}
            <TextField label="Full name" name="name" autoComplete="name" value={form.name} onChange={update('name')} error={errors.name} required />
            <TextField label="Email" type="email" name="email" autoComplete="email" value={form.email} onChange={update('email')} error={errors.email} required />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              error={errors.password}
              required
            />
            <TextField
              label="Confirm password"
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              error={errors.confirmPassword}
              required
            />
            <ul className="rules" aria-label="Password requirements">
              {checks.map((c) => (
                <li key={c.label} data-ok={c.ok}>
                  {c.ok ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
                  <span>
                    {c.label}
                    <span className="sr-only">{c.ok ? ' (done)' : ' (not yet)'}</span>
                  </span>
                </li>
              ))}
            </ul>
            <CheckboxField label="Show passwords" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            <Button type="submit" size="lg" icon={UserPlus} loading={busy} block>
              Create account
            </Button>
          </form>
          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}