import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, AlertCircle, Info, Calendar, BookOpen, Pin, PinOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '../components/shared/PageHeader';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { UsDateInput } from '../components/shared/UsDateInput';
import { useAuth } from '../hooks/useAuth';
import {
  useAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
  useMarkAnnouncementsSeen,
} from '../hooks/useAnnouncements';
import type { Announcement, AnnouncementType, UserRole } from '../types';

const TYPE_OPTIONS: { value: AnnouncementType; label: string; icon: React.ReactNode; pill: string }[] = [
  { value: 'info',   label: 'Info',   icon: <Info className="h-3.5 w-3.5" />,         pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'urgent', label: 'Urgent', icon: <AlertCircle className="h-3.5 w-3.5" />,  pill: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'event',  label: 'Event',  icon: <Calendar className="h-3.5 w-3.5" />,     pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'policy', label: 'Policy', icon: <BookOpen className="h-3.5 w-3.5" />,     pill: 'bg-purple-50 text-purple-700 border-purple-200' },
];

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin',      label: 'Admin' },
  { value: 'hr',         label: 'HR' },
  { value: 'operations', label: 'Operations' },
  { value: 'finance',    label: 'Finance' },
  { value: 'employee',   label: 'Employee' },
];

const BORDER: Record<AnnouncementType, string> = {
  urgent: 'border-l-red-400',
  info:   'border-l-blue-400',
  event:  'border-l-emerald-400',
  policy: 'border-l-purple-400',
};

function typeCfg(type: AnnouncementType) {
  return TYPE_OPTIONS.find(t => t.value === type)!;
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface FormState {
  title: string;
  body: string;
  type: AnnouncementType;
  isPinned: boolean;
  targetRoles: UserRole[];
  expiresAt: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  body: '',
  type: 'info',
  isPinned: false,
  targetRoles: [],
  expiresAt: '',
};

export default function Announcements() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'hr';
  const todayIso = new Date().toISOString().slice(0, 10);

  const [typeFilter, setTypeFilter] = useState<AnnouncementType | 'all'>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, isFetching, refetch } = useAnnouncements({
    type: typeFilter === 'all' ? undefined : typeFilter,
    page,
    limit: 20,
  });
  const items = data?.data ?? [];
  const total = data?.total ?? 0;

  const create = useCreateAnnouncement();
  const update = useUpdateAnnouncement();
  const remove = useDeleteAnnouncement();
  const markSeen = useMarkAnnouncementsSeen();

  // Clear unread badge the moment the user opens this page
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { markSeen.mutate(); }, []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(ann: Announcement) {
    setEditing(ann);
    setForm({
      title: ann.title,
      body: ann.body,
      type: ann.type,
      isPinned: ann.isPinned,
      targetRoles: ann.targetRoles as UserRole[],
      expiresAt: ann.expiresAt ? ann.expiresAt.slice(0, 10) : '',
    });
    setDialogOpen(true);
  }

  function toggleRole(role: UserRole) {
    setForm(f => ({
      ...f,
      targetRoles: f.targetRoles.includes(role)
        ? f.targetRoles.filter(r => r !== role)
        : [...f.targetRoles, role],
    }));
  }

  async function handleSave() {
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      type: form.type,
      isPinned: form.isPinned,
      targetRoles: form.targetRoles,
      expiresAt: form.expiresAt || null,
    };
    if (!payload.title || !payload.body) {
      toast.error('Title and body are required.');
      return;
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
        toast.success('Announcement updated.');
      } else {
        await create.mutateAsync(payload);
        toast.success('Announcement created.');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Failed to save announcement.');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success('Announcement deleted.');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete.');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Company"
        title="Announcements"
        description="Company-wide notices, events, and policy updates."
        action={
          canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Announcement
            </Button>
          ) : undefined
        }
        onRefresh={refetch}
        isRefreshing={isFetching}
      />

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'info', 'urgent', 'event', 'policy'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTypeFilter(t); setPage(1); }}
            className={`text-[12px] font-medium px-3 py-1 rounded-full border transition-colors ${
              typeFilter === t
                ? 'bg-[#4069FF] text-white border-[#4069FF]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#4069FF] hover:text-[#4069FF]'
            }`}
          >
            {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-500">Failed to load announcements. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="portal-panel h-20 animate-pulse bg-gray-50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="portal-panel p-10 text-center text-gray-400">
          <p className="text-sm">No announcements yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map(ann => {
            const cfg = typeCfg(ann.type);
            return (
              <li key={ann.id} className={`portal-panel border-l-4 ${BORDER[ann.type]}`}>
                <div className="portal-panel-body flex flex-col sm:flex-row items-start gap-3">
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {ann.isPinned && <Pin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />}
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${cfg.pill}`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                      {ann.targetRoles.length > 0 && (
                        <span className="text-[10px] text-gray-400">
                          → {ann.targetRoles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}
                        </span>
                      )}
                      {ann.expiresAt && (
                        <span className="text-[10px] text-amber-500">
                          Expires {formatDateShort(ann.expiresAt)}
                        </span>
                      )}
                    </div>
                    <h3 className="text-[14px] font-semibold text-gray-800 mb-0.5 break-words">{ann.title}</h3>
                    <p className="text-[13px] text-gray-600 whitespace-pre-line break-words">{ann.body}</p>
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      {ann.author?.name ?? 'System'} · {formatDateShort(ann.createdAt)}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 flex-shrink-0 self-end sm:self-start">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ann)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => setDeleteTarget(ann)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-gray-500">{total} total</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Announcement' : 'New Announcement'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Announcement title"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Body *</Label>
              <Textarea
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Announcement content…"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as AnnouncementType }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Expires (optional)</Label>
                <UsDateInput
                  value={form.expiresAt}
                  onChange={iso => setForm(f => ({ ...f, expiresAt: iso }))}
                  min={todayIso}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Target Roles <span className="text-gray-400 font-normal">(empty = all roles)</span></Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleRole(r.value)}
                    className={`text-[12px] px-2.5 py-1 rounded-full border transition-colors ${
                      form.targetRoles.includes(r.value)
                        ? 'bg-[#4069FF] text-white border-[#4069FF]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="pinned"
                checked={form.isPinned}
                onCheckedChange={v => setForm(f => ({ ...f, isPinned: v }))}
              />
              <Label htmlFor="pinned" className="cursor-pointer flex items-center gap-1.5">
                {form.isPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5 text-gray-400" />}
                Pin to top
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={create.isPending || update.isPending}
            >
              {editing ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Delete announcement?"
        description={`"${deleteTarget?.title}" will be removed permanently.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={remove.isPending}
      />
    </div>
  );
}
