import 'dotenv/config';
import type { Archiver, ArchiverError } from 'archiver';
import express from 'express';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const require = createRequire(import.meta.url);
const createArchiver = require('archiver') as (
  format: 'zip' | 'tar',
  options?: Record<string, unknown>
) => Archiver;
import { createM3uContent } from './src/shared/formatter';
import type { SpotdlTrack } from './src/shared/types';
import {
  COOKIES_FILE_PATH,
  ensureYtDlp,
  queueRunner,
  retagAudioFile,
} from './src/server/audioPipeline';
import { getOfficialSpotifyToken, resolveSearchOrUrl } from './src/server/spotifyClient';
import { DOWNLOADS_DIR, store } from './src/server/store';

const PORT = Number(process.env.PORT) || 3000;

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Pre-warm yt-dlp binary in background without blocking boot
  ensureYtDlp().catch((err) => {
    console.warn('yt-dlp pre-warm skipped:', err?.message);
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      ffmpeg: fs.existsSync('/usr/bin/ffmpeg'),
      ytDlp: fs.existsSync('/tmp/yt-dlp'),
    });
  });

  // Real-time SSE events for Queue, Library, and Settings
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('init', {
      jobs: store.getJobs(),
      library: store.getLibrary(),
      settings: store.getSettings(),
    });

    const onJobs = (jobs: unknown) => send('jobs', jobs);
    const onJobUpdate = (job: unknown) => send('job_update', job);
    const onLibrary = (lib: unknown) => send('library', lib);
    const onSettings = (settings: unknown) => send('settings', settings);

    store.on('jobs', onJobs);
    store.on('job_update', onJobUpdate);
    store.on('library', onLibrary);
    store.on('settings', onSettings);

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 20_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      store.off('jobs', onJobs);
      store.off('job_update', onJobUpdate);
      store.off('library', onLibrary);
      store.off('settings', onSettings);
    });
  });

  // Search or resolve Spotify / YouTube URL
  app.get('/api/search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.status(400).json({ error: 'Please enter a song, artist, or Spotify URL.' });
    }
    try {
      const ytDlpPath = await ensureYtDlp();
      const result = await resolveSearchOrUrl(q, ytDlpPath);
      return res.json(result);
    } catch (err: any) {
      return res.status(422).json({
        error: err?.message || 'Unable to resolve query.',
      });
    }
  });

  // Queue & Downloads
  app.get('/api/downloads', (_req, res) => {
    res.json({ jobs: store.getJobs() });
  });

  app.post('/api/downloads', (req, res) => {
    const tracks = req.body?.tracks as SpotdlTrack[] | undefined;
    const overrideSettings = req.body?.settings;
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return res.status(400).json({ error: 'No tracks provided to queue.' });
    }
    const jobs = queueRunner.enqueue(tracks, overrideSettings);
    return res.status(201).json({ jobs });
  });

  app.post('/api/downloads/:id/retry', (req, res) => {
    const job = queueRunner.retry(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    return res.json({ job });
  });

  app.post('/api/downloads/clear-completed', (_req, res) => {
    store.clearCompletedJobs();
    res.json({ jobs: store.getJobs() });
  });

  app.delete('/api/downloads/:id', (req, res) => {
    const removed = store.removeJob(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Job not found.' });
    return res.json({ ok: true });
  });

  // Library
  app.get('/api/library', (_req, res) => {
    res.json({ items: store.getLibrary() });
  });

  app.delete('/api/library/:id', (req, res) => {
    const removed = store.removeLibraryItem(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Library item not found.' });
    return res.json({ ok: true });
  });

  app.patch('/api/library/:id/metadata', async (req, res) => {
    const item = store.getLibraryItem(req.params.id);
    if (!item) return res.status(404).json({ error: 'Library item not found.' });
    try {
      const updatedTrack: SpotdlTrack = {
        ...item.track,
        name: String(req.body?.name ?? item.track.name).trim() || item.track.name,
        artists: Array.isArray(req.body?.artists)
          ? req.body.artists.map(String).filter(Boolean)
          : item.track.artists,
        artist: Array.isArray(req.body?.artists) && req.body.artists[0]
          ? String(req.body.artists[0])
          : item.track.artist,
        album_name: String(req.body?.album_name ?? item.track.album_name).trim() || item.track.album_name,
        album_artist: String(req.body?.album_artist ?? item.track.album_artist).trim() || item.track.album_artist,
        year: Number(req.body?.year) || item.track.year,
        track_number: Number(req.body?.track_number) || item.track.track_number,
        genres: Array.isArray(req.body?.genres)
          ? req.body.genres.map(String).filter(Boolean)
          : item.track.genres,
      };
      const updated = await retagAudioFile(item, updatedTrack);
      return res.json({ item: updated });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to update audio tags.' });
    }
  });

  // Stream & File Download
  app.get('/api/files/:id/stream', (req, res) => {
    const item = store.getLibraryItem(req.params.id);
    if (!item) return res.status(404).json({ error: 'File not found.' });
    const filePath = path.join(DOWNLOADS_DIR, path.basename(item.fileName));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing from disk.' });

    const stat = fs.statSync(filePath);
    const range = req.headers.range;
    const mimeMap: Record<string, string> = {
      mp3: 'audio/mpeg',
      flac: 'audio/flac',
      ogg: 'audio/ogg',
      opus: 'audio/opus',
      m4a: 'audio/mp4',
      wav: 'audio/wav',
    };
    const contentType = mimeMap[item.format] || 'application/octet-stream';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });

  app.get('/api/files/:id/download', (req, res) => {
    const item = store.getLibraryItem(req.params.id);
    if (!item) return res.status(404).json({ error: 'File not found.' });
    const filePath = path.join(DOWNLOADS_DIR, path.basename(item.fileName));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing.' });
    res.download(filePath, item.fileName);
  });

  app.get('/api/files/:id/lrc', (req, res) => {
    const item = store.getLibraryItem(req.params.id);
    if (!item) return res.status(404).json({ error: 'File not found.' });
    const lrcName = item.fileName.replace(/\.[^.]+$/, '.lrc');
    const lrcPath = path.join(DOWNLOADS_DIR, path.basename(lrcName));
    if (fs.existsSync(lrcPath)) {
      return res.download(lrcPath, lrcName);
    }
    if (item.lrcContent) {
      res.setHeader('Content-Disposition', `attachment; filename="${lrcName}"`);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(item.lrcContent);
    }
    return res.status(404).json({ error: 'No lyrics file available for this track.' });
  });

  // Export M3U8 & ZIP
  app.post('/api/export/m3u', (req, res) => {
    const settings = store.getSettings();
    const ids = req.body?.ids as string[] | undefined;
    const lib = store.getLibrary();
    const selected = Array.isArray(ids) && ids.length > 0
      ? lib.filter((i) => ids.includes(i.id))
      : lib;
    if (selected.length === 0) {
      return res.status(400).json({ error: 'No tracks selected for M3U8 export.' });
    }
    const content = createM3uContent(
      selected.map((i) => i.track),
      settings.output,
      settings.format,
      settings.restrict
    );
    const playlistName = String(req.body?.name || 'spotdl-playlist').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${playlistName}.m3u8"`);
    return res.send(content);
  });

  app.post('/api/export/zip', (req, res) => {
    const ids = req.body?.ids as string[] | undefined;
    const includeM3u = Boolean(req.body?.includeM3u);
    const lib = store.getLibrary();
    const selected = Array.isArray(ids) && ids.length > 0
      ? lib.filter((i) => ids.includes(i.id))
      : lib;

    if (selected.length === 0) {
      return res.status(400).json({ error: 'No downloaded tracks available to archive.' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="spotdl-bundle.zip"');

    const archive = createArchiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err: ArchiverError) => {
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });
    archive.pipe(res);

    for (const item of selected) {
      const audioPath = path.join(DOWNLOADS_DIR, path.basename(item.fileName));
      if (fs.existsSync(audioPath)) {
        archive.file(audioPath, { name: item.fileName });
      }
      const lrcName = item.fileName.replace(/\.[^.]+$/, '.lrc');
      const lrcPath = path.join(DOWNLOADS_DIR, path.basename(lrcName));
      if (fs.existsSync(lrcPath)) {
        archive.file(lrcPath, { name: lrcName });
      }
    }

    if (includeM3u) {
      const settings = store.getSettings();
      const m3u = createM3uContent(
        selected.map((i) => i.track),
        settings.output,
        settings.format,
        settings.restrict
      );
      archive.append(m3u, { name: 'playlist.m3u8' });
    }

    archive.finalize();
  });

  // Sync (.spotdl save-file diffing)
  app.post('/api/sync/diff', (req, res) => {
    const incoming = req.body?.tracks;
    if (!Array.isArray(incoming)) {
      return res.status(400).json({ error: 'Invalid .spotdl file format: expected a JSON array of tracks.' });
    }
    const lib = store.getLibrary();
    const existingKeys = new Set(
      lib.map((item) => `${item.track.artist.toLowerCase()}::${item.track.name.toLowerCase()}`)
    );

    const missing: SpotdlTrack[] = [];
    const present: SpotdlTrack[] = [];
    for (const t of incoming) {
      if (!t || typeof t.name !== 'string') continue;
      const artist = Array.isArray(t.artists) && t.artists[0] ? t.artists[0] : t.artist || 'Unknown Artist';
      const key = `${String(artist).toLowerCase()}::${t.name.toLowerCase()}`;
      if (existingKeys.has(key)) {
        present.push(t);
      } else {
        missing.push(t);
      }
    }
    return res.json({ total: missing.length + present.length, missing, present });
  });

  // Settings & Spotify Credentials
  app.get('/api/settings', (_req, res) => {
    const creds = store.getSpotifyCredentials();
    res.json({
      settings: store.getSettings(),
      spotify: {
        configured: Boolean(creds),
        mode: creds ? 'official' : 'free',
        clientIdPreview: creds ? `${creds.clientId.slice(0, 6)}••••` : undefined,
      },
    });
  });

  app.put('/api/settings', (req, res) => {
    const updated = store.updateSettings(req.body || {});
    res.json({ settings: updated });
  });

  app.get('/api/settings/cookies', (_req, res) => {
    res.json({ configured: fs.existsSync(COOKIES_FILE_PATH) });
  });

  app.post('/api/settings/cookies', (req, res) => {
    const content = String(req.body?.content || '').trim();
    if (!content) {
      if (fs.existsSync(COOKIES_FILE_PATH)) fs.unlinkSync(COOKIES_FILE_PATH);
      return res.json({ configured: false });
    }
    fs.writeFileSync(COOKIES_FILE_PATH, `${content}\n`, 'utf-8');
    return res.json({ configured: true });
  });

  app.post('/api/spotify/credentials', async (req, res) => {
    const clientId = String(req.body?.clientId || '').trim();
    const clientSecret = String(req.body?.clientSecret || '').trim();
    if (!clientId || !clientSecret) {
      store.setSpotifyCredentials(null);
      return res.json({ configured: false, mode: 'free' });
    }
    try {
      await getOfficialSpotifyToken(clientId, clientSecret);
      store.setSpotifyCredentials({ clientId, clientSecret });
      return res.json({
        configured: true,
        mode: 'official',
        clientIdPreview: `${clientId.slice(0, 6)}••••`,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Invalid Spotify credentials.' });
    }
  });

  // Vite middleware in development, static dist in production
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`spotDL Studio server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
