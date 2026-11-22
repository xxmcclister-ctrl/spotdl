import { Download, FolderSync, ListMusic, Loader2, Upload } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { createM3uContent, createSpotdlSaveFile } from '../shared/formatter';
import type { DownloaderSettings, LibraryItem, SpotdlTrack } from '../shared/types';

interface SyncBatchViewProps {
  library: LibraryItem[];
  settings: DownloaderSettings;
  onBatchResolveAndQueue: (lines: string[]) => Promise<{ queued: number; errors: string[] }>;
  onEnqueueTracks: (tracks: SpotdlTrack[]) => void;
  onExportM3u: (ids: string[], name: string) => void;
}

export function SyncBatchView({
  library,
  settings,
  onBatchResolveAndQueue,
  onEnqueueTracks,
  onExportM3u,
}: SyncBatchViewProps) {
  const [bulkText, setBulkText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);

  const [spotdlJson, setSpotdlJson] = useState('');
  const [syncResult, setSyncResult] = useState<{
    total: number;
    missing: SpotdlTrack[];
    present: SpotdlTrack[];
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [playlistName, setPlaylistName] = useState('my-playlist');

  const m3uPreview = useMemo(() => {
    if (library.length === 0) return '#EXTM3U\n# Add tracks to your Library to generate an M3U8 playlist';
    return createM3uContent(
      library.map((i) => i.track),
      settings.output,
      settings.format,
      settings.restrict
    );
  }, [library, settings]);

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    setBulkLoading(true);
    setBulkStatus(null);
    try {
      const res = await onBatchResolveAndQueue(lines);
      const errNote = res.errors.length > 0 ? ` (${res.errors.length} failed to resolve)` : '';
      setBulkStatus(`Queued ${res.queued} track${res.queued === 1 ? '' : 's'}${errNote}.`);
    } catch (err: any) {
      setBulkStatus(err?.message || 'Batch queue failed.');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setSpotdlJson(text);
    await runSyncDiff(text);
  };

  const runSyncDiff = async (rawText: string) => {
    setSyncError(null);
    setSyncResult(null);
    try {
      const parsed = JSON.parse(rawText);
      const res = await fetch('/api/sync/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse .spotdl file');
      setSyncResult(data);
    } catch (err: any) {
      setSyncError(err?.message || 'Invalid JSON in .spotdl file.');
    }
  };

  const handleDownloadLibrarySpotdl = () => {
    const content = createSpotdlSaveFile(library.map((i) => i.track));
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'library-backup.spotdl';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Sync & Batch Operations
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          Queue multiple Spotify/YouTube links at once, sync against `.spotdl` save files, and generate `.m3u8` playlists.
        </p>
      </div>

      {/* 1. Bulk URL / Track List */}
      <section className="p-5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#161920] space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Bulk Link & Query Queue
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter one Spotify URL, YouTube link, or Artist - Title per line.
            </p>
          </div>
        </div>

        <form onSubmit={handleBulkSubmit} className="space-y-3">
          <textarea
            rows={4}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT\nDaft Punk - Instant Crush\nCarly Rae Jepsen - Run Away With Me`}
            aria-label="Bulk track URLs or queries"
            className="w-full p-3 rounded-lg bg-slate-50 dark:bg-[#111419] border border-slate-300 dark:border-white/[0.12] font-mono text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {bulkStatus || ''}
            </span>
            <button
              type="submit"
              disabled={bulkLoading || !bulkText.trim()}
              className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              {bulkLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Resolving batch...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Resolve & Queue All</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* 2. .spotdl Sync Manager */}
      <section className="p-5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#161920] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              .spotdl Save File Sync
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Load a `.spotdl` JSON save file to compare missing tracks against your Library and sync only what is missing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="h-8 px-3 rounded-lg border border-slate-300 dark:border-white/[0.12] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Load .spotdl</span>
              <input
                type="file"
                accept=".spotdl,.json"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>

            {library.length > 0 && (
              <button
                type="button"
                onClick={handleDownloadLibrarySpotdl}
                className="h-8 px-3 rounded-lg border border-slate-300 dark:border-white/[0.12] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
              >
                Export Current Library (.spotdl)
              </button>
            )}
          </div>
        </div>

        <textarea
          rows={4}
          value={spotdlJson}
          onChange={(e) => setSpotdlJson(e.target.value)}
          placeholder='Paste .spotdl JSON array here or load a file above...'
          aria-label="spotdl JSON contents"
          className="w-full p-3 rounded-lg bg-slate-50 dark:bg-[#111419] border border-slate-300 dark:border-white/[0.12] font-mono text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />

        {syncError && (
          <div className="text-xs text-red-600 dark:text-red-400 font-medium">{syncError}</div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={!spotdlJson.trim()}
            onClick={() => runSyncDiff(spotdlJson)}
            className="h-9 px-4 rounded-lg border border-slate-300 dark:border-white/[0.12] hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-40 text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <FolderSync className="w-3.5 h-3.5" />
            <span>Compare with Library</span>
          </button>

          {syncResult && (
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                {syncResult.present.length} downloaded · {syncResult.missing.length} missing of {syncResult.total}
              </span>
              {syncResult.missing.length > 0 && (
                <button
                  type="button"
                  onClick={() => onEnqueueTracks(syncResult.missing)}
                  className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors tabular-nums"
                >
                  Sync {syncResult.missing.length} Missing Track{syncResult.missing.length === 1 ? '' : 's'}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 3. M3U8 Playlist Builder */}
      <section className="p-5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#161920] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              M3U8 Playlist Generator
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generate an `#EXTM3U` playlist file matching your current output filename template.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              aria-label="Playlist file name"
              className="h-8 px-3 rounded-lg bg-slate-50 dark:bg-[#111419] border border-slate-300 dark:border-white/[0.12] text-xs font-mono text-slate-900 dark:text-slate-100 w-44"
            />
            <button
              type="button"
              disabled={library.length === 0}
              onClick={() => onExportM3u(library.map((i) => i.id), playlistName)}
              className="h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Export .m3u8</span>
            </button>
          </div>
        </div>

        <pre className="p-3 rounded-lg bg-slate-50 dark:bg-[#111419] border border-slate-200 dark:border-white/[0.08] font-mono text-[11px] text-slate-600 dark:text-slate-400 overflow-x-auto max-h-40">
          {m3uPreview}
        </pre>
      </section>
    </div>
  );
}
