import { Check, KeyRound, RotateCcw, Save } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { formatSongFilename } from '../shared/formatter';
import {
  DEFAULT_DOWNLOADER_SETTINGS,
  type AudioFormat,
  type AudioProvider,
  type BitrateOption,
  type DownloaderSettings,
  type LyricsProvider,
  type OverwriteMode,
  type RestrictMode,
  type SpotifyCredentialStatus,
  type SpotdlTrack,
} from '../shared/types';

interface SettingsViewProps {
  settings: DownloaderSettings;
  spotifyStatus: SpotifyCredentialStatus;
  onSaveSettings: (next: DownloaderSettings) => Promise<void>;
  onSaveSpotifyCreds: (clientId: string, clientSecret: string) => Promise<void>;
}

const SAMPLE_PREVIEW_TRACK: SpotdlTrack = {
  song_id: '4cOdK2wGLETKBW3PvgPWqT',
  name: 'Never Gonna Give You Up',
  artists: ['Rick Astley'],
  artist: 'Rick Astley',
  album_name: 'Whenever You Need Somebody',
  album_artist: 'Rick Astley',
  genres: ['Pop'],
  disc_number: 1,
  disc_count: 1,
  year: 1987,
  date: '1987-11-12',
  track_number: 1,
  tracks_count: 10,
  duration: 213,
  explicit: false,
  url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
  list_name: '80s Classics',
  list_position: 3,
  list_length: 25,
  source: 'spotify',
};

const QUICK_TEMPLATE_TOKENS = [
  '{artists}',
  '{title}',
  '{album}',
  '{track-number}',
  '{year}',
  '{list-position}',
  '{output-ext}',
];

