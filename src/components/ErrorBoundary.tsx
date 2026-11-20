import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred in System One.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('System One ErrorBoundary caught error:', error, info);
  }

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let friendlyDetail = this.state.message;
    try {
      const parsed = JSON.parse(this.state.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && parsed.error) {
        friendlyDetail = `${parsed.error}${parsed.path ? ` (${parsed.operationType} at ${parsed.path})` : ''}`;
      }
    } catch {
      // Plain error message
    }

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-8">
          <div className="flex items-center gap-3 text-red-700 mb-4">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h1 className="text-lg font-semibold text-slate-900">
              System One encountered an error
            </h1>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed mb-6 break-words">
            {friendlyDetail}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reload System One</span>
          </button>
        </div>
      </div>
    );
  }
}
