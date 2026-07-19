// Shared "label above value" read-only field, used across every detail page
// (Employee/Client/Assignment detail, My Profile). Previously each page
// defined its own local `Field` copy — two of the four had drifted to be
// missing `break-words`/`overflow-wrap`, so a long unbroken value (e.g. an
// email) would overflow instead of wrapping at narrow mobile widths on those
// pages while wrapping fine on the other two. Consolidated here so all detail
// pages render identically and can't drift again.
export function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5 break-words [overflow-wrap:anywhere]">{value || '—'}</p>
    </div>
  );
}
