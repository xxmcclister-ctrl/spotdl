import { Music2 } from 'lucide-react';
import { useState } from 'react';

export const APP_ICON_ASSET = '/src/assets/images/spotdl_win_icon_1795385792435.jpg';
export const DESKTOP_WALLPAPER_ASSET = '/src/assets/images/win11_mica_wallpaper_1795385793130.jpg';

export function SpotdlMark({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="16" fill="#16191F" />
      <rect
        x="1.5"
        y="1.5"
        width="61"
        height="61"
        rx="14.5"
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="2"
      />
      <rect x="13" y="27" width="4.5" height="10" rx="2.25" fill="#1DB954" />
      <rect x="21.5" y="20" width="4.5" height="24" rx="2.25" fill="#1DB954" />
      <path
        d="M30 14a2.25 2.25 0 0 1 4.5 0v23l5-5a2.25 2.25 0 1 1 3.18 3.18l-8.84 8.84a2.25 2.25 0 0 1-3.18 0l-8.84-8.84A2.25 2.25 0 1 1 25 32l5 5V14z"
        fill="#1DB954"
      />
      <rect x="38" y="20" width="4.5" height="24" rx="2.25" fill="#1DB954" />
      <rect x="46.5" y="27" width="4.5" height="10" rx="2.25" fill="#1DB954" />
    </svg>
  );
}

export function SpotdlAppTile({ className = 'w-14 h-14' }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <SpotdlMark className={className} />;
  }

  return (
    <img
      src={APP_ICON_ASSET}
      alt="spotDL Studio application icon"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} rounded-2xl object-cover shadow-lg ring-1 ring-white/15`}
    />
  );
}

export function CoverArt({
  src,
  alt,
  className = 'w-10 h-10',
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        className={`${className} rounded-md bg-slate-200 dark:bg-white/[0.06] border border-slate-300/60 dark:border-white/[0.08] flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400`}
        aria-label={alt}
      >
        <Music2 className="w-4 h-4" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className={`${className} rounded-md object-cover shrink-0 bg-slate-200 dark:bg-white/[0.05] border border-slate-300/50 dark:border-white/[0.08]`}
    />
  );
}
