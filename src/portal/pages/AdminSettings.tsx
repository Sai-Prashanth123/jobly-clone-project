import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Shield, Activity, Database, KeyRound, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/shared/PageHeader';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import {
  usePortalUsers,
  useUpdateUserRole,
  useDeactivateUser,
  useResetUserPassword,
  useActivityLogs,
} from '../hooks/useAdmin';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../lib/utils';

// ── Role badge ────────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  admin:      'bg-purple-100 text-purple-800 border-purple-200',
  hr:         'bg-violet-100 text-violet-800 border-violet-200',
  operations: 'bg-amber-100 text-amber-800 border-amber-200',
  finance:    'bg-emerald-100 text-emerald-800 border-emerald-200',
  employee:   'bg-blue-100 text-blue-800 border-blue-200',
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-700'}`}>
      {role}
    </span>
  );
}

// ── Action badge ──────────────────────────────────────────────────────────────
const ACTION_COLORS: Record<string, string> = {
  created:        'bg-green-100 text-green-700',
  updated:        'bg-blue-100 text-blue-700',
  deleted:        'bg-red-100 text-red-700',
  status_changed: 'bg-amber-100 text-amber-700',
};

// ── Permission Matrix ─────────────────────────────────────────────────────────
const PERMISSIONS = [
  { feature: 'Dashboard',                admin: true,  hr: true,  ops: true,  fin: true,  emp: true  },
  { feature: 'View Employees',           admin: true,  hr: true,  ops: true,  fin: false, emp: false },
  { feature: 'Create/Edit Employees',    admin: true,  hr: true,  ops: false, fin: false, emp: false },
  { feature: 'Delete Employees',         admin: true,  hr: false, ops: false, fin: false, emp: false },
  { feature: 'Approve Onboarding',       admin: true,  hr: true,  ops: false, fin: false, emp: false },
  { feature: 'View Clients',             admin: true,  hr: false, ops: true,  fin: true,  emp: false },
  { feature: 'Create/Edit Clients',      admin: true,  hr: false, ops: true,  fin: false, emp: false },
  { feature: 'Delete Clients',           admin: true,  hr: false, ops: false, fin: false, emp: false },
  { feature: 'View Assignments',         admin: true,  hr: false, ops: true,  fin: false, emp: true  },
  { feature: 'Create/Edit Assignments',  admin: true,  hr: false, ops: true,  fin: false, emp: false },
  { feature: 'View Timesheets',          admin: true,  hr: true,  ops: true,  fin: true,  emp: true  },
  { feature: 'Submit Timesheets',        admin: true,  hr: false, ops: false, fin: false, emp: true  },
  { feature: 'Approve Timesheets',       admin: true,  hr: true,  ops: true,  fin: true,  emp: false },
  { feature: 'View Invoices',            admin: true,  hr: false, ops: false, fin: true,  emp: false },
  { feature: 'Generate Invoices',        admin: true,  hr: false, ops: false, fin: true,  emp: false },
  { feature: 'Send Invoices',            admin: true,  hr: false, ops: false, fin: true,  emp: false },
  { feature: 'Update Invoice Status',    admin: true,  hr: false, ops: false, fin: true,  emp: false },
  { feature: 'View Reports',             admin: true,  hr: false, ops: true,  fin: true,  emp: false },
  { feature: 'Upload Documents',         admin: true,  hr: true,  ops: true,  fin: false, emp: false },
  { feature: 'Admin Settings',           admin: true,  hr: false, ops: false, fin: false, emp: false },
  { feature: 'User Management',          admin: true,  hr: false, ops: false, fin: false, emp: false },
  { feature: 'Activity Logs',            admin: true,  hr: false, ops: false, fin: false, emp: false },
];

// ── Data Retention Policies ───────────────────────────────────────────────────
const RETENTION_POLICIES = [
  { category: 'Employee Records',       retention: '7 years after termination',  legal: 'FLSA / IRS requirements',   risk: 'high' },
  { category: 'Payroll & Tax Records',  retention: '7 years',                    legal: 'IRS § 6001',                risk: 'high' },
  { category: 'Timesheet Records',      retention: '3 years',                    legal: 'FLSA § 11(c)',              risk: 'medium' },
  { category: 'Invoice & Billing',      retention: '7 years',                    legal: 'SOX / IRS',                 risk: 'high' },
  { category: 'Activity / Audit Logs',  retention: '2 years',                    legal: 'Internal compliance',       risk: 'medium' },
  { category: 'Documents & Files',      retention: '5 years',                    legal: 'Contract & audit purposes', risk: 'medium' },
  { category: 'Notification History',   retention: '90 days',                    legal: 'Operational records',       risk: 'low' },
  { category: 'Visa / Immigration',     retention: '3 years after I-9',          legal: 'INA 8 CFR 274a.2',         risk: 'high' },
];

