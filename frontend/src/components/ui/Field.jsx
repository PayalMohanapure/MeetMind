import { useId, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Field({ label, error, hint, className, inputClassName, type = 'text', reveal, right, ...p }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPw = type === 'password';
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="field-label">{label}</label>}
      <div className="relative">
        <input id={id} type={isPw && shown ? 'text' : type} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined} className={cn('input', (isPw && reveal) || right ? 'pr-16' : '', inputClassName)} {...p} />
        {isPw && reveal && (
          <button type="button" onClick={() => setShown((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-2.5 rounded-[8px] text-[13px] font-semibold text-ink-2 hover:bg-surface-2" aria-label={shown ? 'Hide password' : 'Show password'}>
            {shown ? 'Hide' : 'Show'}
          </button>
        )}
        {right}
      </div>
      {error ? <p id={`${id}-e`} className="field-error"><AlertCircle size={14} />{error}</p> : hint ? <p id={`${id}-h`} className="field-hint">{hint}</p> : null}
    </div>
  );
}
