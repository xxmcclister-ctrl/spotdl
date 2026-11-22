import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createM3uContent,
  formatBytes,
  formatDuration,
  formatSongFilename,
  parseInputQuery,
  parseLrcTimestamps,
} from './formatter';
import type { SpotdlTrack } from './types';

const sampleTrack: SpotdlTrack = {
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
  isrc: 'GBARL8700052',
  publisher: 'RCA',
  explicit: false,
  cover_url: 'https://example.com/cover.jpg',
  url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
  source: 'spotify',
};

test('parseInputQuery detects Spotify URLs, URIs, YouTube URLs, and text queries', () => {
  const track = parseInputQuery('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=123');
  assert.deepEqual(track, {
    kind: 'spotify',
    entityType: 'track',
    id: '4cOdK2wGLETKBW3PvgPWqT',
    url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
  });

  const uri = parseInputQuery('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M');
  assert.equal(uri.kind, 'spotify');
  if (uri.kind === 'spotify') {
    assert.equal(uri.entityType, 'playlist');
    assert.equal(uri.id, '37i9dQZF1DXcBWIGoYBM5M');
  }

  const yt = parseInputQuery('https://music.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(yt.kind, 'youtube');

  const query = parseInputQuery('All Eyes On Me - Bo Burnham');
  assert.deepEqual(query, { kind: 'query', query: 'All Eyes On Me - Bo Burnham' });
});

test('formatSongFilename resolves template variables and sanitizes characters', () => {
  const filename = formatSongFilename(
    sampleTrack,
    '{track-number} - {artists} - {title}.{output-ext}',
    'mp3'
  );
  assert.equal(filename, '01 - Rick Astley - Never Gonna Give You Up.mp3');

  const asciiName = formatSongFilename(
    { ...sampleTrack, name: 'Café / Night: Mix?' },
    '{artists} - {title}.{output-ext}',
    'flac',
    'ascii'
  );
  assert.equal(asciiName, 'Rick Astley - Cafe Night Mix.flac');
});

test('formatDuration and formatBytes format numbers cleanly', () => {
  assert.equal(formatDuration(213), '3:33');
  assert.equal(formatDuration(3665), '1:01:05');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(4_500_000), '4.3 MB');
});

test('parseLrcTimestamps parses synced LRC lines in chronological order', () => {
  const lrc = '[00:18.50]We\'re no strangers to love\n[00:22.10]You know the rules and so do I';
  const parsed = parseLrcTimestamps(lrc);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].timeMs, 18500);
  assert.equal(parsed[0].text, "We're no strangers to love");
  assert.equal(parsed[1].timeMs, 22100);
});

test('createM3uContent emits valid EXTINF M3U playlist', () => {
  const m3u = createM3uContent([sampleTrack], '{artists} - {title}.{output-ext}', 'mp3');
  assert.match(m3u, /^#EXTM3U/);
  assert.match(m3u, /#EXTINF:213,Rick Astley - Never Gonna Give You Up/);
  assert.match(m3u, /Rick Astley - Never Gonna Give You Up\.mp3/);
});
