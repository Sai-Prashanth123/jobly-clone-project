import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface FormPageShellProps {
  /** Title shown next to the back arrow in the sticky navbar. */
  title: string;
  /** Where the back arrow / Cancel returns to. */
  backTo: string;
  /** Right-aligned action buttons (Cancel / Save …). */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Full-page form chrome, matching the HR "Add Employee" wizard
 * (NewEmployee.tsx): a sticky top navbar with a back link + title and a
 * right-aligned action slot, over a `portal-wizard` body of section cards.
 * Reused by every finance editor so they all look the same.
 */
export function FormPageShell({ title, backTo, actions, children }: FormPageShellProps) {
  return (
    <div className="portal-wizard pb-10">
      <div className="portal-wizard-navbar sticky top-0 z-30 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-3 mb-5 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 border-b border-gray-200 flex items-center justify-between gap-3">
        <Link to={backTo} className="inline-flex items-center gap-1.5 min-w-0">
          <ArrowLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-900 truncate">{title}</span>
        </Link>
        {actions && (
          <div className="flex flex-row flex-wrap items-center gap-2 flex-shrink-0">{actions}</div>
        )}
      </div>
      {children}
    </div>
  );
}
