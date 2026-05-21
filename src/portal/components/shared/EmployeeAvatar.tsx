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

export function EmployeeAvatar({
  photoUrl,
  name,
  size = 'md',
  className = '',
}: {
  photoUrl?: string | null;
  name?: string;
  size?: Size;
  className?: string;
}) {
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
      ) : (
        <UserRound className={`${ICON[size]} text-blue-400`} aria-hidden />
      )}
    </div>
  );
}
