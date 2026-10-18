import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router';
import { Home, Video, Sparkles, CheckSquare, Settings, LogOut, Moon, Sun, Search, Plus, PanelLeftClose, PanelLeftOpen, Monitor } from 'lucide-react';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { VoiceAvatar } from '@/components/brand/VoiceAvatar';
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, MenuLabel } from '@/components/ui/Menu';
import { Tip } from '@/components/ui/Tooltip';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useMeetings } from '@/hooks/queries';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useMinutesReadyNotifier } from '@/hooks/useMinutesReadyNotifier';
import { CommandPalette } from './CommandPalette';
import { CreateMeetingDialog } from '@/components/common/CreateMeetingDialog';
import { cn, storage } from '@/lib/utils';

const NAV = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/meetings', label: 'Meetings', icon: Video },
  { to: '/app/assistant', label: 'Assistant', icon: Sparkles },
  { to: '/app/action-items', label: 'Tasks', icon: CheckSquare },
];
const TITLES = [['/app/meetings', 'Meetings'], ['/app/assistant', 'Assistant'], ['/app/action-items', 'Tasks'], ['/app/settings', 'Settings'], ['/app', 'Home']];

function UserMenu({ collapsed, align = 'start', side = 'top' }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const nav = useNavigate();
  return (
    <Menu>
      <MenuTrigger className={cn('flex items-center gap-2.5 rounded-[12px] p-2 text-left hover:bg-surface/70 transition-colors w-full', collapsed && 'justify-center')} aria-label="Account menu">
        <VoiceAvatar id={user?.id} name={user?.full_name} size={32} ring={false} />
        {!collapsed && <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-[14px]">{user?.full_name}</span><span className="block truncate text-[12px] text-ink-3">{user?.email}</span></span>}
      </MenuTrigger>
      <MenuContent align={align} side={side} className="w-[240px]">
        <MenuItem icon={Settings} onSelect={() => nav('/app/settings')}>Settings</MenuItem>
        <MenuSeparator />
        <MenuLabel>Theme</MenuLabel>
        <MenuItem icon={Sun} onSelect={() => setTheme('daylight')} hint={theme === 'daylight' ? 'On' : ''}>Daylight</MenuItem>
        <MenuItem icon={Moon} onSelect={() => setTheme('night')} hint={theme === 'night' ? 'On' : ''}>Night</MenuItem>
        <MenuItem icon={Monitor} onSelect={() => setTheme('system')} hint={theme === 'system' ? 'On' : ''}>Match system</MenuItem>
        <MenuSeparator />
        <MenuItem icon={LogOut} onSelect={async () => { await logout(); window.location.assign('/'); }}>Log out</MenuItem>
      </MenuContent>
    </Menu>
  );
}

function Sidebar({ collapsed, setCollapsed }) {
  const { data: meetings } = useMeetings();
  const recent = (meetings || []).filter((m) => m.status !== 'scheduled').slice(0, 5);
  return (
    <aside className={cn('hidden md:flex flex-col sticky top-0 h-screen py-3.5 px-3 transition-[width] duration-200', collapsed ? 'w-[76px]' : 'w-[248px]')} aria-label="Main">
      <div className={cn('flex items-center gap-2 px-2 pt-1 pb-5', collapsed && 'justify-center px-0')}>
        <Link to="/app" aria-label="MeetMind home">{collapsed ? <LogoMark size={28} /> : <Logo size={28} />}</Link>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <Tip key={to} label={collapsed ? label : null} side="right">
            <NavLink to={to} end={end} className={({ isActive }) => cn('group flex items-center gap-3 h-10 rounded-[12px] px-3 font-semibold text-[15px] transition-all', collapsed && 'justify-center px-0', isActive ? 'bg-surface text-ink shadow-raise' : 'text-ink-2 hover:text-ink hover:bg-surface/60')}>
              {({ isActive }) => (<><Icon size={18} strokeWidth={1.75} className={isActive ? 'text-cobalt' : ''} />{!collapsed && label}</>)}
            </NavLink>
          </Tip>
        ))}
      </nav>
      {!collapsed && recent.length > 0 && (
        <div className="mt-6">
          <p className="px-3 pb-1.5 text-[12px] font-semibold text-ink-3">Recent</p>
          {recent.map((m) => (
            <NavLink key={m.code} to={m.status === 'live' ? `/app/meet/${m.code}/lobby` : `/app/meetings/${m.code}`} className={({ isActive }) => cn('flex items-center gap-2 h-9 rounded-[10px] px-3 text-[14px] font-medium truncate', isActive ? 'bg-surface text-ink shadow-raise' : 'text-ink-2 hover:text-ink hover:bg-surface/60')}>
              <span className="truncate flex-1">{m.title}</span>
              {m.status === 'live' && <span className="h-2 w-2 rounded-full bg-coral shadow-[0_0_0_3px_var(--coral-soft)]" aria-label="Live" />}
            </NavLink>
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-col gap-1">
        <button onClick={() => setCollapsed(!collapsed)} className={cn('btn btn-quiet btn-sm justify-start text-ink-3', collapsed && 'justify-center')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen size={16} /> : <><PanelLeftClose size={16} />Collapse</>}
        </button>
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}

function MobileTabBar() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur border-t border-line flex pb-[env(safe-area-inset-bottom)]" aria-label="Main">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex-1 h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold', isActive ? 'text-cobalt' : 'text-ink-3')}>
          <Icon size={20} strokeWidth={1.75} />{label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const loc = useLocation();
  const { user } = useAuth();
  const [collapsed, setCollapsedS] = useState(() => storage.get('mm-sidebar', false));
  const setCollapsed = (v) => { setCollapsedS(v); storage.set('mm-sidebar', v); };
  const [palette, setPalette] = useState(false);
  const [create, setCreate] = useState(false);
  useHotkeys({ 'mod+k': () => setPalette((p) => !p) }, { allowInInputs: ['mod+k'] });
  useMinutesReadyNotifier(true);
  const title = TITLES.find(([p]) => loc.pathname.startsWith(p))?.[1] || 'MeetMind';
  useEffect(() => { document.title = `${title} · MeetMind`; }, [title]);

  return (
    <div className="min-h-screen bg-canvas md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 btn btn-primary">Skip to content</a>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex-1 min-w-0 md:py-2.5 md:pr-2.5">
        <div className="md:sheet min-h-screen md:min-h-[calc(100vh-20px)] bg-surface flex flex-col md:overflow-hidden">
          {user?.is_demo && (
            <div className="bg-sun-soft text-ink text-[13px] px-5 md:px-7 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>You're in the demo account. Changes reset every day.</span>
              <Link to="/register" className="link">Create your own account</Link>
            </div>
          )}
          <header className="h-16 flex items-center gap-3 px-4 md:px-7 border-b border-line shrink-0 sticky top-0 md:static z-30 bg-surface/95 backdrop-blur md:backdrop-blur-none">
            <span className="md:hidden"><LogoMark size={28} /></span>
            <h1 className="font-display text-[20px] font-bold tracking-[-0.015em]">{title}</h1>
            <button onClick={() => setPalette(true)} className="ml-auto hidden sm:flex items-center gap-2.5 h-10 w-[300px] rounded-[12px] border border-line bg-surface-2 px-3 text-[14px] text-ink-3 hover:border-line-strong transition-colors" aria-label="Search or ask MeetMind">
              <Search size={16} /><span className="flex-1 text-left">Search or ask MeetMind</span><span className="kbd">Ctrl K</span>
            </button>
            <button onClick={() => setPalette(true)} className="sm:hidden ml-auto btn btn-quiet btn-icon" aria-label="Search"><Search size={18} /></button>
            <button onClick={() => setCreate(true)} className="btn btn-primary"><Plus size={16} className="sm:hidden" /><span className="hidden sm:inline">New meeting</span></button>
            <span className="md:hidden"><UserMenu collapsed align="end" side="bottom" /></span>
          </header>
          <main id="main" className="flex-1 min-h-0 md:overflow-y-auto scroll-thin pb-20 md:pb-0" key={loc.pathname.split('/').slice(0, 3).join('/')}>
            <div className="anim-rise"><Outlet /></div>
          </main>
        </div>
      </div>
      <MobileTabBar />
      <CommandPalette open={palette} onOpenChange={setPalette} onNewMeeting={() => setCreate(true)} />
      <CreateMeetingDialog open={create} onOpenChange={setCreate} mode="now" />
    </div>
  );
}
