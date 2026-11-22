import test from 'node:test';
import assert from 'node:assert/strict';
import { hasForbiddenWordMismatch, rankCandidates, scoreCandidate, selectBestMatch } from './matching';
import type { AudioCandidate, SpotdlTrack } from './types';

const track: SpotdlTrack = {
  song_id: '1',
  name: 'Blinding Lights',
  artists: ['The Weeknd'],
  artist: 'The Weeknd',
  album_name: 'After Hours',
  album_artist: 'The Weeknd',
  genres: ['Synth-pop'],
  disc_number: 1,
  disc_count: 1,
  year: 2020,
  date: '2020-03-20',
  track_number: 9,
  tracks_count: 14,
  duration: 200,
  explicit: false,
  url: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b',
  source: 'spotify',
};

test('hasForbiddenWordMismatch flags remix/slowed/live when not in original title', () => {
  assert.equal(hasForbiddenWordMismatch('Blinding Lights', 'Blinding Lights (Slowed + Reverb)'), true);
  assert.equal(hasForbiddenWordMismatch('Blinding Lights', 'Blinding Lights (Official Audio)'), false);
  assert.equal(hasForbiddenWordMismatch('Blinding Lights (Remix)', 'Blinding Lights (Club Remix)'), false);
});

test('selectBestMatch and rankCandidates prefer exact YouTube Music official match over remix', () => {
  const remixCandidate: AudioCandidate = {
    id: 'bad1',
    title: 'Blinding Lights (Bass Boosted Remix)',
    artists: ['DJ Random'],
    channelName: 'Remix Channel',
    duration: 245,
    url: 'https://youtube.com/watch?v=bad1',
    provider: 'youtube',
    verified: false,
    isTopic: false,
  };

  const officialCandidate: AudioCandidate = {
    id: 'good1',
    title: 'Blinding Lights',
    artists: ['The Weeknd'],
    channelName: 'The Weeknd - Topic',
    duration: 201,
    url: 'https://music.youtube.com/watch?v=good1',
    provider: 'youtube-music',
    verified: true,
    isTopic: true,
  };

  const ranked = rankCandidates(track, [remixCandidate, officialCandidate], true, false);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].best.id, 'good1');

  const selected = selectBestMatch(track, [remixCandidate, officialCandidate], true, false);
  assert.ok(selected);
  assert.equal(selected.best.id, 'good1');
  assert.ok(selected.score >= 85);
  assert.ok(scoreCandidate(track, officialCandidate) > scoreCandidate(track, remixCandidate));
});
