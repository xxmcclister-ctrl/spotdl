import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseFile } from 'music-metadata';
import ytSearch from 'yt-search';
import { formatSongFilename } from '../shared/formatter';
import { rankCandidates } from '../shared/matching';
import type {
  AudioCandidate,
  AudioFormat,
  DownloaderSettings,
  DownloadJob,
  LibraryItem,
  SpotdlTrack,
} from '../shared/types';
import { DATA_DIR, DOWNLOADS_DIR, store, TMP_DIR } from './store';

const execFileAsync = promisify(execFile);

export const YT_DLP_PATH = '/tmp/yt-dlp';
export const COOKIES_FILE_PATH = path.join(DATA_DIR, 'cookies.txt');
const FFMPEG_PATH = '/usr/bin/ffmpeg';

const FFMPEG_CODEC_ARGS: Record<AudioFormat, string[]> = {
  mp3: ['-codec:a', 'libmp3lame'],
  flac: ['-codec:a', 'flac', '-sample_fmt', 's16'],
  ogg: ['-codec:a', 'libvorbis'],
  opus: ['-codec:a', 'libopus'],
  m4a: ['-codec:a', 'aac'],
  wav: ['-codec:a', 'pcm_s16le'],
};

let ensureYtDlpPromise: Promise<string> | null = null;

export async function ensureYtDlp(): Promise<string> {
  if (fs.existsSync(YT_DLP_PATH)) {
    return YT_DLP_PATH;
  }
  if (!ensureYtDlpPromise) {
    ensureYtDlpPromise = (async () => {
      const res = await fetch('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp');
      if (!res.ok) {
        throw new Error(`Failed to bootstrap yt-dlp (${res.status})`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(YT_DLP_PATH, buffer);
      fs.chmodSync(YT_DLP_PATH, 0o755);
      return YT_DLP_PATH;
    })();
  }
  return ensureYtDlpPromise;
}

async function searchYtmCandidates(track: SpotdlTrack): Promise<AudioCandidate[]> {
  const query = `${track.artists.join(' ')} ${track.name}`.trim();
  try {
    const res = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          client: { clientName: 'WEB_REMIX', clientVersion: '1.20240101.01.00' },
        },
        query,
        params: 'EgWKAQIIAWoMEAMQBBAJEAoQBRAV',
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const sections =
      data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer
        ?.contents || [];

    const candidates: AudioCandidate[] = [];
    for (const section of sections) {
      const shelfItems = section?.musicShelfRenderer?.contents || [];
      for (const entry of shelfItems) {
        const item = entry?.musicResponsiveListItemRenderer;
        const videoId =
          item?.playlistItemData?.videoId ||
          item?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
            ?.playNavigationEndpoint?.watchEndpoint?.videoId;
        if (!videoId) continue;

        const flexCols = item?.flexColumns || [];
        const title = (flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [])
          .map((r: any) => r.text)
          .join('')
          .trim();
        const subText = (flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [])
          .map((r: any) => r.text)
          .join('')
          .trim();

        const parts = subText.split('•').map((s: string) => s.trim());
        const durStr = parts[parts.length - 1] || '0:00';
        let durationSec = 0;
        const durMatch = durStr.match(/(\d+):(\d{2})/);
        if (durMatch) {
          durationSec = Number(durMatch[1]) * 60 + Number(durMatch[2]);
        }

        candidates.push({
          id: videoId,
          title: title || track.name,
          artists: [parts[0] || track.artist],
          channelName: `${parts[0] || track.artist} - Topic`,
          duration: durationSec,
          url: `https://music.youtube.com/watch?v=${videoId}`,
          provider: 'youtube-music',
          verified: true,
          isTopic: true,
        });
        if (candidates.length >= 6) break;
      }
      if (candidates.length >= 6) break;
    }
    return candidates;
  } catch {
    return [];
  }
}

async function searchYoutubeCandidates(track: SpotdlTrack): Promise<AudioCandidate[]> {
  try {
    const query = `${track.artists.join(', ')} - ${track.name} official audio`;
    const result = await ytSearch(query);
    return (result.videos || []).slice(0, 6).map((v: any) => ({
      id: v.videoId,
      title: v.title,
      artists: [v.author?.name || ''],
      channelName: v.author?.name || '',
      duration: Number(v.seconds) || 0,
      url: v.url,
      provider: 'youtube' as const,
      verified: Boolean(v.author?.name?.includes('Topic') || v.author?.name?.includes('VEVO')),
      isTopic: Boolean(v.author?.name?.includes('Topic')),
      views: v.views,
    }));
  } catch {
    return [];
  }
}

async function searchSoundCloudCandidates(
  ytDlpPath: string,
  track: SpotdlTrack
): Promise<AudioCandidate[]> {
  try {
    const query = `${track.artists[0] || track.artist} ${track.name}`.trim();
    const { stdout } = await execFileAsync(
      ytDlpPath,
      ['--no-warnings', '--flat-playlist', '-J', `scsearch5:${query}`],
      { maxBuffer: 5 * 1024 * 1024 }
    );
    const data = JSON.parse(stdout);
    const entries: any[] = Array.isArray(data.entries) ? data.entries : [];
    return entries
      .filter((e) => e && (e.url || e.webpage_url))
      .map((e) => ({
        id: String(e.id || e.url),
        title: String(e.title || track.name),
        artists: [String(e.uploader || track.artist)],
        channelName: String(e.uploader || ''),
        duration: Number(e.duration) || 0,
        url: String(e.webpage_url || e.url),
        provider: 'soundcloud' as const,
        verified: false,
        isTopic: false,
      }));
  } catch {
    return [];
  }
}

async function fetchLyricsForTrack(track: SpotdlTrack): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      track_name: track.name,
      artist_name: track.artists[0] || track.artist,
    });
    if (track.album_name) params.set('album_name', track.album_name);
    if (track.duration > 0) params.set('duration', String(Math.round(track.duration)));

    const exactRes = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
    if (exactRes.ok) {
      const data = (await exactRes.json()) as any;
      if (data?.syncedLyrics) return data.syncedLyrics;
      if (data?.plainLyrics) return data.plainLyrics;
    }

    const searchRes = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${track.artist} ${track.name}`)}`
    );
    if (searchRes.ok) {
      const items = (await searchRes.json()) as any[];
      const hit = items.find((i) => i.syncedLyrics) || items[0];
      return hit?.syncedLyrics || hit?.plainLyrics || null;
    }
    return null;
  } catch {
    return null;
  }
}

