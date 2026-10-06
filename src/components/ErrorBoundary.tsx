import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen bg-[#0e0e0e] text-white select-none items-center justify-center p-8">
          <div className="bg-[#1a1a1a] p-8 rounded-2xl border border-red-500/30 max-w-[600px] w-full text-center">
            <span className="material-symbols-outlined text-red-500 text-6xl mb-4">error</span>
            <h1 className="text-2xl font-bold mb-4 text-red-400">予期せぬエラーが発生しました</h1>
            <p className="text-white/70 mb-6 text-sm">
              画面の描画中にエラーが発生しました。リロードして再度お試しください。<br/>
              (Error: {this.state.error?.message || 'Unknown'})
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full transition-all"
            >
              再読み込み
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
