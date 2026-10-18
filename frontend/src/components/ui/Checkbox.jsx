import { Checkbox as C } from 'radix-ui';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
export function Checkbox({ className, ...p }) {
  return (
    <C.Root className={cn('peer grid place-items-center h-[22px] w-[22px] shrink-0 rounded-[7px] border-[1.5px] border-line-strong bg-surface transition-colors hover:border-cobalt data-[state=checked]:bg-ok data-[state=checked]:border-ok', className)} {...p}>
      <C.Indicator><Check size={14} strokeWidth={3} className="text-white" /></C.Indicator>
    </C.Root>
  );
}
