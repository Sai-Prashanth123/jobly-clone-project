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
      className={`${BOX[size]} rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center flex-shrink-0 ${className}`}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={name ? `${name}` : 'Profile photo'}
          className="w-full h-full object-cover"
        />
      ) : (
        <UserRound className={`${ICON[size]} text-blue-400`} aria-hidden />
      )}
    </div>
  );
}
