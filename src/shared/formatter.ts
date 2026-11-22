import type { LrcLine, RestrictMode, SpotdlTrack } from './types';

export const OUTPUT_TEMPLATE_VARIABLES = [
  '{title}',
  '{artists}',
  '{artist}',
  '{album}',
  '{album-artist}',
  '{genre}',
  '{disc-number}',
  '{disc-count}',
  '{duration}',
  '{year}',
  '{original-date}',
  '{track-number}',
  '{tracks-count}',
  '{isrc}',
  '{track-id}',
  '{publisher}',
  '{list-length}',
  '{list-position}',
  '{list-name}',
  '{output-ext}',
] as const;

export type ParsedQueryKind =
  | { kind: 'spotify'; entityType: 'track' | 'album' | 'playlist' | 'artist'; id: string; url: string }
  | { kind: 'youtube'; isPlaylist: boolean; id: string; url: string }
  | { kind: 'query'; query: string };

export function parseInputQuery(rawInput: string): ParsedQueryKind {
  const input = rawInput.trim();

  // spotify:track:xxx URIs
  const uriMatch = input.match(/^spotify:(track|album|playlist|artist):([A-Za-z0-9]+)$/i);
  if (uriMatch) {
    const entityType = uriMatch[1].toLowerCase() as 'track' | 'album' | 'playlist' | 'artist';
    const id = uriMatch[2];
    return {
      kind: 'spotify',
      entityType,
      id,
      url: `https://open.spotify.com/${entityType}/${id}`,
    };
  }

  // https://open.spotify.com/(intl-xx/)?track|album|playlist|artist/<id>
  const spotifyUrlMatch = input.match(
    /https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist)\/([A-Za-z0-9]+)/i
  );
  if (spotifyUrlMatch) {
    const entityType = spotifyUrlMatch[1].toLowerCase() as 'track' | 'album' | 'playlist' | 'artist';
    const id = spotifyUrlMatch[2];
    return {
      kind: 'spotify',
      entityType,
      id,
      url: `https://open.spotify.com/${entityType}/${id}`,
    };
  }

  // YouTube / YouTube Music URLs
  const ytMatch = input.match(
    /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)\/([^\s]+)/i
  );
  if (ytMatch) {
    try {
      const parsed = new URL(input);
      const listId = parsed.searchParams.get('list');
      const vId = parsed.searchParams.get('v') || (parsed.hostname.includes('youtu.be') ? parsed.pathname.slice(1) : '');
      if (listId && !vId) {
        return { kind: 'youtube', isPlaylist: true, id: listId, url: input };
      }
      return { kind: 'youtube', isPlaylist: false, id: vId || listId || input, url: input };
    } catch {
      return { kind: 'youtube', isPlaylist: false, id: input, url: input };
    }
  }

  return { kind: 'query', query: input };
}

export function sanitizeFilenameSegment(value: string, restrict: RestrictMode = 'none'): string {
  // Replace filesystem-unsafe characters matching spotdl sanitize_string
  let cleaned = value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (restrict === 'ascii') {
    cleaned = cleaned.normalize('NFKD').replace(/[^\x20-\x7E]/g, '');
  } else if (restrict === 'strict') {
    cleaned = cleaned
      .normalize('NFKD')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/[^a-zA-Z0-9\-_. ()]/g, '');
  }

  return cleaned.replace(/\.+$/, '').trim() || 'Unknown';
}

export function formatSongFilename(
  track: SpotdlTrack,
  template: string,
  outputExt: string,
  restrict: RestrictMode = 'none',
  maxLength: number | null = 200
): string {
  const safeTemplate = template.trim() || '{artists} - {title}.{output-ext}';
  const artistsJoined = track.artists.length > 0 ? track.artists.join(', ') : track.artist || 'Unknown Artist';
  const primaryArtist = track.artists[0] || track.artist || 'Unknown Artist';

  const pad2 = (n: number | null | undefined) =>
    String(Math.max(0, n ?? 0)).padStart(2, '0');

  const replacements: Record<string, string> = {
    '{title}': track.name || 'Untitled',
    '{artists}': artistsJoined,
    '{artist}': primaryArtist,
    '{album}': track.album_name || 'Single',
    '{album-artist}': track.album_artist || primaryArtist,
    '{genre}': track.genres[0] || 'Music',
    '{disc-number}': String(track.disc_number || 1),
    '{disc-count}': String(track.disc_count || 1),
    '{duration}': String(Math.round(track.duration || 0)),
    '{year}': String(track.year || new Date().getFullYear()),
    '{original-date}': track.date || String(track.year || ''),
    '{track-number}': pad2(track.track_number || 1),
    '{tracks-count}': pad2(track.tracks_count || 1),
    '{isrc}': track.isrc || '',
    '{track-id}': track.song_id || '',
    '{publisher}': track.publisher || '',
    '{list-length}': String(track.list_length ?? 1),
    '{list-position}': pad2(track.list_position ?? track.track_number ?? 1),
    '{list-name}': track.list_name || track.album_name || 'Playlist',
    '{output-ext}': outputExt.replace(/^\./, ''),
  };

  let result = safeTemplate;
  for (const [token, rawVal] of Object.entries(replacements)) {
    const safeVal = token === '{output-ext}' ? rawVal : sanitizeFilenameSegment(rawVal, restrict);
    result = result.split(token).join(safeVal);
  }

  // Flatten directory separators into safe flat filename for web download storage
  const flatName = result
    .split(/[\\/]+/)
    .map((part) => sanitizeFilenameSegment(part, restrict))
    .filter(Boolean)
    .join(' - ');

  const expectedSuffix = `.${outputExt.replace(/^\./, '')}`;
  let finalName = flatName.toLowerCase().endsWith(expectedSuffix.toLowerCase())
    ? flatName
    : `${flatName}${expectedSuffix}`;

  if (maxLength && maxLength > 16 && finalName.length > maxLength) {
    const stem = finalName.slice(0, maxLength - expectedSuffix.length).trim();
    finalName = `${stem}${expectedSuffix}`;
  }

  return finalName;
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const mins = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx++;
  }
  return `${value >= 10 || unitIdx === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIdx]}`;
}

export function parseLrcTimestamps(lrc: string): LrcLine[] {
  const lines: LrcLine[] = [];
  const pattern = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\](.*)/;

  for (const rawLine of lrc.split(/\r?\n/)) {
    const match = rawLine.match(pattern);
    if (!match) continue;
    const min = Number(match[1]);
    const sec = Number(match[2]);
    const fracRaw = match[3] || '0';
    const ms = fracRaw.length === 3 ? Number(fracRaw) : fracRaw.length === 2 ? Number(fracRaw) * 10 : Number(fracRaw) * 100;
    const text = match[4].trim();
    if (!Number.isFinite(min) || !Number.isFinite(sec)) continue;
    lines.push({
      timeMs: min * 60_000 + sec * 1_000 + ms,
      text: text || '♪',
    });
  }

  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

export function createM3uContent(
  tracks: SpotdlTrack[],
  template: string,
  outputExt: string,
  restrict: RestrictMode = 'none'
): string {
  const lines = ['#EXTM3U'];
  for (const track of tracks) {
    const duration = Math.round(track.duration || 0);
    const artist = track.album_artist || track.artists[0] || track.artist || 'Unknown Artist';
    lines.push(`#EXTINF:${duration},${artist} - ${track.name}`);
    lines.push(formatSongFilename(track, template, outputExt, restrict));
  }
  return `${lines.join('\n')}\n`;
}

export function createSpotdlSaveFile(tracks: SpotdlTrack[]): string {
  return JSON.stringify(tracks, null, 2);
}