async function downloadBestAudio(
  ytDlpPath: string,
  videoUrl: string,
  outputBasePath: string,
  sponsorBlock: boolean,
  onProgress: (pct: number) => void
): Promise<string> {
  const args = [
    '--no-playlist',
    '-f',
    'bestaudio/best',
    '-o',
    `${outputBasePath}.%(ext)s`,
    '--newline',
    '--no-warnings',
  ];
  if (fs.existsSync(COOKIES_FILE_PATH)) {
    args.push('--cookies', COOKIES_FILE_PATH);
  }
  if (sponsorBlock) {
    args.push('--sponsorblock-remove', 'music_offtopic');
  }
  args.push(videoUrl);

  return new Promise((resolve, reject) => {
    const proc = spawn(ytDlpPath, args);
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      const match = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
      if (match) {
        onProgress(Math.min(100, Math.round(Number(match[1]))));
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
      }
      const dir = path.dirname(outputBasePath);
      const base = path.basename(outputBasePath);
      const found = fs
        .readdirSync(dir)
        .find((f) => f.startsWith(`${base}.`) && !f.endsWith('.part'));
      if (!found) {
        return reject(new Error('Downloaded audio file not found on disk.'));
      }
      resolve(path.join(dir, found));
    });
  });
}

async function runFfmpegConvertAndTag(opts: {
  inputPath: string;
  coverPath: string | null;
  outputPath: string;
  format: AudioFormat;
  bitrate: string;
  track: SpotdlTrack;
  id3Separator: string;
  lyrics: string | null;
}): Promise<void> {
  const { inputPath, coverPath, outputPath, format, bitrate, track, id3Separator, lyrics } = opts;

  const args: string[] = ['-y', '-i', inputPath];
  const supportsCover =
    coverPath && (format === 'mp3' || format === 'flac' || format === 'm4a');

  if (supportsCover && coverPath) {
    args.push('-i', coverPath);
    args.push('-map', '0:a', '-map', '1:v');
    args.push('-disposition:v:0', 'attached_pic');
    if (format === 'mp3') {
      args.push('-id3v2_version', '3');
    }
  } else {
    args.push('-vn');
  }

  args.push(...FFMPEG_CODEC_ARGS[format]);

  if (bitrate && bitrate !== 'disable' && bitrate !== 'auto' && format !== 'flac' && format !== 'wav') {
    args.push('-b:a', bitrate);
  } else if (format === 'mp3' && (bitrate === 'auto' || !bitrate)) {
    args.push('-b:a', '320k');
  }

  const sep = id3Separator || '/';
  const metadataPairs: [string, string][] = [
    ['title', track.name],
    ['artist', track.artists.join(sep)],
    ['album', track.album_name],
    ['album_artist', track.album_artist || track.artists[0] || ''],
    ['date', track.date || String(track.year)],
    ['track', `${track.track_number}/${track.tracks_count || 1}`],
    ['disc', `${track.disc_number}/${track.disc_count || 1}`],
    ['comment', track.url],
  ];
  if (track.genres.length > 0) {
    metadataPairs.push(['genre', track.genres.join(sep)]);
  }
  if (track.publisher) {
    metadataPairs.push(['publisher', track.publisher]);
  }
  if (lyrics) {
    metadataPairs.push(['lyrics', lyrics]);
  }

  for (const [k, v] of metadataPairs) {
    if (v) {
      args.push('-metadata', `${k}=${v}`);
    }
  }

  args.push(outputPath);

  await execFileAsync(FFMPEG_PATH, args, { maxBuffer: 10 * 1024 * 1024 });
}

