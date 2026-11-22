import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_DOWNLOADER_SETTINGS,
  type AudioFormat,
  type DownloaderSettings,
  type DownloadJob,
  type LibraryItem,
  type SearchResponse,
  type SpotifyCredentialStatus,
  type SpotdlTrack,
} from './shared/types';
import {
  DESKTOP_WALLPAPER_ASSET,
  SpotdlAppTile,
  SpotdlMark,
} from './components/AppIcon';
import { DiscoverView } from './components/DiscoverView';
import { DownloadsView } from './components/DownloadsView';
import { LibraryView } from './components/LibraryView';
import { PlayerBar, type ActiveAudioTrack } from './components/PlayerBar';
import { SettingsView } from './components/SettingsView';
import { Sidebar, type NavTab } from './components/Sidebar';
import { SyncBatchView } from './components/SyncBatchView';
import { TitleBar } from './components/TitleBar';

type WindowState = 'maximized' | 'windowed' | 'minimized' | 'closed';

const TAB_LABELS: Record<NavTab, string> = {
  discover: 'Discover & Fetch',
  downloads: 'Download Queue',
  library: 'Library & Player',
  sync: 'Sync & Batch',
  settings: 'Settings',
};

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('spotdl_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  const [windowState, setWindowState] = useState<WindowState>('maximized');
  const [lastOpenState, setLastOpenState] = useState<'maximized' | 'windowed'>('maximized');
  const [windowOffset, setWindowOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );

  const [activeTab, setActiveTab] = useState<NavTab>('discover');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Data state
  const [settings, setSettings] = useState<DownloaderSettings>(DEFAULT_DOWNLOADER_SETTINGS);
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyCredentialStatus>({
    configured: false,
    mode: 'free',
  });
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);

  // Discover state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);

  // Library inspector
  const [inspectorId, setInspectorId] = useState<string | null>(null);
  const [inspectorMode, setInspectorMode] = useState<'tags' | 'lyrics'>('tags');

  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeAudio, setActiveAudio] = useState<ActiveAudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);

  // Sync HTML dark class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('spotdl_theme', theme);
  }, [theme]);

  // Initial settings + SSE subscription
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data?.settings) setSettings(data.settings);
        if (data?.spotify) setSpotifyStatus(data.spotify);
      })
      .catch(() => {});

    const es = new EventSource('/api/events');
    es.addEventListener('init', (ev) => {
      const payload = JSON.parse((ev as MessageEvent).data);
      if (Array.isArray(payload.jobs)) setJobs(payload.jobs);
      if (Array.isArray(payload.library)) setLibrary(payload.library);
      if (payload.settings) setSettings(payload.settings);
    });
    es.addEventListener('jobs', (ev) => {
      setJobs(JSON.parse((ev as MessageEvent).data));
    });
    es.addEventListener('job_update', (ev) => {
      const updated = JSON.parse((ev as MessageEvent).data) as DownloadJob;
      setJobs((prev) => {
        const exists = prev.some((j) => j.id === updated.id);
        if (!exists) return [updated, ...prev];
        return prev.map((j) => (j.id === updated.id ? updated : j));
      });
    });
    es.addEventListener('library', (ev) => {
      setLibrary(JSON.parse((ev as MessageEvent).data));
    });
    es.addEventListener('settings', (ev) => {
      setSettings(JSON.parse((ev as MessageEvent).data));
    });

    return () => es.close();
  }, []);

  // Window drag listeners for restored windowed mode
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setWindowOffset({
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (windowState !== 'windowed') return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: windowOffset.x,
      origY: windowOffset.y,
    };
  };

  // Audio Element lifecycle
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const playSource = useCallback((next: ActiveAudioTrack) => {
    setActiveAudio(next);
    setCurrentTime(0);
    setTimeout(() => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.src = next.streamUrl;
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }, 10);
  }, []);

  const handleTogglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !activeAudio) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const activeLibraryIdx = useMemo(
    () => (activeAudio?.libraryItemId ? library.findIndex((i) => i.id === activeAudio.libraryItemId) : -1),
    [activeAudio, library]
  );

  const playLibraryItem = useCallback(
    (item: LibraryItem) => {
      playSource({
        id: item.id,
        track: item.track,
        streamUrl: `/api/files/${item.id}/stream`,
        isPreview: false,
        libraryItemId: item.id,
        hasLrc: item.hasLrc,
      });
    },
    [playSource]
  );

  const handlePrevTrack = () => {
    if (activeLibraryIdx > 0) playLibraryItem(library[activeLibraryIdx - 1]);
  };

  const handleNextTrack = () => {
    if (activeLibraryIdx !== -1 && activeLibraryIdx < library.length - 1) {
      playLibraryItem(library[activeLibraryIdx + 1]);
    }
  };

  // Search handler
  const handleSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? searchQuery).trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to search.');
      setSearchResults(data);
    } catch (err: any) {
      setSearchError(err?.message || 'Unable to resolve query.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Queue handlers
  const handleEnqueueTracks = async (tracks: SpotdlTrack[], formatOverride?: AudioFormat) => {
    const res = await fetch('/api/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tracks,
        settings: formatOverride ? { format: formatOverride } : undefined,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.jobs)) {
        setJobs((prev) => [...data.jobs, ...prev.filter((p) => !data.jobs.some((n: DownloadJob) => n.id === p.id))]);
      }
      if (tracks.length > 1) {
        setActiveTab('downloads');
      }
    }
  };

  const handleBatchResolveAndQueue = async (lines: string[]) => {
    const collected: SpotdlTrack[] = [];
    const errors: string[] = [];
    for (const line of lines) {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(line)}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.tracks) && data.tracks.length > 0) {
          // If it's a Spotify URL (album/playlist/track), take all tracks; if text search, take top match
          if (data.queryType === 'search') {
            collected.push(data.tracks[0]);
          } else {
            collected.push(...data.tracks);
          }
        } else {
          errors.push(line);
        }
      } catch {
        errors.push(line);
      }
    }
    if (collected.length > 0) {
      await handleEnqueueTracks(collected);
    }
    return { queued: collected.length, errors };
  };

  const handleRetryJob = async (id: string) => {
    await fetch(`/api/downloads/${id}/retry`, { method: 'POST' });
  };

  const handleRemoveJob = async (id: string) => {
    await fetch(`/api/downloads/${id}`, { method: 'DELETE' });
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const handleClearCompleted = async () => {
    const res = await fetch('/api/downloads/clear-completed', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setJobs(data.jobs);
    }
  };

  const handleDeleteLibraryItem = async (id: string) => {
    await fetch(`/api/library/${id}`, { method: 'DELETE' });
    setLibrary((prev) => prev.filter((i) => i.id !== id));
    if (inspectorId === id) setInspectorId(null);
  };

  const handleSaveMetadata = async (
    id: string,
    patch: {
      name: string;
      artists: string[];
      album_name: string;
      album_artist: string;
      year: number;
      track_number: number;
      genres: string[];
    }
  ) => {
    const res = await fetch(`/api/library/${id}/metadata`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update tags.');
    setLibrary((prev) => prev.map((i) => (i.id === id ? data.item : i)));
  };

  const handleExportM3u = async (ids: string[], name = 'spotdl-playlist') => {
    const res = await fetch('/api/export/m3u', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, name }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.m3u8`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportZip = async (ids: string[]) => {
    const res = await fetch('/api/export/zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, includeM3u: true }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spotdl-bundle.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveSettings = async (next: DownloaderSettings) => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
    }
  };

  const handleSaveSpotifyCreds = async (clientId: string, clientSecret: string) => {
    const res = await fetch('/api/spotify/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to verify Spotify credentials.');
    setSpotifyStatus(data);
  };

  const activeDownloadsCount = useMemo(
    () =>
      jobs.filter(
        (j) =>
          j.status === 'queued' ||
          j.status === 'searching' ||
          j.status === 'downloading' ||
          j.status === 'converting' ||
          j.status === 'tagging'
      ).length,
    [jobs]
  );

  const toggleMaximize = () => {
    if (windowState === 'maximized') {
      setWindowState('windowed');
      setLastOpenState('windowed');
      setWindowOffset({ x: 0, y: 0 });
    } else {
      setWindowState('maximized');
      setLastOpenState('maximized');
      setWindowOffset({ x: 0, y: 0 });
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0B0D11] flex items-center justify-center">
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => {
          setIsPlaying(false);
          handleNextTrack();
        }}
      />

      {/* Windows 11 Desktop Wallpaper Backdrop (visible when Windowed, Minimized, or Closed) */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${DESKTOP_WALLPAPER_ASSET})` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-black/25" aria-hidden="true" />

      {/* Desktop Shortcut when Minimized or Closed */}
      {(windowState === 'minimized' || windowState === 'closed') && (
        <div className="relative z-10 flex flex-col items-center justify-center gap-6 p-8 text-center">
          <button
            type="button"
            onClick={() => setWindowState(lastOpenState)}
            className="group flex flex-col items-center gap-2.5 p-4 rounded-2xl hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <SpotdlAppTile className="w-20 h-20 transition-transform group-hover:scale-105" />
            <span className="text-sm font-medium text-white drop-shadow">spotDL Studio</span>
            <span className="text-xs text-slate-300">
              {windowState === 'minimized' ? 'Click to restore window' : 'Click to launch application'}
            </span>
          </button>
        </div>
      )}

      {/* Windows 11 Taskbar at bottom when Minimized or Closed */}
      {(windowState === 'minimized' || windowState === 'closed') && (
        <div className="absolute bottom-0 inset-x-0 h-12 bg-[#111419]/85 backdrop-blur-xl border-t border-white/10 flex items-center justify-center px-4 z-20">
          <button
            type="button"
            onClick={() => setWindowState(lastOpenState)}
            className={`h-9 px-3 rounded-lg flex items-center gap-2 transition-colors ${
              windowState === 'minimized'
                ? 'bg-white/10 border border-white/15 text-white'
                : 'hover:bg-white/10 text-slate-200'
            }`}
          >
            <SpotdlMark className="w-5 h-5" />
            <span className="text-xs font-medium">spotDL Studio</span>
            {activeDownloadsCount > 0 && (
              <span className="text-xs font-mono tabular-nums text-emerald-400">
                ({activeDownloadsCount})
              </span>
            )}
          </button>
        </div>
      )}

      {/* Main Windows 11 Application Window */}
      {(windowState === 'maximized' || windowState === 'windowed') && (
        <div
          style={
            windowState === 'windowed'
              ? {
                  transform: `translate(${windowOffset.x}px, ${windowOffset.y}px)`,
                }
              : undefined
          }
          className={`relative z-10 flex flex-col overflow-hidden bg-white dark:bg-[#111419] text-slate-900 dark:text-slate-100 transition-[border-radius] duration-150 ${
            windowState === 'maximized'
              ? 'w-full h-full rounded-none'
              : 'w-[92vw] max-w-[1360px] h-[88vh] rounded-xl border border-slate-300/70 dark:border-white/[0.12] shadow-2xl shadow-black/60'
          }`}
        >
          <TitleBar
            activeLabel={TAB_LABELS[activeTab]}
            activeDownloadsCount={activeDownloadsCount}
            isMaximized={windowState === 'maximized'}
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
            onMinimize={() => {
              setLastOpenState(windowState);
              setWindowState('minimized');
            }}
            onToggleMaximize={toggleMaximize}
            onClose={() => {
              setLastOpenState(windowState);
              setWindowState('closed');
            }}
            onDragStart={handleDragStart}
          />

          <div className="flex-1 flex overflow-hidden min-h-0">
            <Sidebar
              activeTab={activeTab}
              collapsed={sidebarCollapsed}
              activeDownloadsCount={activeDownloadsCount}
              totalDownloadsCount={jobs.length}
              libraryCount={library.length}
              settings={settings}
              spotifyStatus={spotifyStatus}
              onSelectTab={setActiveTab}
            />

            <main className="flex-1 min-w-0 overflow-hidden bg-slate-50/50 dark:bg-[#111419]">
              {activeTab === 'discover' && (
                <DiscoverView
                  query={searchQuery}
                  onQueryChange={setSearchQuery}
                  loading={searchLoading}
                  error={searchError}
                  results={searchResults}
                  jobs={jobs}
                  defaultFormat={settings.format}
                  onSearch={handleSearch}
                  onEnqueueTracks={handleEnqueueTracks}
                  onPreviewTrack={(track) => {
                    if (!track.preview_url) return;
                    playSource({
                      id: `preview_${track.song_id}`,
                      track,
                      streamUrl: track.preview_url,
                      isPreview: true,
                    });
                  }}
                />
              )}

              {activeTab === 'downloads' && (
                <DownloadsView
                  jobs={jobs}
                  onRetry={handleRetryJob}
                  onRemove={handleRemoveJob}
                  onClearCompleted={handleClearCompleted}
                  onPlayJob={(job) => {
                    const libMatch = library.find((l) => l.id === job.id || l.fileName === job.fileName);
                    if (libMatch) {
                      playLibraryItem(libMatch);
                    }
                  }}
                  onExportZip={handleExportZip}
                  onGoDiscover={() => setActiveTab('discover')}
                />
              )}

              {activeTab === 'library' && (
                <LibraryView
                  items={library}
                  activeTrackId={activeAudio?.libraryItemId}
                  currentTimeSec={currentTime}
                  selectedInspectorId={inspectorId}
                  inspectorMode={inspectorMode}
                  onSelectInspector={(id, mode) => {
                    setInspectorId(id);
                    if (mode) setInspectorMode(mode);
                  }}
                  onPlayItem={playLibraryItem}
                  onSeekToSec={handleSeek}
                  onDeleteItem={handleDeleteLibraryItem}
                  onSaveMetadata={handleSaveMetadata}
                  onExportM3u={(ids) => handleExportM3u(ids)}
                  onExportZip={handleExportZip}
                  onGoDiscover={() => setActiveTab('discover')}
                />
              )}

              {activeTab === 'sync' && (
                <SyncBatchView
                  library={library}
                  settings={settings}
                  onBatchResolveAndQueue={handleBatchResolveAndQueue}
                  onEnqueueTracks={(tracks) => handleEnqueueTracks(tracks)}
                  onExportM3u={handleExportM3u}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  settings={settings}
                  spotifyStatus={spotifyStatus}
                  onSaveSettings={handleSaveSettings}
                  onSaveSpotifyCreds={handleSaveSpotifyCreds}
                />
              )}
            </main>
          </div>

          <PlayerBar
            current={activeAudio}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            muted={muted}
            hasPrev={activeLibraryIdx > 0}
            hasNext={activeLibraryIdx !== -1 && activeLibraryIdx < library.length - 1}
            onTogglePlay={handleTogglePlay}
            onPrev={handlePrevTrack}
            onNext={handleNextTrack}
            onSeek={handleSeek}
            onVolumeChange={(v) => {
              setMuted(false);
              setVolume(v);
            }}
            onToggleMute={() => setMuted((m) => !m)}
            onOpenLyrics={() => {
              if (activeAudio?.libraryItemId) {
                setActiveTab('library');
                setInspectorId(activeAudio.libraryItemId);
                setInspectorMode('lyrics');
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
