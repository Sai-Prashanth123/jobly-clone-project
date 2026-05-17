import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

// Catches errors thrown by lazy() / dynamic import() chunks — typically when
// the user's network drops mid-load or an old deploy's chunk was purged.
// Renders a Reload button so the user isn't stuck on a perpetual "Loading…".
export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ChunkErrorBoundary]', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Could not load this page</h2>
        <p className="mt-2 text-sm text-gray-500 max-w-md">
          A network error prevented the portal from loading. This usually resolves with a reload.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Reload page
        </button>
      </div>
    );
  }
}