export async function retagAudioFile(
  item: LibraryItem,
  updatedTrack: SpotdlTrack
): Promise<LibraryItem> {
  const filePath = path.join(DOWNLOADS_DIR, path.basename(item.fileName));
  if (!fs.existsSync(filePath)) {
    throw new Error('Audio file missing from disk.');
  }

  const tmpOut = path.join(TMP_DIR, `retag_${Date.now()}_${path.basename(item.fileName)}`);
  const args: string[] = ['-y', '-i', filePath, '-c', 'copy'];
  if (item.format === 'mp3') {
    args.push('-id3v2_version', '3');
  }

  const metaPairs: [string, string][] = [
    ['title', updatedTrack.name],
    ['artist', updatedTrack.artists.join('/')],
    ['album', updatedTrack.album_name],
    ['album_artist', updatedTrack.album_artist],
    ['date', String(updatedTrack.year)],
    ['track', `${updatedTrack.track_number}/${updatedTrack.tracks_count || 1}`],
  ];
  if (updatedTrack.genres.length > 0) {
    metaPairs.push(['genre', updatedTrack.genres.join('/')]);
  }

  for (const [k, v] of metaPairs) {
    if (v) args.push('-metadata', `${k}=${v}`);
  }
  args.push(tmpOut);

  await execFileAsync(FFMPEG_PATH, args);
  fs.renameSync(tmpOut, filePath);

  const stats = fs.statSync(filePath);
  const updatedItem: LibraryItem = {
    ...item,
    track: updatedTrack,
    fileSize: stats.size,
  };
  store.upsertLibraryItem(updatedItem);
  return updatedItem;
}

class DownloadQueueRunner {
  private activeCount = 0;
  private queue: string[] = [];

  enqueue(tracks: SpotdlTrack[], overrideSettings?: Partial<DownloaderSettings>): DownloadJob[] {
    const settings = { ...store.getSettings(), ...overrideSettings };
    const created: DownloadJob[] = [];

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (settings.skipExplicit && track.explicit) {
        const skippedJob: DownloadJob = {
          id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          track,
          status: 'skipped',
          progress: 100,
          stageLabel: 'Skipped (explicit track filter)',
          format: settings.format,
          bitrate: settings.bitrate,
          createdAt: Date.now() + i,
          completedAt: Date.now(),
        };
        store.addJob(skippedJob);
        created.push(skippedJob);
        continue;
      }

      const effectiveTrack: SpotdlTrack =
        settings.playlistNumbering && track.list_position
          ? { ...track, track_number: track.list_position }
          : track;

      const job: DownloadJob = {
        id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        track: effectiveTrack,
        status: 'queued',
        progress: 0,
        stageLabel: 'Queued',
        format: settings.format,
        bitrate: settings.bitrate,
        createdAt: Date.now() + i,
      };
      store.addJob(job);
      this.queue.push(job.id);
      created.push(job);
    }

