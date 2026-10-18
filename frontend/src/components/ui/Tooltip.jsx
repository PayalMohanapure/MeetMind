import { Tooltip as T } from 'radix-ui';
export const TooltipProvider = T.Provider;
export function Tip({ label, children, side = 'top' }) {
  if (!label) return children;
  return (
    <T.Root delayDuration={300}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={8} className="z-[60] rounded-[10px] bg-[#1A2042] px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-float">
          {label}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
