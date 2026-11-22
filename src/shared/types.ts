export type AudioFormat = 'mp3' | 'flac' | 'ogg' | 'opus' | 'm4a' | 'wav';

export type AudioProvider = 'youtube-music' | 'youtube' | 'soundcloud';

export type LyricsProvider = 'lrclib' | 'synced' | 'plain';

export type OverwriteMode = 'skip' | 'force' | 'metadata';

export type RestrictMode = 'none' | 'ascii' | 'strict';

export type BitrateOption = 'auto' | 'disable' | '96k' | '128k' | '192k' | '256k' | '320k';

export interface DownloaderSettings {
  format: AudioFormat;
  bitrate: BitrateOption;
  output: string;
  audioProviders: AudioProvider[];
  lyricsProviders: LyricsProvider[];
  threads: number;
  overwrite: OverwriteMode;
  restrict: RestrictMode;
  generateLrc: boolean;
  skipAlbumArt: boolean;
  playlistNumbering: boolean;
  playlistRetainTrackCover: boolean;
  skipExplicit: boolean;
  onlyVerifiedResults: boolean;
  filterResults: boolean;
  sponsorBlock: boolean;
  id3Separator: string;
  maxFilenameLength: number | null;
}

export const DEFAULT_DOWNLOADER_SETTINGS: DownloaderSettings = {
  format: 'mp3',
  bitrate: '320k',
  output: '{artists} - {title}.{output-ext}',
  audioProviders: ['youtube-music', 'youtube'],
  lyricsProviders: ['lrclib', 'synced'],
  threads: 3,
  overwrite: 'skip',
  restrict: 'none',
  generateLrc: true,
  skipAlbumArt: false,
  playlistNumbering: false,
  playlistRetainTrackCover: true,
  skipExplicit: false,
  onlyVerifiedResults: false,
  filterResults: true,
  sponsorBlock: false,
  id3Separator: '/',
  maxFilenameLength: 200,
};

export interface SpotdlTrack {
  song_id: string;
  name: string;
  artists: string[];
  artist: string;
  album_name: string;
  album_artist: string;
  genres: string[];
  disc_number: number;
  disc_count: number;
  year: number;
  date: string;
  track_number: number;
  tracks_count: number;
  duration: number;
  isrc?: string | null;
  publisher?: string | null;
  explicit: boolean;
  cover_url?: string | null;
  url: string;
  preview_url?: string | null;
  list_name?: string | null;
  list_position?: number | null;
  list_length?: number | null;
  source: 'spotify' | 'youtube-music' | 'youtube' | 'itunes';
  lyrics?: string | null;
}

export type JobStatus =
  | 'queued'
  | 'searching'
  | 'downloading'
  | 'converting'
  | 'tagging'
  | 'completed'
  | 'skipped'
  | 'error';

export interface DownloadJob {
  id: string;
  track: SpotdlTrack;
  status: JobStatus;
  progress: number;
  stageLabel: string;
  matchedVideoTitle?: string;
  matchedVideoUrl?: string;
  matchedProvider?: AudioProvider;
  matchScore?: number;
  fileName?: string;
  fileSize?: number;
  hasLrc?: boolean;
  lrcContent?: string;
  error?: string;
  format: AudioFormat;
  bitrate: BitrateOption;
  createdAt: number;
  completedAt?: number;
}

export interface LibraryItem {
  id: string;
  track: SpotdlTrack;
  fileName: string;
  format: AudioFormat;
  bitrate: string;
  fileSize: number;
  hasLrc: boolean;
  lrcContent?: string;
  matchedVideoUrl?: string;
  matchedVideoTitle?: string;
  addedAt: number;
}

export interface SearchResponse {
  queryType: 'track' | 'album' | 'playlist' | 'artist' | 'youtube' | 'search';
  collectionName?: string;
  collectionSubtitle?: string;
  collectionCover?: string | null;
  sourceLabel: string;
  tracks: SpotdlTrack[];
}

export interface AudioCandidate {
  id: string;
  title: string;
  artists: string[];
  channelName: string;
  duration: number;
  url: string;
  provider: AudioProvider;
  verified: boolean;
  isTopic: boolean;
  albumName?: string;
  views?: number;
}

export interface LrcLine {
  timeMs: number;
  text: string;
}

export interface SpotifyCredentialStatus {
  configured: boolean;
  mode: 'free' | 'official';
  clientIdPreview?: string;
}
