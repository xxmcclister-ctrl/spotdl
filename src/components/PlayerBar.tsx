import {
  Download,
  FileText,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatDuration } from '../shared/formatter';
import type { SpotdlTrack } from '../shared/types';
import { CoverArt } from './AppIcon';

export interface ActiveAudioTrack {
  id: string;
  track: SpotdlTrack;
  streamUrl: string;
  isPreview: boolean;
  libraryItemId?: string;
  hasLrc?: boolean;
}

interface PlayerBarProps {
  current: ActiveAudioTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onOpenLyrics: () => void;
}

export function PlayerBar({
  current,
  isPlaying,
  currentTime,
  duration,
  volume,
  muted,
  hasPrev,
  hasNext,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onOpenLyrics,
}: PlayerBarProps) {
  if (!current) {
    return null;
  }

  const effectiveDuration = duration > 0 ? duration : current.track.duration || 30;

  return (
    <footer className="h-[70px] shrink-0 border-t border-slate-200 dark:border-white/[0.08] bg-white/95 dark:bg-[#14171C]/95 backdrop-blur-md px-4 flex items-center justify-between gap-6">
      {/* Left: Track Info */}
      <div className="flex items-center gap-3 w-72 min-w-0 shrink-0">
        <CoverArt
          src={current.track.cover_url}
          alt={`${current.track.name} cover`}
          className="w-11 h-11"
        />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate">
            {current.track.name}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
            <span>{current.track.artists.join(', ')}</span>
            {current.isPreview && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-600 dark:text-amber-400">30s preview</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Center: Playback Controls & Scrubber */}
      <div className="flex-1 max-w-xl flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            aria-label="Previous track"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? `Pause ${current.track.name}` : `Play ${current.track.name}`}
            className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            aria-label="Next track"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="w-full flex items-center gap-2.5">
          <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 w-10 text-right">
            {formatDuration(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={effectiveDuration}
            step={0.25}
            value={Math.min(currentTime, effectiveDuration)}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Seek audio position"
            className="flex-1 h-1 accent-emerald-600 dark:accent-emerald-500 cursor-pointer"
          />
          <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 w-10">
            {formatDuration(effectiveDuration)}
          </span>
        </div>
      </div>

      {/* Right: Volume, Lyrics & Save File */}
      <div className="flex items-center gap-2 w-60 justify-end shrink-0">
        {current.libraryItemId && (
          <>
            <button
              type="button"
              onClick={onOpenLyrics}
              aria-label="Open synced lyrics and tag inspector"
              className="px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.07] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Lyrics</span>
            </button>

            <a
              href={`/api/files/${current.libraryItemId}/download`}
              aria-label={`Save ${current.track.name} file`}
              className="p-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-colors"
              title="Save audio file"
            >
              <Download className="w-4 h-4" />
            </a>
          </>
        )}

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-colors"
        >
          {muted || volume === 0 ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={muted ? 0 : volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          aria-label="Playback volume"
          className="w-20 h-1 accent-emerald-600 dark:accent-emerald-500 cursor-pointer"
        />
      </div>
    </footer>
  );
}
