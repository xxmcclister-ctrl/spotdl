import {
  Check,
  Download,
  ExternalLink,
  Loader2,
  Play,
  Search,
  Sparkles,
} from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { createSpotdlSaveFile, formatDuration } from '../shared/formatter';
import type {
  AudioFormat,
  DownloadJob,
  SearchResponse,
  SpotdlTrack,
} from '../shared/types';
import { CoverArt, SpotdlAppTile } from './AppIcon';

interface DiscoverViewProps {
  query: string;
  onQueryChange: (q: string) => void;
  loading: boolean;
  error: string | null;
  results: SearchResponse | null;
  jobs: DownloadJob[];
  defaultFormat: AudioFormat;
  onSearch: (q?: string) => void;
  onEnqueueTracks: (tracks: SpotdlTrack[], formatOverride?: AudioFormat) => void;
  onPreviewTrack: (track: SpotdlTrack) => void;
}

const QUICK_EXAMPLES: { label: string; value: string }[] = [
  {
    label: 'Spotify Track',
    value: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
  },
  {
    label: 'Spotify Album',
    value: 'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3',
  },
  {
    label: 'Spotify Playlist',
    value: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
  },
  {
    label: 'Artist Search',
    value: 'Daft Punk - Get Lucky',
  },
];

export function DiscoverView({
  query,
  onQueryChange,
  loading,
  error,
  results,
  jobs,
  defaultFormat,
  onSearch,
  onEnqueueTracks,
  onPreviewTrack,
}: DiscoverViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quickFormat, setQuickFormat] = useState<AudioFormat>(defaultFormat);

  const tracks = results?.tracks ?? [];

  const queuedTrackIds = useMemo(() => {
    const map = new Map<string, DownloadJob>();
    for (const j of jobs) {
      map.set(j.track.song_id, j);
    }
    return map;
  }, [jobs]);

  const allSelected =
    tracks.length > 0 && tracks.every((t) => selectedIds.has(t.song_id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tracks.map((t) => t.song_id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedIds(new Set());
    onSearch();
  };

  const handleExportSpotdl = () => {
    if (tracks.length === 0) return;
    const blob = new Blob([createSpotdlSaveFile(tracks)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(results?.collectionName || 'tracks').replace(/[^a-zA-Z0-9_-]/g, '_')}.spotdl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedTracks = tracks.filter((t) => selectedIds.has(t.song_id));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Search & URL Bar */}
      <div className="p-6 pb-4 border-b border-slate-200 dark:border-white/[0.08] shrink-0 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Discover & Fetch Audio
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Paste a Spotify track, album, playlist, artist link, YouTube URL, or search by song name.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Paste Spotify URL or search song, artist, album..."
              aria-label="Spotify URL or search query"
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-white dark:bg-[#1B1F26] border border-slate-300 dark:border-white/[0.12] text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Resolving...</span>
              </>
            ) : (
              <span>Fetch Tracks</span>
            )}
          </button>
        </form>

        {/* Quick Example Presets */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Examples:</span>
          {QUICK_EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => {
                onQueryChange(ex.value);
                setSelectedIds(new Set());
                onSearch(ex.value);
              }}
              className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-300 transition-colors whitespace-nowrap shrink-0"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            className="px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-700 dark:text-red-300 text-sm"
          >
            {error}
          </div>
        )}
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-6 pt-4">
        {loading ? (
          <div className="space-y-2" aria-label="Loading tracks">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-lg bg-slate-100 dark:bg-white/[0.04] animate-pulse border border-slate-200/70 dark:border-white/[0.06]"
              />
            ))}
          </div>
        ) : !results ? (
          <div className="h-full min-h-[340px] flex flex-col items-center justify-center text-center max-w-lg mx-auto py-10">
            <SpotdlAppTile className="w-20 h-20 mb-5" />
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              Ready to Fetch Spotify & YouTube Audio
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
              Enter any Spotify track, album, playlist, or artist URL above, or search directly by track name. Audio is matched automatically, transcoded with FFmpeg, tagged with album art, and paired with synced LRC lyrics.
            </p>
          </div>
        ) : tracks.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              No matching tracks were returned for that query.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Try a direct public Spotify link or include both artist and song title.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Collection Header + Batch Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-white/[0.08]">
              <div className="flex items-center gap-3.5 min-w-0">
                <CoverArt
                  src={results.collectionCover}
                  alt={results.collectionName || 'Collection cover'}
                  className="w-12 h-12"
                />
                <div className="min-w-0">
                  <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {results.collectionName || 'Search Results'}
                  </h2>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                    <span>{results.collectionSubtitle}</span>
                    <span aria-hidden="true">·</span>
                    <span>{results.sourceLabel}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <label className="sr-only" htmlFor="quick-format-select">
                  Download format
                </label>
                <select
                  id="quick-format-select"
                  value={quickFormat}
                  onChange={(e) => setQuickFormat(e.target.value as AudioFormat)}
                  className="h-9 px-2.5 rounded-lg bg-white dark:bg-[#1B1F26] border border-slate-300 dark:border-white/[0.12] text-xs font-mono uppercase text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="mp3">MP3</option>
                  <option value="flac">FLAC</option>
                  <option value="m4a">M4A</option>
                  <option value="opus">OPUS</option>
                  <option value="ogg">OGG</option>
                  <option value="wav">WAV</option>
                </select>

                <button
                  type="button"
                  onClick={handleExportSpotdl}
                  className="h-9 px-3 rounded-lg border border-slate-300 dark:border-white/[0.12] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
                >
                  Export .spotdl
                </button>

                {selectedTracks.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => onEnqueueTracks(selectedTracks, quickFormat)}
                    className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 tabular-nums"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Selected ({selectedTracks.length})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onEnqueueTracks(tracks, quickFormat)}
                    className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 tabular-nums"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download All ({tracks.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* High-Density Win11 Track Table */}
            <div className="border border-slate-200 dark:border-white/[0.08] rounded-lg overflow-hidden bg-white dark:bg-[#161920]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-xs font-medium text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 pl-3 pr-2 w-9">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all tracks"
                        className="rounded border-slate-400 accent-emerald-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-2 w-10 text-right tabular-nums">#</th>
                    <th className="py-2.5 px-3">Title & Artist</th>
                    <th className="py-2.5 px-3 hidden md:table-cell">Album</th>
                    <th className="py-2.5 px-3 w-16 text-right tabular-nums hidden sm:table-cell">
                      Year
                    </th>
                    <th className="py-2.5 px-3 w-20 text-right tabular-nums">Duration</th>
                    <th className="py-2.5 pl-3 pr-4 w-36 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.06] text-[13px]">
                  {tracks.map((track, idx) => {
                    const job = queuedTrackIds.get(track.song_id);
                    const isSelected = selectedIds.has(track.song_id);

                    return (
                      <tr
                        key={`${track.song_id}_${idx}`}
                        className={`hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors ${
                          isSelected ? 'bg-emerald-500/[0.06]' : ''
                        }`}
                      >
                        <td className="py-2 pl-3 pr-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(track.song_id)}
                            aria-label={`Select ${track.name}`}
                            className="rounded border-slate-400 accent-emerald-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-xs text-slate-400 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <CoverArt
                              src={track.cover_url}
                              alt={`${track.name} cover`}
                              className="w-9 h-9"
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                                <span className="truncate">{track.name}</span>
                                {track.explicit && (
                                  <span
                                    className="text-[10px] font-mono text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-white/20 px-1 rounded leading-tight shrink-0"
                                    title="Explicit"
                                  >
                                    E
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {track.artists.join(', ')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400 truncate max-w-[200px] hidden md:table-cell">
                          {track.album_name}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums hidden sm:table-cell">
                          {track.year || '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {track.duration > 0 ? formatDuration(track.duration) : '—'}
                        </td>
                        <td className="py-2 pl-3 pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {track.preview_url && (
                              <button
                                type="button"
                                onClick={() => onPreviewTrack(track)}
                                aria-label={`Preview ${track.name}`}
                                title="Play 30s preview"
                                className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-white/[0.08] transition-colors"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {track.url && (
                              <a
                                href={track.url}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Open ${track.name} source link`}
                                title="Open source URL"
                                className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-white/[0.08] transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}

                            {job && job.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 px-2 py-1 whitespace-nowrap">
                                <Check className="w-3.5 h-3.5" />
                                Saved
                              </span>
                            ) : job &&
                              job.status !== 'error' &&
                              job.status !== 'skipped' ? (
                              <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400 px-2 py-1 whitespace-nowrap">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {job.progress}%
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onEnqueueTracks([track], quickFormat)}
                                aria-label={`Download ${track.name}`}
                                className="px-2.5 py-1 rounded-md bg-emerald-600/12 dark:bg-emerald-500/15 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
