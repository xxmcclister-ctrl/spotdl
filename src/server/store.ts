import EventEmitter from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_DOWNLOADER_SETTINGS,
  type DownloadJob,
  type DownloaderSettings,
  type LibraryItem,
} from '../shared/types';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const DOWNLOADS_DIR = path.join(DATA_DIR, 'downloads');
export const TMP_DIR = path.join(DATA_DIR, 'tmp');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const LIBRARY_FILE = path.join(DATA_DIR, 'library.json');
const SPOTIFY_CREDS_FILE = path.join(DATA_DIR, 'spotify_creds.json');

export interface SpotifyCredentials {
  clientId: string;
  clientSecret: string;
}

class AppStore extends EventEmitter {
  private settings: DownloaderSettings = { ...DEFAULT_DOWNLOADER_SETTINGS };
  private library: LibraryItem[] = [];
  private jobs: DownloadJob[] = [];
  private spotifyCreds: SpotifyCredentials | null = null;

  constructor() {
    super();
    this.ensureDirs();
    this.loadFromDisk();
  }

  private ensureDirs(): void {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        this.settings = { ...DEFAULT_DOWNLOADER_SETTINGS, ...parsed };
      }
    } catch {
      this.settings = { ...DEFAULT_DOWNLOADER_SETTINGS };
    }

    try {
      if (fs.existsSync(LIBRARY_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf-8'));
        if (Array.isArray(parsed)) {
          // Verify files still exist on disk
          this.library = parsed.filter((item) => {
            if (!item?.fileName) return false;
            return fs.existsSync(path.join(DOWNLOADS_DIR, path.basename(item.fileName)));
          });
        }
      }
    } catch {
      this.library = [];
    }

    try {
      if (fs.existsSync(SPOTIFY_CREDS_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(SPOTIFY_CREDS_FILE, 'utf-8'));
        if (parsed?.clientId && parsed?.clientSecret) {
          this.spotifyCreds = {
            clientId: String(parsed.clientId),
            clientSecret: String(parsed.clientSecret),
          };
        }
      }
    } catch {
      this.spotifyCreds = null;
    }
  }

  private saveSettings(): void {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), 'utf-8');
  }

  private saveLibrary(): void {
    fs.writeFileSync(LIBRARY_FILE, JSON.stringify(this.library, null, 2), 'utf-8');
  }

  getSettings(): DownloaderSettings {
    return { ...this.settings };
  }

  updateSettings(patch: Partial<DownloaderSettings>): DownloaderSettings {
    const next: DownloaderSettings = {
      ...this.settings,
      ...patch,
      threads: Math.min(8, Math.max(1, Number(patch.threads ?? this.settings.threads) || 3)),
      maxFilenameLength:
        patch.maxFilenameLength === null
          ? null
          : Math.min(255, Math.max(32, Number(patch.maxFilenameLength ?? this.settings.maxFilenameLength) || 200)),
    };
    if (!Array.isArray(next.audioProviders) || next.audioProviders.length === 0) {
      next.audioProviders = ['youtube-music', 'youtube'];
    }
    this.settings = next;
    this.saveSettings();
    this.emit('settings', this.settings);
    return this.getSettings();
  }

  getSpotifyCredentials(): SpotifyCredentials | null {
    if (this.spotifyCreds) return this.spotifyCreds;
    const envId = process.env.SPOTIFY_CLIENT_ID;
    const envSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (envId && envSecret) {
      return { clientId: envId, clientSecret: envSecret };
    }
    return null;
  }

  setSpotifyCredentials(creds: SpotifyCredentials | null): void {
    this.spotifyCreds = creds;
    if (creds) {
      fs.writeFileSync(SPOTIFY_CREDS_FILE, JSON.stringify(creds, null, 2), 'utf-8');
    } else if (fs.existsSync(SPOTIFY_CREDS_FILE)) {
      fs.unlinkSync(SPOTIFY_CREDS_FILE);
    }
    this.emit('spotify_creds', { configured: Boolean(creds) });
  }

  getJobs(): DownloadJob[] {
    return [...this.jobs].sort((a, b) => b.createdAt - a.createdAt);
  }

  getJob(id: string): DownloadJob | undefined {
    return this.jobs.find((j) => j.id === id);
  }

  addJob(job: DownloadJob): void {
    this.jobs.unshift(job);
    this.emit('jobs', this.getJobs());
  }

  updateJob(id: string, patch: Partial<DownloadJob>): DownloadJob | undefined {
    const idx = this.jobs.findIndex((j) => j.id === id);
    if (idx === -1) return undefined;
    this.jobs[idx] = { ...this.jobs[idx], ...patch };
    this.emit('job_update', this.jobs[idx]);
    return this.jobs[idx];
  }

  removeJob(id: string): boolean {
    const before = this.jobs.length;
    this.jobs = this.jobs.filter((j) => j.id !== id);
    if (this.jobs.length !== before) {
      this.emit('jobs', this.getJobs());
      return true;
    }
    return false;
  }

  clearCompletedJobs(): void {
    this.jobs = this.jobs.filter(
      (j) => j.status === 'queued' || j.status === 'searching' || j.status === 'downloading' || j.status === 'converting' || j.status === 'tagging'
    );
    this.emit('jobs', this.getJobs());
  }

  getLibrary(): LibraryItem[] {
    return [...this.library].sort((a, b) => b.addedAt - a.addedAt);
  }

  getLibraryItem(id: string): LibraryItem | undefined {
    return this.library.find((item) => item.id === id);
  }

  findLibraryByFileName(fileName: string): LibraryItem | undefined {
    return this.library.find((item) => item.fileName === fileName);
  }

  upsertLibraryItem(item: LibraryItem): void {
    const idx = this.library.findIndex(
      (existing) => existing.id === item.id || existing.fileName === item.fileName
    );
    if (idx !== -1) {
      this.library[idx] = item;
    } else {
      this.library.unshift(item);
    }
    this.saveLibrary();
    this.emit('library', this.getLibrary());
  }

  removeLibraryItem(id: string): boolean {
    const item = this.getLibraryItem(id);
    if (!item) return false;
    const safeFile = path.join(DOWNLOADS_DIR, path.basename(item.fileName));
    if (fs.existsSync(safeFile)) {
      fs.unlinkSync(safeFile);
    }
    const lrcFile = safeFile.replace(/\.[^.]+$/, '.lrc');
    if (fs.existsSync(lrcFile)) {
      fs.unlinkSync(lrcFile);
    }
    this.library = this.library.filter((i) => i.id !== id);
    this.saveLibrary();
    this.emit('library', this.getLibrary());
    return true;
  }
}

export const store = new AppStore();
