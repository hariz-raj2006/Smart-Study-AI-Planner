import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Send, Sparkles, Trash2 } from 'lucide-react';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import Card from '../components/Card.jsx';
import FormattedText from '../components/FormattedText.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useFetch } from '../hooks/useFetch.js';
import { aiApi, statsApi } from '../services/endpoints.js';
import { errorMessage } from '../utils/errors.js';
import './assistant.css';

const MAX_QUESTION = 1000;
let messageCounter = 0;
const nextId = () => `m${(messageCounter += 1)}`;

export default function AssistantPage() {
  useDocumentTitle('AI Assistant');
  const status = useFetch((signal) => aiApi.status({ signal }), []);
  const dashboard = useFetch((signal) => statsApi.dashboard({ signal }), []);

  const [messages, setMessages] = useState([]); // { id, role, text, error?, failed?, question? }
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  const configured = !status.data || status.data.status.configured;
  const topSubject = dashboard.data && dashboard.data.priorities.length ? dashboard.data.priorities[0].subjectName : null;

  const suggestions = [
    'What should I study today?',
    'Which subject needs the most attention?',
    'How should I prepare for my next exam?',
    'Create a revision strategy.',
    'I have only two hours available today. What should I study?',
    topSubject ? `Explain why ${topSubject} has high priority.` : 'Explain why my top subject has high priority.',
  ];

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function send(question, base = messages) {
    const q = question.trim();
    if (!q || busy) return;
    const userMsg = { id: nextId(), role: 'user', text: q };
    const history = base
      .filter((m) => !m.error && !m.failed)
      .slice(-10)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));
    setMessages([...base, userMsg]);
    setInput('');
    setBusy(true);
    try {
      const res = await aiApi.assistant({ question: q, history });
      setMessages((list) => [...list, { id: nextId(), role: 'assistant', text: res.answer }]);
    } catch (err) {
      setMessages((list) => [
        ...list.map((m) => (m.id === userMsg.id ? { ...m, failed: true } : m)),
        { id: nextId(), role: 'assistant', error: true, text: errorMessage(err), question: q },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function retry(errorMsg) {
    const index = messages.findIndex((m) => m.id === errorMsg.id);
    // Remove the failed question and its error, then ask again.
    send(errorMsg.question, messages.slice(0, Math.max(0, index - 1)));
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="page">
      <PageHeader title="AI Study Assistant" subtitle="Ask about your own plan. Answers use your subjects, exams, topics and timetable, and nobody else's data." />

      {status.data && !status.data.status.configured && (
        <Alert variant="warning" title="Gemini is not configured">
          {status.data.status.message}
        </Alert>
      )}

      <Card className="chat">
        <div ref={logRef} className="chat__log" role="log" aria-live="polite" aria-label="Conversation">
          {messages.length === 0 && (
            <div className="stack stack--sm">
              <p>
                <Sparkles size={18} aria-hidden="true" style={{ verticalAlign: '-3px', color: 'var(--primary)' }} /> <strong>Hi! What would you like help with?</strong>
              </p>
              <p className="muted text-sm">Pick a question below or type your own. I can only answer from the data in your account.</p>
            </div>
          )}
          {messages.map((m) =>
            m.error ? (
              <div key={m.id} className="bubble bubble--error">
                <Alert
                  variant="error"
                  title="The assistant could not answer"
                  actions={
                    <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => retry(m)} disabled={busy}>
                      Try again
                    </Button>
                  }
                >
                  {m.text}
                </Alert>
              </div>
            ) : (
              <div key={m.id} className={`bubble bubble--${m.role}`}>
                <div className="bubble__who">{m.role === 'user' ? 'You' : 'SmartStudy AI'}</div>
                {m.role === 'user' ? <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.text}</p> : <FormattedText text={m.text} />}
              </div>
            )
          )}
          {busy && (
            <div className="bubble bubble--assistant" role="status">
              <div className="bubble__who">SmartStudy AI</div>
              <span className="typing" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="sr-only">The assistant is thinking</span>
            </div>
          )}
        </div>

        <div className="chat__suggestions" role="group" aria-label="Suggested questions">
          {suggestions.map((s) => (
            <button key={s} type="button" className="suggestion" onClick={() => send(s)} disabled={busy || !configured}>
              {s}
            </button>
          ))}
        </div>

        <form
          className="chat__form"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <label htmlFor="assistant-input" className="sr-only">
            Your question
          </label>
          <textarea
            id="assistant-input"
            className="input"
            rows={1}
            value={input}
            maxLength={MAX_QUESTION}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask a question about your study plan (Enter to send, Shift+Enter for a new line)"
            disabled={!configured}
          />
          <Button type="submit" icon={Send} loading={busy} disabled={!input.trim() || !configured}>
            Send
          </Button>
        </form>

        <div className="row row--between">
          <p className="text-xs muted">Gemini can make mistakes. Double-check important dates on your Exams page.</p>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setMessages([])} disabled={busy}>
              Clear conversation
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}