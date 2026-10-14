import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, CalendarClock, KeyRound, LogOut, Palette, Plug, ShieldCheck, User } from 'lucide-react';
import Alert from '../components/Alert.jsx';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import Card, { CardHeader } from '../components/Card.jsx';
import { CheckboxField, TextField } from '../components/Field.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { ThemeSelector } from '../components/ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useFetch } from '../hooks/useFetch.js';
import { aiApi } from '../services/endpoints.js';
import { errorMessage, fieldErrors } from '../utils/errors.js';
import { formatDate } from '../utils/format.js';
import './settings.css';

function ProfileCard() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFormError('');
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ name: name.trim() });
      toast.success('Profile updated.');
    } catch (err) {
      setError(fieldErrors(err).name || '');
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card aria-labelledby="profile-title">
      <CardHeader icon={User} title={<span id="profile-title">Profile</span>} />
      <form className="form" onSubmit={handleSubmit} noValidate>
        {formError && !error && <Alert variant="error">{formError}</Alert>}
        <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={error} maxLength={60} autoComplete="name" required />
        <TextField label="Email" value={user.email} readOnly hint="Your email is your login and cannot be changed here." />
        <div className="form-actions">
          <Button type="submit" loading={busy} disabled={name.trim() === user.name}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const { updateProfile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function validate() {
    const e = {};
    if (!form.currentPassword) e.currentPassword = 'Enter your current password';
    if (form.newPassword.length < 8) e.newPassword = 'Password must be at least 8 characters';
    else if (!/[A-Za-z]/.test(form.newPassword)) e.newPassword = 'Password must contain a letter';
    else if (!/\d/.test(form.newPassword)) e.newPassword = 'Password must contain a number';
    if (form.confirm !== form.newPassword) e.confirm = 'Passwords do not match';
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await updateProfile({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success('Password changed.');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      setFormError(Object.keys(fe).length ? '' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const type = show ? 'text' : 'password';
  return (
    <Card aria-labelledby="password-title">
      <CardHeader icon={KeyRound} title={<span id="password-title">Change password</span>} />
      <form className="form" onSubmit={handleSubmit} noValidate>
        {formError && <Alert variant="error">{formError}</Alert>}
        <TextField label="Current password" type={type} autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} error={errors.currentPassword} required />
        <TextField label="New password" type={type} autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} error={errors.newPassword} hint="At least 8 characters with a letter and a number." required />
        <TextField label="Confirm new password" type={type} autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} required />
        <CheckboxField label="Show passwords" checked={show} onChange={(e) => setShow(e.target.checked)} />
        <div className="form-actions">
          <Button type="submit" loading={busy}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AppearanceCard() {
  const { updateProfile } = useAuth();
  const toast = useToast();

  async function saveTheme(theme) {
    try {
      await updateProfile({ theme });
    } catch {
      toast.warning('The theme was changed on this device but could not be saved to your account.');
    }
  }

  return (
    <Card aria-labelledby="theme-title">
      <CardHeader icon={Palette} title={<span id="theme-title">Appearance</span>} subtitle="Choose light, dark, or follow your device." />
      <ThemeSelector onChange={saveTheme} />
    </Card>
  );
}

function AiConnectionCard() {
  const { data, loading, error, reload } = useFetch((signal) => aiApi.status({ signal }), []);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState(null); // { ok, ... } | { error }

  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      const res = await aiApi.test();
      setTest({ ok: true, ...res.result });
    } catch (err) {
      setTest({ ok: false, message: errorMessage(err) });
    } finally {
      setTesting(false);
    }
  }

  const s = data ? data.status : null;
  return (
    <Card aria-labelledby="ai-title">
      <CardHeader
        icon={Bot}
        title={<span id="ai-title">AI connection</span>}
        subtitle="Gemini runs on the server, so your API key never reaches this browser."
        action={s ? <Badge tone={s.configured ? 'success' : 'warning'} dot>{s.configured ? 'Configured' : 'Not configured'}</Badge> : null}
      />
      {loading && !data && <p className="muted text-sm">Checking...</p>}
      {error && !data && (
        <Alert variant="error" actions={<Button size="sm" variant="secondary" onClick={reload}>Try again</Button>}>
          {errorMessage(error)}
        </Alert>
      )}
      {s && (
        <div className="stack">
          <dl className="kv">
            <dt>Provider</dt>
            <dd>{s.provider}</dd>
            <dt>Model</dt>
            <dd>{s.model || 'Not set'}</dd>
            <dt>API key</dt>
            <dd>{s.keyPreview ? `${s.keyPreview} (hidden)` : 'Not set'}</dd>
          </dl>
          <p className="text-sm muted">{s.message}</p>
          {!s.configured && (
            <Alert variant="info" title="How to connect Gemini">
              <ol>
                <li>Create a key in Google AI Studio.</li>
                <li>
                  Open <span className="code-inline">server/.env</span> and set <span className="code-inline">GEMINI_API_KEY</span> and <span className="code-inline">GEMINI_MODEL</span>.
                </li>
                <li>Stop the server and start it again.</li>
              </ol>
            </Alert>
          )}
          <div>
            <Button variant="secondary" icon={Plug} onClick={runTest} loading={testing} disabled={!s.configured}>
              Test connection
            </Button>
          </div>
          {test && test.ok && (
            <Alert variant="success">
              Gemini answered using {test.model} in {test.latencyMs} ms.
            </Alert>
          )}
          {test && !test.ok && (
            <Alert variant="error" title="The connection test failed">
              {test.message}
            </Alert>
          )}
        </div>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const { user, logout } = useAuth();
  const toast = useToast();

  async function handleLogout() {
    await logout();
    toast.success('You have been logged out.');
  }

  return (
    <div className="page">
      <PageHeader title="Settings" subtitle="Your profile, appearance, study preferences and the AI connection." />

      <div className="settings-grid">
        <div className="stack">
          <ProfileCard />
          <PasswordCard />
        </div>
        <div className="stack">
          <AppearanceCard />

          <Card aria-labelledby="prefs-title">
            <CardHeader icon={CalendarClock} title={<span id="prefs-title">Study preferences</span>} subtitle="Study days, hours, session length, breaks, rest days and weekly commitments." />
            <Link className="btn btn--secondary btn--md" to="/availability">
              Edit availability and preferences
            </Link>
          </Card>

          <AiConnectionCard />

          <Card aria-labelledby="account-title">
            <CardHeader icon={ShieldCheck} title={<span id="account-title">Account</span>} />
            <dl className="kv" style={{ marginBottom: '1rem' }}>
              <dt>Signed in as</dt>
              <dd>{user.email}</dd>
              <dt>Member since</dt>
              <dd>{formatDate(user.createdAt.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}</dd>
            </dl>
            <Button variant="secondary" icon={LogOut} onClick={handleLogout}>
              Log out
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}