export function SettingsView({
  settings,
  spotifyStatus,
  onSaveSettings,
  onSaveSpotifyCreds,
}: SettingsViewProps) {
  const [draft, setDraft] = useState<DownloaderSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [spotifyMsg, setSpotifyMsg] = useState<string | null>(null);
  const [spotifySaving, setSpotifySaving] = useState(false);

  const [cookiesConfigured, setCookiesConfigured] = useState(false);
  const [cookiesText, setCookiesText] = useState('');
  const [cookiesMsg, setCookiesMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings/cookies')
      .then((r) => r.json())
      .then((d) => setCookiesConfigured(Boolean(d?.configured)))
      .catch(() => {});
  }, []);

  const [cookiesConfigured, setCookiesConfigured] = useState(false);
  const [cookiesText, setCookiesText] = useState('');
  const [cookiesMsg, setCookiesMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings/cookies')
      .then((r) => r.json())
      .then((d) => setCookiesConfigured(Boolean(d?.configured)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const filenamePreview = useMemo(
    () =>
      formatSongFilename(
        SAMPLE_PREVIEW_TRACK,
        draft.output,
        draft.format,
        draft.restrict,
        draft.maxFilenameLength
      ),
    [draft.output, draft.format, draft.restrict, draft.maxFilenameLength]
  );

  const toggleAudioProvider = (provider: AudioProvider) => {
    setDraft((prev) => {
      const exists = prev.audioProviders.includes(provider);
      const next = exists
        ? prev.audioProviders.filter((p) => p !== provider)
        : [...prev.audioProviders, provider];
      return {
        ...prev,
        audioProviders: next.length > 0 ? next : ['youtube-music'],
      };
    });
  };

  const toggleLyricsProvider = (provider: LyricsProvider) => {
    setDraft((prev) => {
      const exists = prev.lyricsProviders.includes(provider);
      return {
        ...prev,
        lyricsProviders: exists
          ? prev.lyricsProviders.filter((p) => p !== provider)
          : [...prev.lyricsProviders, provider],
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      await onSaveSettings(draft);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleSpotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSpotifySaving(true);
    setSpotifyMsg(null);
    try {
      await onSaveSpotifyCreds(clientId, clientSecret);
      setSpotifyMsg(
        clientId.trim()
          ? 'Spotify Web API credentials verified and active.'
          : 'Reverted to Free Mode (no credentials required).'
      );
      setClientSecret('');
    } catch (err: any) {
      setSpotifyMsg(err?.message || 'Credential verification failed.');
    } finally {
      setSpotifySaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Downloader Settings
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Configure audio format, bitrate, output filename templates, matching filters, and Spotify API credentials.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDraft({ ...DEFAULT_DOWNLOADER_SETTINGS })}
            className="h-9 px-3.5 rounded-lg border border-slate-300 dark:border-white/[0.12] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="submit"
            form="spotdl-settings-form"
            disabled={saving}
            className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            {savedNotice ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <form id="spotdl-settings-form" onSubmit={handleSave} className="space-y-6">
        {/* Audio Format & Output */}
        <section className="p-5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#161920] space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Audio Encoding & Output Naming
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="setting-format"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Output Format
              </label>
              <select
                id="setting-format"
                value={draft.format}
                onChange={(e) => setDraft({ ...draft, format: e.target.value as AudioFormat })}
                className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-[#111419] border border-slate-300 dark:border-white/[0.12] text-sm font-mono uppercase text-slate-900 dark:text-slate-100"
              >
                <option value="mp3">MP3 (libmp3lame)</option>
                <option value="flac">FLAC (Lossless)</option>
                <option value="m4a">M4A (AAC)</option>
                <option value="opus">OPUS</option>
                <option value="ogg">OGG (Vorbis)</option>
                <option value="wav">WAV (PCM)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="setting-bitrate"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Target Bitrate
              </label>
              <select
                id="setting-bitrate"
                value={draft.bitrate}
                onChange={(e) => setDraft({ ...draft, bitrate: e.target.value as BitrateOption })}
                className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-[#111419] border border-slate-300 dark:border-white/[0.12] text-sm font-mono text-slate-900 dark:text-slate-100"
              >
                <option value="320k">320 kbps</option>
                <option value="256k">256 kbps</option>
                <option value="192k">192 kbps</option>
                <option value="128k">128 kbps</option>
                <option value="96k">96 kbps</option>
                <option value="auto">Auto</option>
                <option value="disable">Disable override</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="setting-threads"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Concurrent Threads ({draft.threads})
              </label>
              <input
                id="setting-threads"
                type="range"
                min={1}
                max={6}
                value={draft.threads}
                onChange={(e) => setDraft({ ...draft, threads: Number(e.target.value) })}
                className="w-full mt-2 accent-emerald-600"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="setting-output"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              Output Filename Template
            </label>
            <input
              id="setting-output"
              type="text"
              value={draft.output}
              onChange={(e) => setDraft({ ...draft, output: e.target.value })}
              className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-[#111419] border border-slate-300 dark:border-white/[0.12] text-xs font-mono text-slate-900 dark:text-slate-100"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_TEMPLATE_TOKENS.map((tok) => (
                <button
                  key={tok}
                  type="button"
                  onClick={() => setDraft({ ...draft, output: `${draft.output}${tok}` })}
                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] font-mono text-[11px] text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {tok}
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Preview:{' '}
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {filenamePreview}
              </span>
            </div>
          </div>
        </section>

        {/* Providers & Matching */}
        <section className="p-5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#161920] space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Audio, Lyrics & Matching Rules
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Audio Providers
              </div>
              <div className="space-y-2">
                {(
                  [
                    ['youtube-music', 'YouTube Music (Topic / Official Audio)'],
                    ['youtube', 'YouTube Standard Search'],
                    ['soundcloud', 'SoundCloud'],
                  ] as [AudioProvider, string][]
                ).map(([prov, label]) => (
                  <label
                    key={prov}
                    className="flex items-center gap-2.5 text-sm text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={draft.audioProviders.includes(prov)}
                      onChange={() => toggleAudioProvider(prov)}
                      className="rounded accent-emerald-600"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Lyrics Providers
              </div>
              <div className="space-y-2">
                {(
                  [
                    ['lrclib', 'LRCLIB (Synced Time-Coded Lyrics)'],
                    ['synced', 'Synced LRC Fallback'],
                    ['plain', 'Plain Lyrics Embedding'],
                  ] as [LyricsProvider, string][]
                ).map(([prov, label]) => (
                  <label
                    key={prov}
                    className="flex items-center gap-2.5 text-sm text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={draft.lyricsProviders.includes(prov)}
                      onChange={() => toggleLyricsProvider(prov)}
                      className="rounded accent-emerald-600"
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-white/[0.08] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              ['generateLrc', 'Generate synced .lrc file'],
              ['skipAlbumArt', 'Skip embedding album cover art'],
              ['playlistNumbering', 'Use playlist position as track #'],
              ['filterResults', 'Filter remixes, covers & slowed'],
              ['onlyVerifiedResults', 'Prefer verified / Topic channels'],
              ['skipExplicit', 'Skip explicit tracks'],
              ['sponsorBlock', 'Remove SponsorBlock non-music'],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={Boolean(draft[key as keyof DownloaderSettings])}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.checked } as DownloaderSettings)
                  }
                  className="rounded accent-emerald-600"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label
                htmlFor="setting-overwrite"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
              >
                Overwrite Behavior
              </label>
              <select
                id="setting-overwrite"
                value={draft.overwrite}
                onChange={(e) =>
                  setDraft({ ...draft, overwrite: e.target.value as OverwriteMode })
                }
                className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-[#111419] border border-slate-300 dark:border-white/[0.12] text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="skip">Skip existing files</option>
                <option value="force">Force re-download</option>
                <option value="metadata">Update metadata</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="setting-restrict"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
              >
                Filename Character Set
              </label>
              <select
                id="setting-restrict"
                value={draft.restrict}
                onChange={(e) =>
                  setDraft({ ...draft, restrict: e.target.value as RestrictMode })
                }
                className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-[#111419] border border-slate-300 dark:border-white/[0.12] text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="none">Unicode (Windows safe)</option>
                <option value="ascii">ASCII only</option>
                <option value="strict">Strict alphanumeric</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="setting-separator"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
              >
                ID3 Artist Separator
              </label>
              <input
                id="setting-separator"
                type="text"
                value={draft.id3Separator}
                onChange={(e) => setDraft({ ...draft, id3Separator: e.target.value })}
                className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-[#111419] border border-slate-300 dark:border-white/[0.12] text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </section>
      </form>

      {/* Optional Official Spotify API Credentials */}
      <section className="p-5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#161920] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-500" />
              <span>Spotify Web API Credentials (Optional)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Free Mode works out-of-the-box without credentials. Add your own Spotify Developer Client ID & Secret to unlock playlists over 100 tracks and full ISRC metadata.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Active: {spotifyStatus.mode === 'official' ? `Web API (${spotifyStatus.clientIdPreview})` : 'Free Mode'}
          </span>
        </div>

        <form onSubmit={handleSpotifySubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label
              htmlFor="sp-client-id"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Client ID
            </label>
            <input
              id="sp-client-id"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Leave blank for Free Mode"
              className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-[#111419] border border-slate-300 dark:border-white/[0.12] text-xs font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="sp-client-secret"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Client Secret
            </label>
            <input
              id="sp-client-secret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-[#111419] border border-slate-300 dark:border-white/[0.12] text-xs font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={spotifySaving}
            className="h-9 px-4 rounded-lg border border-slate-300 dark:border-white/[0.12] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors"
          >
            {spotifySaving
              ? 'Verifying...'
              : clientId.trim()
              ? 'Verify & Enable API'
              : 'Use Free Mode'}
          </button>
        </form>

        {spotifyMsg && (
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {spotifyMsg}
          </div>
        )}
      </section>

      {/* Optional YouTube Cookies */}
      <section className="p-5 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#161920] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              YouTube Cookies (Optional)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              If YouTube requires sign-in verification on a cloud IP, paste Netscape-format `cookies.txt` content here for `yt-dlp`.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {cookiesConfigured ? 'Cookies active' : 'Not configured'}
          </span>
        </div>

        <textarea
          rows={3}
          value={cookiesText}
          onChange={(e) => setCookiesText(e.target.value)}
          placeholder="# Netscape HTTP Cookie File..."
          aria-label="YouTube cookies.txt content"
          className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-[#111419] border border-slate-300 dark:border-white/[0.12] font-mono text-xs text-slate-900 dark:text-slate-100"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {cookiesMsg || ''}
          </span>
          <div className="flex items-center gap-2">
            {cookiesConfigured && (
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/settings/cookies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: '' }),
                  });
                  setCookiesConfigured(false);
                  setCookiesText('');
                  setCookiesMsg('YouTube cookies cleared.');
                }}
                className="h-8 px-3 rounded-lg border border-slate-300 dark:border-white/[0.12] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                Clear Cookies
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                const res = await fetch('/api/settings/cookies', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: cookiesText }),
                });
                const d = await res.json();
                setCookiesConfigured(Boolean(d?.configured));
                setCookiesMsg(d?.configured ? 'Cookies saved for yt-dlp.' : 'Cookies cleared.');
              }}
              className="h-8 px-3.5 rounded-lg border border-slate-300 dark:border-white/[0.12] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-medium text-slate-800 dark:text-slate-200"
            >
              Save Cookies
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
