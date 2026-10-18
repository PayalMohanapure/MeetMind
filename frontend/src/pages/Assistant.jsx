import { useLocation, useNavigate, useParams, NavLink } from 'react-router';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useConversations } from '@/hooks/queries';
import { AssistantChat } from '@/components/ai/AssistantChat';
import { deleteConversation } from '@/api/agent';
import { meetingDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function Assistant() {
  const { id } = useParams();
  const loc = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const convs = useConversations();
  return (
    <div className="grid md:grid-cols-[260px_1fr] h-[calc(100vh-64px-20px)] max-md:h-[calc(100vh-64px-64px)]">
      <aside className="hidden md:flex flex-col border-r border-line min-h-0" aria-label="Conversations">
        <div className="p-4"><button onClick={() => nav('/app/assistant')} className="btn btn-ghost w-full"><Plus size={16} />New chat</button></div>
        <ul className="flex-1 overflow-y-auto scroll-thin px-2 pb-3 space-y-0.5">
          {(convs.data || []).map((c) => (
            <li key={c.id} className="group relative">
              <NavLink to={`/app/assistant/${c.id}`} className={({ isActive }) => cn('flex flex-col rounded-[12px] px-3 py-2.5 pr-9', isActive ? 'bg-surface-2' : 'hover:bg-surface-2/70')}>
                <span className="truncate text-[14px] font-semibold">{c.title}</span><span className="text-[12px] text-ink-3">{meetingDate(c.updated_at)}</span>
              </NavLink>
              <button onClick={async () => { await deleteConversation(c.id); qc.invalidateQueries({ queryKey: ['conversations'] }); if (c.id === id) nav('/app/assistant'); }} className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-[8px] grid place-items-center text-ink-3 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-surface hover:text-coral" aria-label={`Delete ${c.title}`}><Trash2 size={14} /></button>
            </li>
          ))}
          {!convs.isLoading && !convs.data?.length && <li className="px-3 py-6 text-[13px] text-ink-3 flex gap-2"><MessageSquare size={15} />Your conversations appear here.</li>}
        </ul>
      </aside>
      <AssistantChat conversationId={id} initialAsk={!id ? loc.state?.ask : undefined} onConversation={(cid) => nav(`/app/assistant/${cid}`, { replace: true })} />
    </div>
  );
}
