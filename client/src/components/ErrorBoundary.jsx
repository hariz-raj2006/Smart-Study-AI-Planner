import { Component } from 'react';

/** Last safety net: if a screen crashes, show a friendly message instead of a blank page. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Screen crashed:', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ maxWidth: '32rem', margin: '4rem auto', padding: '1.5rem', textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <p className="muted" style={{ margin: '0.75rem 0 1.25rem' }}>
          The page hit an unexpected problem. Reloading usually fixes it.
        </p>
        <button type="button" className="btn btn--primary btn--md" onClick={() => window.location.reload()}>
          Reload the page
        </button>
      </div>
    );
  }
}