import type { AudioCandidate, SpotdlTrack } from './types';

export const FORBIDDEN_WORDS = [
  'bassboosted',
  'remix',
  'remastered',
  'remaster',
  'reverb',
  'bassboost',
  'live',
  'acoustic',
  '8daudio',
  'concert',
  'acapella',
  'slowed',
  'instrumental',
  'cover',
  'karaoke',
] as const;

export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenSimilarity(a: string, b: string): number {
  const normA = normalizeSlug(a);
  const normB = normalizeSlug(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 100;

  const setA = new Set(normA.split(' ').filter(Boolean));
  const setB = new Set(normB.split(' ').filter(Boolean));
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // Substring containment boost when one title embeds the other cleanly
  const containsBoost = normA.includes(normB) || normB.includes(normA) ? 0.2 : 0;
  return Math.min(100, Math.round((jaccard + containsBoost) * 100));
}

export function hasForbiddenWordMismatch(trackTitle: string, candidateTitle: string): boolean {
  const normTrack = normalizeSlug(trackTitle);
  const normCandidate = normalizeSlug(candidateTitle);
  for (const word of FORBIDDEN_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(normCandidate) && !regex.test(normTrack)) {
      return true;
    }
  }
  return false;
}

export function calcDurationScore(trackDurationSec: number, candidateDurationSec: number): number {
  if (!trackDurationSec || !candidateDurationSec) return 50;
  const diff = Math.abs(trackDurationSec - candidateDurationSec);
  if (diff <= 3) return 100;
  if (diff <= 10) return 90;
  if (diff <= 20) return 70;
  if (diff <= 35) return 45;
  return 10;
}

export function scoreCandidate(
  track: SpotdlTrack,
  candidate: AudioCandidate,
  filterResults = true
): number {
  const titleSim = tokenSimilarity(track.name, candidate.title);
  const fullTarget = `${track.artists.join(' ')} ${track.name}`;
  const fullCandidate = `${candidate.artists.join(' ')} ${candidate.channelName} ${candidate.title}`;
  const fullSim = tokenSimilarity(fullTarget, fullCandidate);

  // Artist overlap
  const normCandidateWhole = normalizeSlug(fullCandidate);
  let artistMatches = 0;
  for (const artist of track.artists) {
    const normArtist = normalizeSlug(artist);
    if (normArtist && normCandidateWhole.includes(normArtist)) {
      artistMatches++;
    }
  }
  const artistScore =
    track.artists.length > 0 ? Math.round((artistMatches / track.artists.length) * 100) : 50;

  const timeScore = calcDurationScore(track.duration, candidate.duration);

  // Weighted spotDL-style match composite
  let score = titleSim * 0.35 + artistScore * 0.3 + fullSim * 0.15 + timeScore * 0.2;

  if (candidate.provider === 'youtube-music') score += 6;
  if (candidate.isTopic) score += 5;
  if (candidate.verified) score += 3;

  if (filterResults && hasForbiddenWordMismatch(track.name, candidate.title)) {
    score -= 35;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function rankCandidates(
  track: SpotdlTrack,
  candidates: AudioCandidate[],
  filterResults = true,
  onlyVerified = false
): { best: AudioCandidate; score: number }[] {
  const pool = onlyVerified ? candidates.filter((c) => c.verified || c.isTopic) : candidates;
  const usable = pool.length > 0 ? pool : candidates;
  return usable
    .map((candidate) => ({
      best: candidate,
      score: scoreCandidate(track, candidate, filterResults),
    }))
    .sort((a, b) => b.score - a.score);
}

export function selectBestMatch(
  track: SpotdlTrack,
  candidates: AudioCandidate[],
  filterResults = true,
  onlyVerified = false
): { best: AudioCandidate; score: number } | null {
  const ranked = rankCandidates(track, candidates, filterResults, onlyVerified);
  return ranked[0] ?? null;
}
