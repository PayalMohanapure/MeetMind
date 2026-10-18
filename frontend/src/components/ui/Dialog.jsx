import { Dialog as D } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Dialog({ open, onOpenChange, title, description, children, className, footer, dusk, hideTitle }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[rgba(16,20,52,.42)] backdrop-blur-[3px] data-[state=open]:animate-[rise-in_.18s_ease-out]" />
        <D.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[min(520px,calc(100vw-32px))] max-h-[calc(100vh-48px)] overflow-auto -translate-x-1/2 -translate-y-1/2 rounded-[24px] p-6 shadow-float focus:outline-none data-[state=open]:animate-[rise-in_.2s_var(--ease)]',
            dusk ? 'dusk bg-d1 border border-dl' : 'bg-surface',
            className,
          )}
        >
          <div className="flex items-start gap-4">
            <div className={cn('min-w-0 flex-1', hideTitle && 'sr-only')}>
              <D.Title className="font-display text-[22px] font-bold tracking-[-0.02em]">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-ink-2 text-[14px]">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close className="btn btn-quiet btn-icon -mr-2 -mt-2 shrink-0" aria-label="Close"><X size={18} /></D.Close>
          </div>
          <div className={cn(!hideTitle && 'mt-5')}>{children}</div>
          {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Sheet({ open, onOpenChange, title, children, side = 'right', className }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[rgba(16,20,52,.32)]" />
        <D.Content className={cn('fixed z-50 top-0 bottom-0 bg-surface shadow-float flex flex-col focus:outline-none data-[state=open]:animate-[rise-in_.2s_var(--ease)]', side === 'right' ? 'right-0 w-[min(520px,100vw)] rounded-l-[28px]' : 'left-0 w-[min(360px,100vw)] rounded-r-[28px]', className)}>
          <div className="flex items-center gap-3 px-6 h-16 border-b border-line shrink-0">
            <D.Title className="font-display text-[19px] font-bold tracking-[-0.015em] flex-1">{title}</D.Title>
            <D.Description className="sr-only">{title}</D.Description>
            <D.Close className="btn btn-quiet btn-icon" aria-label="Close"><X size={18} /></D.Close>
          </div>
          <div className="flex-1 min-h-0">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