    this.pump(settings);
    return created;
  }

  retry(jobId: string): DownloadJob | undefined {
    const job = store.getJob(jobId);
    if (!job) return undefined;
    store.updateJob(jobId, {
      status: 'queued',
      progress: 0,
      stageLabel: 'Queued for retry',
      error: undefined,
    });
    this.queue.push(jobId);
    this.pump(store.getSettings());
    return store.getJob(jobId);
  }

  private pump(settings: DownloaderSettings): void {
    const maxConcurrency = Math.min(6, Math.max(1, settings.threads || 3));
    while (this.activeCount < maxConcurrency && this.queue.length > 0) {
      const nextId = this.queue.shift()!;
      const job = store.getJob(nextId);
      if (!job || job.status !== 'queued') continue;
      this.activeCount++;
      this.processJob(job, settings).finally(() => {
        this.activeCount--;
        this.pump(store.getSettings());
      });
    }
  }

  private async processJob(job: DownloadJob, settings: DownloaderSettings): Promise<void> {
    const tmpFiles: string[] = [];
    try {
      const fileName = formatSongFilename(
        job.track,
        settings.output,
        job.format,
        settings.restrict,
        settings.maxFilenameLength
      );
      const finalPath = path.join(DOWNLOADS_DIR, fileName);

      if (fs.existsSync(finalPath) && settings.overwrite === 'skip') {
        const stats = fs.statSync(finalPath);
        const existingLib = store.findLibraryByFileName(fileName);
        store.updateJob(job.id, {
          status: 'completed',
          progress: 100,
          stageLabel: 'Already downloaded (skipped overwrite)',
          fileName,
          fileSize: stats.size,
          hasLrc: existingLib?.hasLrc ?? false,
          lrcContent: existingLib?.lrcContent,
          completedAt: Date.now(),
        });
        return;
      }

      const ytDlpPath = await ensureYtDlp();

      // Step 1: Audio Provider Search & Match
      store.updateJob(job.id, {
        status: 'searching',
        progress: 10,
        stageLabel: 'Matching audio source...',
      });

      let rawAudioPath = '';
      let matchedTitle = job.track.name;
      let matchedUrl = job.track.source === 'youtube' ? job.track.url : '';
      let matchScore = 100;
      let matchedProvider = settings.audioProviders[0] || 'youtube-music';

      const tmpBase = path.join(TMP_DIR, `dl_${job.id}`);

      if (matchedUrl) {
        store.updateJob(job.id, {
          status: 'downloading',
          progress: 22,
          stageLabel: 'Downloading from YouTube...',
          matchedVideoTitle: matchedTitle,
          matchedVideoUrl: matchedUrl,
          matchedProvider: 'youtube',
          matchScore: 100,
        });
        rawAudioPath = await downloadBestAudio(
          ytDlpPath,
          matchedUrl,
          tmpBase,
          settings.sponsorBlock,
          (pct) => {
            store.updateJob(job.id, {
              status: 'downloading',
              progress: Math.round(22 + pct * 0.43),
              stageLabel: `Downloading stream (${pct}%)`,
            });
          }
        );
      } else {
        const candidates: AudioCandidate[] = [];
        const [ytmList, ytList] = await Promise.all([
          settings.audioProviders.includes('youtube-music')
            ? searchYtmCandidates(job.track)
            : Promise.resolve([]),
          settings.audioProviders.includes('youtube') ||
          settings.audioProviders.includes('youtube-music')
            ? searchYoutubeCandidates(job.track)
            : Promise.resolve([]),
        ]);
        candidates.push(...ytmList, ...ytList);

        if (settings.audioProviders.includes('soundcloud') || candidates.length === 0) {
          candidates.push(...(await searchSoundCloudCandidates(ytDlpPath, job.track)));
        }

        const ranked = rankCandidates(
          job.track,
          candidates,
          settings.filterResults,
          settings.onlyVerifiedResults
        );

        if (ranked.length === 0) {
          throw new Error('No matching audio stream found on configured providers.');
        }

        // Try top ranked candidates in order; if YouTube blocks datacenter IP, cascade to next candidate / SoundCloud
        const attemptPool = ranked.slice(0, 6);
        let lastErr: Error | null = null;

        for (let idx = 0; idx < attemptPool.length; idx++) {
          const entry = attemptPool[idx];
          // Skip SoundCloud 30s preview-only tracks when possible unless it's our final option
          matchedUrl = entry.best.url;
          matchedTitle = entry.best.title;
          matchScore = entry.score;
          matchedProvider = entry.best.provider;

          store.updateJob(job.id, {
            status: 'downloading',
            progress: 22,
            stageLabel: `Downloading from ${
              matchedProvider === 'youtube-music'
                ? 'YouTube Music'
                : matchedProvider === 'soundcloud'
                ? 'SoundCloud'
                : 'YouTube'
            }...`,
            matchedVideoTitle: matchedTitle,
            matchedVideoUrl: matchedUrl,
            matchedProvider,
            matchScore,
          });

          try {
            rawAudioPath = await downloadBestAudio(
              ytDlpPath,
              matchedUrl,
              `${tmpBase}_${idx}`,
              settings.sponsorBlock,
              (pct) => {
                store.updateJob(job.id, {
                  status: 'downloading',
                  progress: Math.round(22 + pct * 0.43),
                  stageLabel: `Downloading stream (${pct}%)`,
                });
              }
            );
            break;
          } catch (attemptErr: any) {
            lastErr = attemptErr;
            // If all YouTube/YTM candidates so far failed and SoundCloud wasn't queried yet, fetch SoundCloud dynamically
            if (
              idx === attemptPool.length - 1 &&
              !attemptPool.some((a) => a.best.provider === 'soundcloud')
            ) {
              const scList = await searchSoundCloudCandidates(ytDlpPath, job.track);
              const scRanked = rankCandidates(job.track, scList, settings.filterResults, false);
              attemptPool.push(...scRanked.slice(0, 3));
            }
          }
        }

        if (!rawAudioPath) {
          const rawMsg = lastErr?.message || 'All audio providers failed.';
          const cleanMsg = rawMsg.includes('Sign in to confirm')
            ? 'YouTube requested sign-in verification on this server IP. Add cookies.txt in Settings or enable SoundCloud.'
            : rawMsg.split('\n')[0];
          throw new Error(cleanMsg);
        }
      }
      const targetUrl = matchedUrl;
      tmpFiles.push(rawAudioPath);

      // Step 3: Fetch Cover Art & Lyrics in parallel
      store.updateJob(job.id, {
        status: 'converting',
        progress: 68,
        stageLabel: `Converting to ${job.format.toUpperCase()}...`,
      });

      let coverPath: string | null = null;
      const coverPromise =
        !settings.skipAlbumArt && job.track.cover_url
          ? fetch(job.track.cover_url)
              .then(async (res) => {
                if (!res.ok) return null;
                const buf = Buffer.from(await res.arrayBuffer());
                const cPath = path.join(TMP_DIR, `cover_${job.id}.jpg`);
                fs.writeFileSync(cPath, buf);
                tmpFiles.push(cPath);
                return cPath;
              })
              .catch(() => null)
          : Promise.resolve(null);

      const lyricsPromise =
        settings.generateLrc || settings.lyricsProviders.length > 0
          ? fetchLyricsForTrack(job.track)
          : Promise.resolve(null);

      const [resolvedCover, resolvedLyrics] = await Promise.all([coverPromise, lyricsPromise]);
      coverPath = resolvedCover;

      store.updateJob(job.id, {
        status: 'tagging',
        progress: 85,
        stageLabel: 'Embedding metadata & album art...',
      });

      // Step 4: FFmpeg Convert + Embed Metadata & Cover
      await runFfmpegConvertAndTag({
        inputPath: rawAudioPath,
        coverPath,
        outputPath: finalPath,
        format: job.format,
        bitrate: job.bitrate,
        track: job.track,
        id3Separator: settings.id3Separator,
        lyrics: resolvedLyrics,
      });

      let hasLrc = false;
      if (settings.generateLrc && resolvedLyrics) {
        const lrcPath = finalPath.replace(/\.[^.]+$/, '.lrc');
        fs.writeFileSync(lrcPath, resolvedLyrics, 'utf-8');
        hasLrc = true;
      }

      const stats = fs.statSync(finalPath);
      let measuredBitrate: string = job.bitrate === 'auto' ? '320k' : job.bitrate;
      try {
        const mm = await parseFile(finalPath);
        if (mm.format.bitrate) {
          measuredBitrate = `${Math.round(mm.format.bitrate / 1000)}k`;
        }
      } catch {
        // keep default bitrate label
      }

      const libItem: LibraryItem = {
        id: job.id,
        track: job.track,
        fileName,
        format: job.format,
        bitrate: measuredBitrate,
        fileSize: stats.size,
        hasLrc,
        lrcContent: resolvedLyrics || undefined,
        matchedVideoUrl: targetUrl,
        matchedVideoTitle: matchedTitle,
        addedAt: Date.now(),
      };
      store.upsertLibraryItem(libItem);

      store.updateJob(job.id, {
        status: 'completed',
        progress: 100,
        stageLabel: 'Ready',
        fileName,
        fileSize: stats.size,
        hasLrc,
        lrcContent: resolvedLyrics || undefined,
        completedAt: Date.now(),
      });
    } catch (err: any) {
      store.updateJob(job.id, {
        status: 'error',
        progress: 0,
        stageLabel: 'Failed',
        error: err?.message || 'Unexpected download pipeline failure',
        completedAt: Date.now(),
      });
    } finally {
      for (const f of tmpFiles) {
        if (fs.existsSync(f)) {
          try {
            fs.unlinkSync(f);
          } catch {
            // ignore cleanup failure
          }
        }
      }
    }
  }
}

export const queueRunner = new DownloadQueueRunner();
