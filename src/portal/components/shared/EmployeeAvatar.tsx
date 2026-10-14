import { UserRound } from 'lucide-react';

// One avatar to rule them all. Shows the employee's profile photo when present,
// otherwise a neutral human silhouette ("default human photo") so an employee
// without an uploaded photo never renders as an empty/broken circle.

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const BOX: Record<Size, string> = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

const ICON: Record<Size, string> = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const TEXT: Record<Size, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-xl',
};

/** First letters of the first and last word of a name. "" when there is nothing to take. */
export function initialsOf(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

export function EmployeeAvatar({
  photoUrl,
  name,
  size = 'md',
  className = '',
  initials = false,
}: {
  photoUrl?: string | null;
  name?: string;
  size?: Size;
  className?: string;
  /**
   * Fall back to initials instead of the silhouette.
   *
   * The silhouette is right in a list where names sit beside it, but in a
   * dense grid — the org chart — a column of identical grey figures tells you
   * nothing, so initials carry more. Opt-in so existing callers are unchanged.
   *
   * Added because a third hand-rolled avatar had appeared by then (this one,
   * `AvatarCircle` in Documents.tsx, and one in OrgChart.tsx), which is the
   * same drift DetailField's header records having had to fix once already.
   */
  initials?: boolean;
}) {
  const text = initials ? initialsOf(name) : '';
  return (
    <div
      className={`${BOX[size]} rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 ${
        photoUrl ? 'bg-white ring-1 ring-gray-200' : 'bg-gradient-to-br from-blue-100 to-cyan-100'
      } ${className}`}
    >
      {photoUrl ? (
        // object-contain so the WHOLE image is visible (scaled to fit) instead
        // of being cropped to fill the circle — works for logos and any aspect.
        <img
          src={photoUrl}
          alt={name ? `${name}` : 'Profile photo'}
          className="w-full h-full object-contain"
        />
      ) : text ? (
        <span className={`${TEXT[size]} font-semibold text-blue-700`} aria-hidden>{text}</span>
      ) : (
        <UserRound className={`${ICON[size]} text-blue-400`} aria-hidden />
      )}
    </div>
  );
}
