import { Component } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Orb } from '@/components/brand/Orb';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

export function FullPageLoader() {
  return (
    <div className="min-h-screen grid place-items-center bg-canvas" role="status" aria-label="Loading">
      <Orb size={56} />
    </div>
  );
}

export function EmptyState({ title, action, className, orb = true, children }) {
  return (
    <div className={cn('flex flex-col items-center text-center gap-4 py-12 px-6', className)}>
      {orb && <Orb size={72} still className="mb-2" />}
      <p className="text-ink-2 max-w-[42ch]">{title}</p>
      {children}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, className, compact }) {
  return (
    <div role="alert" className={cn('flex items-start gap-3 rounded-[16px] border border-coral-soft bg-coral-soft/60 p-4', compact ? '' : 'my-4', className)}>
      <AlertTriangle size={18} className="text-coral-ink mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-ink text-[14px]">{errorMessage(error, "This didn't load.")}</p>
        {onRetry && <button onClick={onRetry} className="btn btn-ghost btn-sm mt-3"><RotateCw size={14} />Retry</button>}
      </div>
    </div>
  );
}

export function SkeletonRows({ rows = 4, className }) {
  return (
    <div className={className} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 py-4 border-b border-line">
          <div className="flex-1 space-y-2"><div className="skeleton h-4 w-2/5" /><div className="skeleton h-3 w-1/4" /></div>
          <div className="skeleton h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(e) { console.error(e); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-canvas">
        <div className="sheet p-8 max-w-md text-center">
          <Orb size={64} still className="mx-auto mb-5" />
          <h1 className="display text-[28px]">This page hit a problem</h1>
          <p className="text-ink-2 mt-2">Reload the page to try again. If it keeps happening, go back to Home.</p>
          <div className="mt-6 flex gap-2 justify-center">
            <button className="btn btn-primary" onClick={() => location.reload()}>Reload</button>
            <a className="btn btn-ghost" href="/app">Go to Home</a>
          </div>
        </div>
      </div>
    );
  }
}
