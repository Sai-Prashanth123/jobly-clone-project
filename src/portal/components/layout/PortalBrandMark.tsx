import { useAuth } from '../../hooks/useAuth';

// Single source of truth for the role→gradient mapping used by both this
// brand mark's fallback icon and PortalSidebar's footer user-avatar.
export const ROLE_GRADIENTS: Record<string, string> = {
  admin:      'from-[#4069FF] to-[#32CDDC]',
  hr:         'from-violet-500 to-purple-400',
  operations: 'from-amber-500 to-orange-400',
  finance:    'from-emerald-500 to-teal-400',
  employee:   'from-[#32CDDC] to-cyan-400',
};

interface PortalBrandMarkProps {
  /** Compact mode omits the "Jobly Portal" title + role caption — just the mark (used in the mobile top bar). */
  compact?: boolean;
}

// Logo + fallback "J" mark, shared by PortalSidebar's own header (inside the
// drawer) and PortalLayout's always-visible mobile top bar, so both stay in
// sync instead of drifting as two separate copies.
export function PortalBrandMark({ compact = false }: PortalBrandMarkProps) {
  const { user } = useAuth();
  const roleGradient = ROLE_GRADIENTS[user?.role ?? 'admin'];

  return (
    <div className="flex items-center gap-3 min-w-0">
      <img
        src="/assets/img/logo/logo-3.png"
        alt="Jobly"
        className={`${compact ? 'h-11' : 'h-8'} w-auto object-contain flex-shrink-0`}
        onError={e => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
      {/* Fallback icon if logo fails */}
      <div
        className={`hidden ${compact ? 'w-11 h-11' : 'w-8 h-8'} rounded-xl bg-gradient-to-br ${roleGradient} items-center justify-center flex-shrink-0`}
      >
        <span className={`text-white font-bold ${compact ? 'text-base' : 'text-xs'}`}>J</span>
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">Jobly Portal</p>
          <p className="text-xs text-gray-400 capitalize truncate">{user?.role ?? '—'}</p>
        </div>
      )}
    </div>
  );
}
