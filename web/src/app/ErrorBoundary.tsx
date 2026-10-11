import { Component, ErrorInfo, ReactNode } from 'react';

/** Last line of defence: a render error shows a recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="auth-wrap">
        <div className="empty" role="alert">
          <p className="empty-title">Something went wrong</p>
          <p className="empty-description">Your data is safe. Reload to pick up where you left off.</p>
          <div className="empty-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </main>
    );
  }
}
