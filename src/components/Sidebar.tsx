import {
  Download,
  FolderSync,
  Library,
  Search,
  Settings,
} from 'lucide-react';
import type { DownloaderSettings, SpotifyCredentialStatus } from '../shared/types';

export type NavTab = 'discover' | 'downloads' | 'library' | 'sync' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  collapsed: boolean;
  activeDownloadsCount: number;
  totalDownloadsCount: number;
  libraryCount: number;
  settings: DownloaderSettings;
  spotifyStatus: SpotifyCredentialStatus;
  onSelectTab: (tab: NavTab) => void;
}

export function Sidebar({
  activeTab,
  collapsed,
  activeDownloadsCount,
  totalDownloadsCount,
  libraryCount,
  settings,
  spotifyStatus,
  onSelectTab,
}: SidebarProps) {
  const navItems: {
    id: NavTab;
    label: string;
    icon: typeof Search;
    count?: number;
    highlightCount?: boolean;
  }[] = [
    { id: 'discover', label: 'Discover & Fetch', icon: Search },
    {
      id: 'downloads',
      label: 'Download Queue',
      icon: Download,
      count: activeDownloadsCount > 0 ? activeDownloadsCount : totalDownloadsCount,
      highlightCount: activeDownloadsCount > 0,
    },
    { id: 'library', label: 'Library & Player', icon: Library, count: libraryCount },
    { id: 'sync', label: 'Sync & Batch', icon: FolderSync },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-56'
      } shrink-0 border-r border-slate-200 dark:border-white/[0.08] bg-slate-50/90 dark:bg-[#14171C]/80 flex flex-col justify-between transition-[width] duration-150 select-none`}
    >
      <nav aria-label="Main workspace navigation" className="p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center ${
                collapsed ? 'justify-center px-0' : 'justify-between px-3'
              } h-10 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-600/12 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/[0.06]'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </span>
              {!collapsed && typeof item.count === 'number' && item.count > 0 && (
                <span
                  className={`text-xs font-mono tabular-nums ${
                    item.highlightCount
                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-3 border-t border-slate-200 dark:border-white/[0.08] space-y-1.5">
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Output</span>
            <span className="font-mono text-slate-500 dark:text-slate-400 uppercase tabular-nums">
              {settings.format} · {settings.bitrate}
            </span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Spotify</span>
            <span>{spotifyStatus.mode === 'official' ? 'Web API' : 'Free Mode'}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
