import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Loader2, Plus, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  usePermissionEditor, useSetGrant, useCreateRole, useCreateCustomPermission,
  type Permission, type Grant,
} from '../../hooks/usePermissions';

/**
 * The role-permission matrix, editable.
 *
 * It replaces a hardcoded 28-row table that was never wired to anything — and
 * that DISAGREED with the code in both directions: it showed Activity Logs as
 * admin-only where the routes admit HR, and omitted HR from reports where the
 * routes allow it. What is shown here is read from the server, which is seeded
 * from what the routes actually enforce, so the screen tells the truth before
 * anybody changes anything.
 *
 * Grouped by area and collapsed by default. There are 127 permissions, more
 * than the 28 rows the old table implied, because collapsing further would
 * have moved somebody's access: where routes under one heading have genuinely
 * different audiences they keep separate keys rather than being averaged into
 * one tick.
 *
 * Saves on click rather than behind a Save button. Each tick is one request
 * the server can refuse on its own terms — it rejects removing the last admin
 * grant — and a batch would have to explain a partial failure. The toast
 * reports what actually happened.
 */

const ROLE_ORDER = ['admin', 'hr', 'operations', 'finance', 'legal', 'employee'];

export function RolePermissionsMatrix() {
  const { data, isLoading, isError } = usePermissionEditor();
  const setGrant = useSetGrant();
  const createRole = useCreateRole();
  const createPermission = useCreateCustomPermission();

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [roleOpen, setRoleOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const roles = useMemo(() => {
    const rows = data?.roles ?? [];
    return [...rows].sort((a, b) => {
      const ai = ROLE_ORDER.indexOf(a.key), bi = ROLE_ORDER.indexOf(b.key);
      // Built-ins in their familiar order, custom roles after them.
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.key.localeCompare(b.key);
    });
  }, [data]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, Permission[]>();
    for (const p of data?.permissions ?? []) {
      if (!byGroup.has(p.group_name)) byGroup.set(p.group_name, []);
      byGroup.get(p.group_name)!.push(p);
    }
    return [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  const grantIndex = useMemo(() => {
    const s = new Set<string>();
    for (const g of data?.grants ?? []) if (g.granted) s.add(`${g.role_key}\u0000${g.permission_key}`);
    return s;
  }, [data]);

  const toggle = (role: string, permission: string, next: boolean) => {
    const id = `${role}\u0000${permission}`;
    setPending(id);
    setGrant.mutate(
      { role_key: role, permission_key: permission, granted: next } as Grant,
      {
        onSuccess: () => toast.success(`${next ? 'Granted' : 'Removed'} ${permission} for ${role}`),
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { error?: string } } };
          toast.error(e.response?.data?.error ?? 'That change could not be saved.');
        },
        onSettled: () => setPending(null),
      },
    );
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading permissions…
    </div>;
  }

  if (isError || !data) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-900">Permissions could not be loaded.</p>
        <p className="text-xs text-amber-800 mt-1">
          Access is unaffected — every route falls back to the rules built into the
          application when this table cannot be read.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground max-w-2xl">
          These are the permissions the API enforces. A change takes effect on the next
          request — no sign-out needed. {data.permissions.length} permissions across{' '}
          {groups.length} areas.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRoleOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New role
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPermOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New permission
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {groups.map(([group, perms]) => {
          const open = openGroups.has(group);
          return (
            <div key={group} className="rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenGroups(s => {
                  const n = new Set(s);
                  if (n.has(group)) n.delete(group); else n.add(group);
                  return n;
                })}
                aria-expanded={open}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`} />
                  {group}
                </span>
                <span className="text-[11px] text-gray-500">{perms.length}</span>
              </button>

              {open && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-t border-gray-100">
                        <th className="text-left px-4 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Permission</th>
                        {roles.map(r => (
                          <th key={r.key} className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-center whitespace-nowrap">
                            {r.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {perms.map(p => (
                        <tr key={p.key} className="border-t border-gray-100 hover:bg-gray-50/60">
                          <td className="px-4 py-2">
                            <span className="text-sm text-gray-900">{p.label}</span>
                            <span className="block text-[10px] font-mono text-gray-400">{p.key}</span>
                            {p.is_custom && (
                              <span className="inline-block mt-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                                Custom — not yet used by any screen
                              </span>
                            )}
                          </td>
                          {roles.map(r => {
                            const id = `${r.key}\u0000${p.key}`;
                            const on = grantIndex.has(id);
                            return (
                              <td key={r.key} className="px-3 py-2 text-center">
                                {pending === id
                                  ? <Loader2 className="h-4 w-4 animate-spin text-gray-400 mx-auto" />
                                  : <Checkbox
                                      checked={on}
                                      onCheckedChange={v => toggle(r.key, p.key, v === true)}
                                      aria-label={`${p.label} for ${r.label}`}
                                    />}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <NewRoleDialog
        open={roleOpen}
        onOpenChange={setRoleOpen}
        onSubmit={(v) => createRole.mutate(v, {
          onSuccess: () => { toast.success(`Role '${v.label}' created.`); setRoleOpen(false); },
          onError: (e: unknown) => toast.error(
            (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Could not create that role.',
          ),
        })}
        busy={createRole.isPending}
      />

      <NewPermissionDialog
        open={permOpen}
        onOpenChange={setPermOpen}
        onSubmit={(v) => createPermission.mutate(v, {
          onSuccess: () => { toast.success(`Permission '${v.key}' created.`); setPermOpen(false); },
          onError: (e: unknown) => toast.error(
            (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Could not create that permission.',
          ),
        })}
        busy={createPermission.isPending}
      />
    </div>
  );
}

function NewRoleDialog({
  open, onOpenChange, onSubmit, busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (v: { key: string; label: string }) => void;
  busy: boolean;
}) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader><DialogTitle>New role</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Regional Manager" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Key</Label>
            <Input
              value={key}
              onChange={e => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="regional_manager"
              className="font-mono text-sm"
            />
          </div>
          {/* The constraint people most need to know, before they create one. */}
          <div className="flex gap-2 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2">
            <ShieldAlert className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-900">
              A new role starts with no permissions. Nobody can be assigned to it until
              a developer adds it to the sign-in roles, so creating one changes nothing
              on its own.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!key || !label || busy} loading={busy} onClick={() => onSubmit({ key, label })}>
            Create role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewPermissionDialog({
  open, onOpenChange, onSubmit, busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (v: { key: string; label: string; group_name: string }) => void;
  busy: boolean;
}) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [group, setGroup] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader><DialogTitle>New permission</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Key</Label>
            <Input value={key} onChange={e => setKey(e.target.value)} placeholder="payroll.export" className="font-mono text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Export payroll data" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Area</Label>
            <Input value={group} onChange={e => setGroup(e.target.value)} placeholder="Payroll" />
          </div>
          {/* Said plainly, because the opposite belief is the dangerous one. */}
          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <ShieldAlert className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-900">
              A new permission does nothing until a developer uses this key in the
              code. Creating it and ticking boxes will not restrict or allow anything
              by itself.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!key || !label || !group || busy} loading={busy}
                  onClick={() => onSubmit({ key, label, group_name: group })}>
            Create permission
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
