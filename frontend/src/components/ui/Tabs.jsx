import { Tabs as T } from 'radix-ui';
import { cn } from '@/lib/utils';
export const Tabs = T.Root;
export const TabsContent = T.Content;
export function TabsList({ className, ...p }) {
  return <T.List className={cn('inline-flex items-center gap-1 rounded-[14px] bg-surface-2 p-1 border border-line', className)} {...p} />;
}
export function TabsTrigger({ className, ...p }) {
  return <T.Trigger className={cn('h-8 px-3.5 rounded-[10px] text-[13px] font-semibold text-ink-2 transition-colors hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-raise', className)} {...p} />;
}