const RISK_COLORS: Record<string, string> = {
  high:   'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low:    'bg-green-100 text-green-700 border-green-200',
};

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const { user: currentUser } = useAuth();
  const { data: users = [], isLoading } = usePortalUsers();
  const updateRole = useUpdateUserRole();
  const deactivate = useDeactivateUser();
  const resetPwd = useResetUserPassword();
  const [deactivateTarget, setDeactivateTarget] = useState<string | null>(null);
  const [newPwdResult, setNewPwdResult] = useState<{ name: string; password: string } | null>(null);

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(['admin','hr','operations','finance','employee'] as const).map(role => {
          const count = users.filter(u => u.role === role).length;
          return (
            <Card key={role}>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground capitalize mt-1">{role}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Portal Users ({users.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">User</TableHead>
                  <TableHead className="font-semibold">Current Role</TableHead>
                  <TableHead className="font-semibold">Change Role</TableHead>
                  <TableHead className="font-semibold">Joined</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell><RoleBadge role={u.role} /></TableCell>
                    <TableCell>
                      {u.id !== currentUser?.id ? (
                        <Select
                          value={u.role}
                          onValueChange={async (role) => {
                            try {
                              await updateRole.mutateAsync({ userId: u.id, role });
                              toast.success(`${u.name}'s role updated to ${role}`);
                            } catch (err: any) {
                              toast.error(err?.response?.data?.error ?? 'Failed to update role');
                            }
                          }}
                        >
                          <SelectTrigger className="w-36 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="hr">HR</SelectItem>
                            <SelectItem value="operations">Operations</SelectItem>
                            <SelectItem value="finance">Finance</SelectItem>
                            <SelectItem value="employee">Employee</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground">(you)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          disabled={resetPwd.isPending}
                          onClick={async () => {
                            try {
                              const pwd = await resetPwd.mutateAsync(u.id);
                              setNewPwdResult({ name: u.name, password: pwd });
                            } catch (err: any) {
                              toast.error(err?.response?.data?.error ?? 'Failed to reset password');
                            }
                          }}
                        >
                          <KeyRound className="h-3 w-3" />
                          Reset
                        </Button>
                        {u.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-red-600 hover:bg-red-50"
                            onClick={() => setDeactivateTarget(u.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Deactivate confirm */}
      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={v => { if (!v) setDeactivateTarget(null); }}
        title="Remove Portal User?"
        description="This will permanently remove the user's login access. Their employee record will remain intact."
        confirmLabel="Remove Access"
        onConfirm={async () => {
          if (!deactivateTarget) return;
          try {
            await deactivate.mutateAsync(deactivateTarget);
            toast.success('User access removed');
            setDeactivateTarget(null);
          } catch (err: any) {
            toast.error(err?.response?.data?.error ?? 'Failed to remove user');
          }
        }}
      />

      {/* New password dialog */}
      <Dialog open={!!newPwdResult} onOpenChange={v => { if (!v) setNewPwdResult(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Password Reset</DialogTitle>
            <DialogDescription>Share this temporary password with {newPwdResult?.name}. They should change it immediately after logging in.</DialogDescription>
          </DialogHeader>
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-muted-foreground mb-1">Temporary Password</p>
            <p className="text-xl font-bold font-mono tracking-widest text-blue-700">{newPwdResult?.password}</p>
          </div>
          <Button onClick={() => setNewPwdResult(null)}>Done</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Activity Logs Tab ─────────────────────────────────────────────────────────
function ActivityLogsTab() {
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading } = useActivityLogs({
    entityType: entityType || undefined,
    action: action || undefined,
    page,
    limit,
  });

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={entityType || '_all'} onValueChange={v => { setEntityType(v === '_all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="All entities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Entities</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="assignment">Assignment</SelectItem>
            <SelectItem value="timesheet">Timesheet</SelectItem>
            <SelectItem value="invoice">Invoice</SelectItem>
          </SelectContent>
        </Select>
        <Select value={action || '_all'} onValueChange={v => { setAction(v === '_all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Actions</SelectItem>
            <SelectItem value="created">Created</SelectItem>
            <SelectItem value="updated">Updated</SelectItem>
            <SelectItem value="deleted">Deleted</SelectItem>
            <SelectItem value="status_changed">Status Changed</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center">{total} total entries</span>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Time</TableHead>
                    <TableHead className="font-semibold">Actor</TableHead>
                    <TableHead className="font-semibold">Action</TableHead>
                    <TableHead className="font-semibold">Entity</TableHead>
                    <TableHead className="font-semibold">Record</TableHead>
                    <TableHead className="font-semibold">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('en-US', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        {log.actorName ? (
                          <div>
                            <p className="text-xs font-medium">{log.actorName}</p>
                            <RoleBadge role={log.actorRole ?? 'unknown'} />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">System</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                          {log.action.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs capitalize text-muted-foreground">{log.entityType}</TableCell>
                      <TableCell className="text-xs font-mono text-blue-600">{log.entityLabel ?? log.entityId.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {log.metadata ? JSON.stringify(log.metadata) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No activity logs found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages} ({total} entries)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Role Permissions Tab ──────────────────────────────────────────────────────
function PermissionsTab() {
  const Check = () => <span className="text-green-600 font-bold text-base">✓</span>;
  const Cross = () => <span className="text-gray-200 text-base">—</span>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-500" />
          Role Permissions Matrix
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Feature / Permission</TableHead>
                <TableHead className="text-center font-semibold"><RoleBadge role="admin" /></TableHead>
                <TableHead className="text-center font-semibold"><RoleBadge role="hr" /></TableHead>
                <TableHead className="text-center font-semibold"><RoleBadge role="operations" /></TableHead>
                <TableHead className="text-center font-semibold"><RoleBadge role="finance" /></TableHead>
                <TableHead className="text-center font-semibold"><RoleBadge role="employee" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSIONS.map(p => (
                <TableRow key={p.feature}>
                  <TableCell className="text-sm font-medium">{p.feature}</TableCell>
                  <TableCell className="text-center">{p.admin ? <Check /> : <Cross />}</TableCell>
                  <TableCell className="text-center">{p.hr ? <Check /> : <Cross />}</TableCell>
                  <TableCell className="text-center">{p.ops ? <Check /> : <Cross />}</TableCell>
                  <TableCell className="text-center">{p.fin ? <Check /> : <Cross />}</TableCell>
                  <TableCell className="text-center">{p.emp ? <Check /> : <Cross />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Data Retention Tab ────────────────────────────────────────────────────────
function DataRetentionTab() {
  return (
    <div className="space-y-4">
      <Card className="border-blue-100 bg-blue-50/30">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-blue-800 font-medium">Data Retention Policy</p>
          <p className="text-xs text-blue-600 mt-1">
            All data is stored securely in Supabase (PostgreSQL) with AES-256 encryption at rest and TLS 1.3 in transit.
            Retention periods below comply with applicable US federal and state regulations.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-purple-500" />
            Retention Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Data Category</TableHead>
                  <TableHead className="font-semibold">Retention Period</TableHead>
                  <TableHead className="font-semibold">Legal Basis</TableHead>
                  <TableHead className="font-semibold">Risk Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RETENTION_POLICIES.map(p => (
                  <TableRow key={p.category}>
                    <TableCell className="text-sm font-medium">{p.category}</TableCell>
                    <TableCell className="text-sm">{p.retention}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.legal}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${RISK_COLORS[p.risk]}`}>
                        {p.risk}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Security features */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-green-500" />Security Controls</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {[
                'Role-Based Access Control (RBAC) on all routes',
                'JWT authentication via Supabase Auth',
                'AES-256 encryption at rest',
                'TLS 1.3 encryption in transit',
                'Row Level Security (RLS) in Supabase',
                'All API endpoints authenticated',
                'Admin-only user management actions',
                'Audit trail for all data mutations',
              ].map(item => (
                <li key={item} className="flex items-start gap-2 text-xs text-gray-700">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-blue-500" />Compliance</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {[
                'Document storage for W-4, W-9, I-9, NDAs',
                'Activity logs for all CRUD operations',
                'Visa & work authorization tracking',
                'I-9 verification status tracking',
                'Payroll record retention (7 years)',
                'Invoice & billing record retention (7 years)',
                'Employee data segregation by role',
                'Sensitive fields masked in UI (SSN, bank)',
              ].map(item => (
                <li key={item} className="flex items-start gap-2 text-xs text-gray-700">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminSettings() {
  return (
    <div>
      <PageHeader
        title="Admin Settings"
        description="User management, permissions, audit logs, and compliance"
      />

      <Tabs defaultValue="users">
        <TabsList className="mb-6 grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-3.5 w-3.5" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-3.5 w-3.5" />
            Activity Logs
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <Shield className="h-3.5 w-3.5" />
            Role Permissions
          </TabsTrigger>
          <TabsTrigger value="retention" className="gap-2">
            <Database className="h-3.5 w-3.5" />
            Data Retention
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="activity"><ActivityLogsTab /></TabsContent>
        <TabsContent value="permissions"><PermissionsTab /></TabsContent>
        <TabsContent value="retention"><DataRetentionTab /></TabsContent>
      </Tabs>
    </div>
  );
}
