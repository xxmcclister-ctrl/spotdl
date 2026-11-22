import {
  Archive,
  Download,
  FileMusic,
  FileText,
  ListMusic,
  Play,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  createSpotdlSaveFile,
  formatBytes,
  formatDuration,
  parseLrcTimestamps,
} from '../shared/formatter';
import type { LibraryItem } from '../shared/types';
import { CoverArt } from './AppIcon';

interface LibraryViewProps {
  items: LibraryItem[];
  activeTrackId?: string;
  currentTimeSec: number;
  selectedInspectorId: string | null;
  inspectorMode: 'tags' | 'lyrics';
  onSelectInspector: (id: string | null, mode?: 'tags' | 'lyrics') => void;
  onPlayItem: (item: LibraryItem) => void;
  onSeekToSec: (sec: number) => void;
  onDeleteItem: (id: string) => void;
  onSaveMetadata: (
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
  ) => Promise<void>;
  onExportM3u: (ids: string[]) => void;
  onExportZip: (ids: string[]) => void;
  onGoDiscover: () => void;
}

export function LibraryView({
  items,
  activeTrackId,
  currentTimeSec,
  selectedInspectorId,
  inspectorMode,
  onSelectInspector,
  onPlayItem,
  onSeekToSec,
  onDeleteItem,
  onSaveMetadata,
  onExportM3u,
  onExportZip,
  onGoDiscover,
}: LibraryViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [savingTags, setSavingTags] = useState(false);
  const [tagStatusMsg, setTagStatusMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.track.name.toLowerCase().includes(q) ||
        i.track.artists.join(' ').toLowerCase().includes(q) ||
        i.track.album_name.toLowerCase().includes(q)
    );
  }, [items, searchTerm]);

  const inspectedItem = useMemo(
    () => items.find((i) => i.id === selectedInspectorId) || null,
    [items, selectedInspectorId]
  );

  const [formState, setFormState] = useState({
    name: '',
    artists: '',
    album_name: '',
    album_artist: '',
    year: 2024,
    track_number: 1,
    genres: '',
  });

  useEffect(() => {
    if (inspectedItem) {
      setFormState({
        name: inspectedItem.track.name,
        artists: inspectedItem.track.artists.join(', '),
        album_name: inspectedItem.track.album_name,
        album_artist: inspectedItem.track.album_artist,
        year: inspectedItem.track.year,
        track_number: inspectedItem.track.track_number,
        genres: inspectedItem.track.genres.join(', '),
      });
      setTagStatusMsg(null);
    }
  }, [inspectedItem]);

  const parsedLrc = useMemo(() => {
    if (!inspectedItem?.lrcContent) return [];
    return parseLrcTimestamps(inspectedItem.lrcContent);
  }, [inspectedItem]);

  const activeLrcIndex = useMemo(() => {
    if (!inspectedItem || activeTrackId !== inspectedItem.id || parsedLrc.length === 0) {
      return -1;
    }
    const ms = currentTimeSec * 1000;
    let idx = -1;
    for (let i = 0; i < parsedLrc.length; i++) {
      if (parsedLrc[i].timeMs <= ms + 250) idx = i;
      else break;
    }
    return idx;
  }, [inspectedItem, activeTrackId, parsedLrc, currentTimeSec]);

  const handleTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectedItem) return;
    setSavingTags(true);
    setTagStatusMsg(null);
    try {
      await onSaveMetadata(inspectedItem.id, {
        name: formState.name,
        artists: formState.artists
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        album_name: formState.album_name,
        album_artist: formState.album_artist,
        year: Number(formState.year) || new Date().getFullYear(),
        track_number: Number(formState.track_number) || 1,
        genres: formState.genres
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setTagStatusMsg('Audio file tags updated on disk.');
    } catch (err: any) {
      setTagStatusMsg(err?.message || 'Failed to update tags.');
    } finally {
      setSavingTags(false);
    }
  };

  const handleSaveSpotdl = () => {
    const blob = new Blob([createSpotdlSaveFile(filtered.map((i) => i.track))], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spotdl-library.spotdl';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header Toolbar */}
      <div className="p-6 pb-4 border-b border-slate-200 dark:border-white/[0.08] shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Library & Audio Player
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 tabular-nums">
            {items.length} downloaded track{items.length === 1 ? '' : 's'} ready for playback, tagging, and export
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter library..."
              aria-label="Filter downloaded library"
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-white dark:bg-[#1B1F26] border border-slate-300 dark:border-white/[0.12] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {filtered.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => onExportM3u(filtered.map((i) => i.id))}
                className="h-8 px-3 rounded-lg border border-slate-300 dark:border-white/[0.12] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>M3U8</span>
              </button>
              <button
                type="button"
                onClick={handleSaveSpotdl}
                className="h-8 px-3 rounded-lg border border-slate-300 dark:border-white/[0.12] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                .spotdl
              </button>
              <button
                type="button"
                onClick={() => onExportZip(filtered.map((i) => i.id))}
                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Export ZIP</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Split Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <FileMusic className="w-10 h-10 text-slate-400 mb-3" />
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                No downloaded tracks yet
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
                Downloaded songs appear here with embedded artwork, metadata inspection, and synced LRC lyrics.
              </p>
              <button
                type="button"
                onClick={onGoDiscover}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
              >
                Search & Download
              </button>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-white/[0.08] rounded-lg overflow-hidden bg-white dark:bg-[#161920]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-xs font-medium text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 pl-4 pr-3">Track</th>
                    <th className="py-2.5 px-3 hidden lg:table-cell">Album</th>
                    <th className="py-2.5 px-3 w-28">Format</th>
                    <th className="py-2.5 px-3 w-24 text-right tabular-nums hidden sm:table-cell">
                      Size
                    </th>
                    <th className="py-2.5 px-3 w-20 text-right tabular-nums">Time</th>
                    <th className="py-2.5 pl-3 pr-4 w-40 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.06] text-[13px]">
                  {filtered.map((item) => {
                    const isPlaying = activeTrackId === item.id;
                    const isInspected = selectedInspectorId === item.id;
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors ${
                          isInspected ? 'bg-emerald-500/[0.06]' : ''
                        }`}
                      >
                        <td className="py-2.5 pl-4 pr-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <CoverArt
                              src={item.track.cover_url}
                              alt={`${item.track.name} cover`}
                              className="w-9 h-9"
                            />
                            <div className="min-w-0">
                              <div
                                className={`font-medium truncate ${
                                  isPlaying
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-900 dark:text-slate-100'
                                }`}
                              >
                                {item.track.name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {item.track.artists.join(', ')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate max-w-[180px] hidden lg:table-cell">
                          {item.track.album_name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs uppercase text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          {item.format} · {item.bitrate}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums hidden sm:table-cell">
                          {formatBytes(item.fileSize)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {formatDuration(item.track.duration)}
                        </td>
                        <td className="py-2.5 pl-3 pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onPlayItem(item)}
                              aria-label={`Play ${item.track.name}`}
                              title="Play audio"
                              className="p-1.5 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onSelectInspector(item.id, 'tags')}
                              aria-label={`Inspect tags for ${item.track.name}`}
                              title="Edit ID3 tags & lyrics"
                              className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-white/[0.08] transition-colors"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onSelectInspector(item.id, 'lyrics')}
                              aria-label={`View lyrics for ${item.track.name}`}
                              title="Synced lyrics"
                              className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-white/[0.08] transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            <a
                              href={`/api/files/${item.id}/download`}
                              aria-label={`Download ${item.fileName}`}
                              title="Save file to computer"
                              className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-white/[0.08] transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>

                            <button
                              type="button"
                              onClick={() => onDeleteItem(item.id)}
                              aria-label={`Delete ${item.track.name}`}
                              title="Delete from disk"
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Inspector & Synced Lyrics Drawer */}
        {inspectedItem && (
          <aside className="w-80 xl:w-96 shrink-0 border-l border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#14171C]/80 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-white/[0.06] rounded-lg">
                <button
                  type="button"
                  onClick={() => onSelectInspector(inspectedItem.id, 'tags')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    inspectorMode === 'tags'
                      ? 'bg-white dark:bg-[#232832] text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Metadata Tags
                </button>
                <button
                  type="button"
                  onClick={() => onSelectInspector(inspectedItem.id, 'lyrics')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    inspectorMode === 'lyrics'
                      ? 'bg-white dark:bg-[#232832] text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Synced Lyrics
                </button>
              </div>
              <button
                type="button"
                onClick={() => onSelectInspector(null)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center gap-3">
                <CoverArt
                  src={inspectedItem.track.cover_url}
                  alt={`${inspectedItem.track.name} artwork`}
                  className="w-14 h-14"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {inspectedItem.track.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {inspectedItem.fileName}
                  </div>
                </div>
              </div>

              {inspectorMode === 'tags' ? (
                <form onSubmit={handleTagSubmit} className="space-y-3">
                  <div>
                    <label
                      htmlFor="tag-title"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                    >
                      Title
                    </label>
                    <input
                      id="tag-title"
                      type="text"
                      value={formState.name}
                      onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg bg-white dark:bg-[#1B1F26] border border-slate-300 dark:border-white/[0.12] text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="tag-artists"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                    >
                      Artists (comma separated)
                    </label>
                    <input
                      id="tag-artists"
                      type="text"
                      value={formState.artists}
                      onChange={(e) => setFormState({ ...formState, artists: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg bg-white dark:bg-[#1B1F26] border border-slate-300 dark:border-white/[0.12] text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="tag-album"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                    >
                      Album
                    </label>
                    <input
                      id="tag-album"
                      type="text"
                      value={formState.album_name}
                      onChange={(e) => setFormState({ ...formState, album_name: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg bg-white dark:bg-[#1B1F26] border border-slate-300 dark:border-white/[0.12] text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="tag-year"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                      >
                        Year
                      </label>
                      <input
                        id="tag-year"
                        type="number"
                        value={formState.year}
                        onChange={(e) =>
                          setFormState({ ...formState, year: Number(e.target.value) })
                        }
                        className="w-full h-9 px-3 rounded-lg bg-white dark:bg-[#1B1F26] border border-slate-300 dark:border-white/[0.12] text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="tag-track-num"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                      >
                        Track #
                      </label>
                      <input
                        id="tag-track-num"
                        type="number"
                        value={formState.track_number}
                        onChange={(e) =>
                          setFormState({ ...formState, track_number: Number(e.target.value) })
                        }
                        className="w-full h-9 px-3 rounded-lg bg-white dark:bg-[#1B1F26] border border-slate-300 dark:border-white/[0.12] text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="tag-genres"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                    >
                      Genres
                    </label>
                    <input
                      id="tag-genres"
                      type="text"
                      value={formState.genres}
                      onChange={(e) => setFormState({ ...formState, genres: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg bg-white dark:bg-[#1B1F26] border border-slate-300 dark:border-white/[0.12] text-xs text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  {tagStatusMsg && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      {tagStatusMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={savingTags}
                    className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingTags ? 'Writing Tags...' : 'Save Tags to File'}</span>
                  </button>
                </form>
              ) : (
                <div className="space-y-2">
                  {parsedLrc.length > 0 ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between pb-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Click any line to seek playback
                        </span>
                        <a
                          href={`/api/files/${inspectedItem.id}/lrc`}
                          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          Save .lrc
                        </a>
                      </div>
                      {parsedLrc.map((line, idx) => {
                        const isCurrent = idx === activeLrcIndex;
                        return (
                          <button
                            key={`${line.timeMs}_${idx}`}
                            type="button"
                            onClick={() => {
                              if (activeTrackId !== inspectedItem.id) {
                                onPlayItem(inspectedItem);
                              }
                              onSeekToSec(line.timeMs / 1000);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-start gap-2.5 ${
                              isCurrent
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/[0.06]'
                            }`}
                          >
                            <span className="font-mono text-[11px] tabular-nums text-slate-400 shrink-0 mt-0.5">
                              {formatDuration(line.timeMs / 1000)}
                            </span>
                            <span>{line.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : inspectedItem.lrcContent ? (
                    <pre className="text-xs whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                      {inspectedItem.lrcContent}
                    </pre>
                  ) : (
                    <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                      No lyrics were matched for this track.
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
