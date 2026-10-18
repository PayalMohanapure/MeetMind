import { DropdownMenu as M } from 'radix-ui';
import { cn } from '@/lib/utils';

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export function MenuContent({ className, dusk, align = 'end', side, sideOffset = 8, children, ...p }) {
  return (
    <M.Portal>
      <M.Content align={align} side={side} sideOffset={sideOffset} className={cn('z-50 min-w-[200px] rounded-[16px] p-1.5 shadow-float border data-[state=open]:animate-[rise-in_.16s_var(--ease)]', dusk ? 'dusk bg-d2 border-dl' : 'bg-surface border-line', className)} {...p}>
        {children}
      </M.Content>
    </M.Portal>
  );
}
export function MenuItem({ className, danger, icon: Icon, children, hint, ...p }) {
  return (
    <M.Item className={cn('flex items-center gap-2.5 h-10 px-3 rounded-[10px] text-[14px] font-medium outline-none cursor-pointer select-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50', danger ? 'text-coral-ink' : 'text-ink', className)} {...p}>
      {Icon && <Icon size={17} strokeWidth={1.75} className={danger ? '' : 'text-ink-2'} />}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </M.Item>
  );
}
export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-line" />;
export const MenuLabel = ({ children }) => <M.Label className="px-3 pt-2 pb-1 text-[12px] font-semibold text-ink-3">{children}</M.Label>;
