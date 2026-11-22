import { Copy, Menu, Minus, Moon, Square, Sun, X } from 'lucide-react';
import type React from 'react';
import { SpotdlMark } from './AppIcon';

interface TitleBarProps {
  activeLabel: string;
  activeDownloadsCount: number;
  isMaximized: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
  onDragStart: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function TitleBar({
  activeLabel,
  activeDownloadsCount,
  isMaximized,
  theme,
  onToggleTheme,
  onToggleSidebar,
  onMinimize,
  onToggleMaximize,
  onClose,
  onDragStart,
}: TitleBarProps) {
  return (
    <header
      onDoubleClick={onToggleMaximize}
      className="h-10 shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-white/[0.08] bg-slate-100/90 dark:bg-[#14171C]/95 backdrop-blur-md select-none"
    >
      {/* Left: Sidebar toggle + Custom App Icon + Window Title */}
      <div className="flex items-center gap-2 pl-2.5 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation sidebar"
          className="w-8 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-white/[0.07] transition-colors shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>

        <SpotdlMark className="w-5 h-5 shrink-0" />

        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display font-semibold text-[13px] tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
            spotDL Studio
          </span>
          <span className="text-slate-400 dark:text-slate-600 text-xs" aria-hidden="true">
            /
          </span>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
            {activeLabel}
          </span>
        </div>
      </div>

      {/* Center: Draggable window titlebar region */}
      <div
        onMouseDown={onDragStart}
        className="flex-1 h-full flex items-center justify-center cursor-default"
      >
        {activeDownloadsCount > 0 && (
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
            {activeDownloadsCount} active download{activeDownloadsCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Right: Theme Toggle + Native Windows 11 Caption Controls */}
      <div className="flex items-center h-full shrink-0">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="h-full px-3 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-white/[0.07] transition-colors"
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={onMinimize}
          aria-label="Minimize window"
          className="h-full w-11 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200/90 dark:hover:bg-white/[0.08] transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onToggleMaximize}
          aria-label={isMaximized ? 'Restore window size' : 'Maximize window'}
          className="h-full w-11 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200/90 dark:hover:bg-white/[0.08] transition-colors"
          title={isMaximized ? 'Restore Down' : 'Maximize'}
        >
          {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close window"
          className="h-full w-12 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-[#C42B1C] hover:text-white transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
