import {
  Archive,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Play,
  RotateCcw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatBytes } from '../shared/formatter';
import type { DownloadJob } from '../shared/types';
import { CoverArt } from './AppIcon';

interface DownloadsViewProps {
  jobs: DownloadJob[];
  onRetry: (jobId: string) => void;
  onRemove: (jobId: string) => void;
  onClearCompleted: () => void;
  onPlayJob: (job: DownloadJob) => void;
  onExportZip: (ids: string[]) => void;
  onGoDiscover: () => void;
}

type QueueFilter = 'all' | 'active' | 'completed' | 'error';

export function DownloadsView({
  jobs,
  onRetry,
  onRemove,
  onClearCompleted,
  onPlayJob,
  onExportZip,
  onGoDiscover,
}: DownloadsViewProps) {
  const [filter, setFilter] = useState<QueueFilter>('all');

  const counts = useMemo(() => {
    let active = 0;
    let completed = 0;
    let error = 0;
    for (const j of jobs) {
      if (j.status === 'completed') completed++;
      else if (j.status === 'error' || j.status === 'skipped') error++;
      else active++;
    }
    return { all: jobs.length, active, completed, error };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    if (filter === 'all') return jobs;
    if (filter === 'active') {
      return jobs.filter(
        (j) =>
          j.status !== 'completed' &&
          j.status !== 'error' &&
          j.status !== 'skipped'
      );
    }
    if (filter === 'completed') {
      return jobs.filter((j) => j.status === 'completed');
    }
    return jobs.filter((j) => j.status === 'error' || j.status === 'skipped');
  }, [jobs, filter]);

  const completedIds = useMemo(
    () => jobs.filter((j) => j.status === 'completed').map((j) => j.id),
    [jobs]
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header & Filter Bar */}
      <div className="p-6 pb-4 border-b border-slate-200 dark:border-white/[0.08] shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Download Queue
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 tabular-nums">
            {counts.active} active · {counts.completed} completed · {counts.error} attention
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/[0.05] rounded-lg border border-slate-200 dark:border-white/[0.08]">
            {(
              [
                ['all', `All (${counts.all})`],
                ['active', `Active (${counts.active})`],
                ['completed', `Completed (${counts.completed})`],
                ['error', `Errors (${counts.error})`],
              ] as [QueueFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  filter === key
                    ? 'bg-white dark:bg-[#232832] text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {completedIds.length > 0 && (
            <button
              type="button"
              onClick={() => onExportZip(completedIds)}
              className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Download ZIP</span>
            </button>
          )}

          {counts.completed + counts.error > 0 && (
            <button
              type="button"
              onClick={onClearCompleted}
              className="h-8 px-3 rounded-lg border border-slate-300 dark:border-white/[0.12] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              Clear Finished
            </button>
          )}
        </div>
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredJobs.length === 0 ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {jobs.length === 0 ? 'Your download queue is empty' : 'No jobs match this filter'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
              {jobs.length === 0
                ? 'Search for a track or paste a Spotify playlist link in Discover to start downloading audio.'
                : 'Switch filter tabs above to view other queue items.'}
            </p>
            {jobs.length === 0 && (
              <button
                type="button"
                onClick={onGoDiscover}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
              >
                Go to Discover
              </button>
            )}
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-white/[0.08] rounded-lg divide-y divide-slate-200/70 dark:divide-white/[0.06] bg-white dark:bg-[#161920]">
            {filteredJobs.map((job) => {
              const isWorking =
                job.status === 'queued' ||
                job.status === 'searching' ||
                job.status === 'downloading' ||
                job.status === 'converting' ||
                job.status === 'tagging';

              return (
                <div
                  key={job.id}
                  className="p-3.5 space-y-2 hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0 flex-1 basis-72">
                      <CoverArt
                        src={job.track.cover_url}
                        alt={`${job.track.name} cover`}
                        className="w-11 h-11"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                            {job.track.name}
                          </span>
                          <span className="text-xs font-mono uppercase text-slate-500 dark:text-slate-400 shrink-0">
                            {job.format} · {job.bitrate}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1.5">
                          <span className="truncate">{job.track.artists.join(', ')}</span>
                          {job.matchedProvider && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="shrink-0">
                                {job.matchedProvider === 'youtube-music'
                                  ? 'YTM'
                                  : job.matchedProvider === 'soundcloud'
                                  ? 'SoundCloud'
                                  : 'YouTube'}
                                {typeof job.matchScore === 'number' ? ` ${job.matchScore}%` : ''}
                              </span>
                            </>
                          )}
                          {job.fileSize ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums shrink-0">
                                {formatBytes(job.fileSize)}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Status & Progress */}
                    <div className="w-64 shrink-0 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`flex items-center gap-1.5 font-medium truncate ${
                            job.status === 'completed'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : job.status === 'error'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {job.status === 'completed' && (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          )}
                          {job.status === 'error' && <XCircle className="w-3.5 h-3.5 shrink-0" />}
                          {isWorking && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
                          <span className="truncate">
                            {job.status === 'error' ? 'Failed' : job.stageLabel}
                          </span>
                        </span>
                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                          {job.progress}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-[width] duration-200 ${
                            job.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {job.status === 'completed' && (
                        <>
                          <button
                            type="button"
                            onClick={() => onPlayJob(job)}
                            aria-label={`Play ${job.track.name}`}
                            title="Play track"
                            className="p-2 rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-white/[0.08] transition-colors"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          <a
                            href={`/api/files/${job.id}/download`}
                            aria-label={`Save ${job.track.name} to disk`}
                            title="Save audio file"
                            className="px-2.5 py-1.5 rounded-md bg-emerald-600/12 dark:bg-emerald-500/15 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </a>
                          {job.hasLrc && (
                            <a
                              href={`/api/files/${job.id}/lrc`}
                              aria-label={`Download LRC lyrics for ${job.track.name}`}
                              title="Download .lrc lyrics"
                              className="p-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-white/[0.08] transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                            </a>
                          )}
                        </>
                      )}

                      {(job.status === 'error' || job.status === 'skipped') && (
                        <button
                          type="button"
                          onClick={() => onRetry(job.id)}
                          aria-label={`Retry ${job.track.name}`}
                          className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 dark:hover:bg-white/[0.14] text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onRemove(job.id)}
                        aria-label={`Remove ${job.track.name} from queue`}
                        title="Remove from queue"
                        className="p-2 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {job.status === 'error' && job.error && (
                    <div className="text-xs text-red-600 dark:text-red-400 pl-14 pr-2">
                      {job.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
