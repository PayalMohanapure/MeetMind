import { ToggleGroup } from 'radix-ui';
import { cn } from '@/lib/utils';
/** Single-select segmented control (filters). */
export function Segmented({ value, onChange, options, label, className }) {
  return (
    <ToggleGroup.Root type="single" value={value} onValueChange={(v) => v && onChange(v)} aria-label={label} className={cn('inline-flex items-center gap-1 rounded-[14px] bg-surface-2 p-1 border border-line', className)}>
      {options.map((o) => (
        <ToggleGroup.Item key={o.value} value={o.value} className="h-8 px-3.5 rounded-[10px] text-[13px] font-semibold text-ink-2 hover:text-ink data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-raise inline-flex items-center gap-1.5">
          {o.icon}{o.label}{o.count !== undefined && <span className="text-ink-3 tabnum">{o.count}</span>}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
