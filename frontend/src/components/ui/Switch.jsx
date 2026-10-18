import { Switch as S } from 'radix-ui';
import { cn } from '@/lib/utils';
export function Switch({ className, onWhite = true, ...p }) {
  return (
    <S.Root className={cn('relative inline-flex h-6 w-[42px] shrink-0 items-center rounded-full transition-colors data-[state=checked]:bg-cobalt', onWhite ? 'bg-surface-3' : 'bg-white/25', className)} {...p}>
      <S.Thumb className="block h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(20,28,90,.35)] transition-transform translate-x-[3px] data-[state=checked]:translate-x-[21px]" />
    </S.Root>
  );
}
