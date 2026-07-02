import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { Loader2, Plus, Receipt, Send, Check, X, DollarSign, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import {
  useExpenses, useCreateExpense, useUpdateExpense, useSubmitExpense,
  useReviewExpense, useMarkExpensePaid, useDeleteExpense,
  type Expense, type ExpenseCategory, type ExpenseStatus,
  EXPENSE_CATEGORY_LABELS,
} from '../hooks/useExpenses';
import { formatDate } from '../lib/utils';

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  draft:     'bg-gray-100 text-gray-600 border-gray-200',
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  approved:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:  'bg-red-50 text-red-700 border-red-200',
  paid:      'bg-purple-50 text-purple-700 border-purple-200',
};

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  draft: 'Draft', submitted: 'Submitted', approved: 'Approved', rejected: 'Rejected', paid: 'Paid',
};

const STATUS_TABS: Array<{ key: ExpenseStatus | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'paid', label: 'Paid' },
];

const CATEGORIES = Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][];

interface ExpenseFormData {
  title: string;
  category: ExpenseCategory;
  amount: string;
  currency: string;
  expenseDate: string;
  notes: string;
  receiptUrl: string;
}

const EMPTY_FORM: ExpenseFormData = {
  title: '', category: 'travel', amount: '', currency: 'USD',
  expenseDate: new Date().toISOString().slice(0, 10), notes: '', receiptUrl: '',
};

export default function Expenses() {
  const { user } = useAuth();
  const role = user?.role ?? 'employee';
  const canReview = role === 'admin' || role === 'hr' || role === 'finance';
  const canMarkPaid = role === 'admin' || role === 'finance';

  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseFormData>(EMPTY_FORM);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState<{ expense: Expense; action: 'approved' | 'rejected' } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const { data, isLoading, isError, refetch } = useExpenses({ status: statusFilter === 'all' ? undefined : statusFilter, limit: 50 });
  const expenses = data?.data ?? [];

  const createMut = useCreateExpense();
  const updateMut = useUpdateExpense();
  const submitMut = useSubmitExpense();
  const reviewMut = useReviewExpense();
  const paidMut   = useMarkExpensePaid();
  const deleteMut = useDeleteExpense();

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      title: e.title, category: e.category, amount: String(e.amount),
      currency: e.currency, expenseDate: e.expenseDate,
      notes: e.notes ?? '', receiptUrl: e.receiptUrl ?? '',
    });
    setFormOpen(true);
  }

  async function saveExpense() {
    const amount = parseFloat(form.amount);
    if (!form.title.trim() || !form.expenseDate || isNaN(amount) || amount <= 0) {
      toast.error('Title, date and a positive amount are required');
      return;
    }
    try {
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id, title: form.title, category: form.category,
          amount, currency: form.currency, expenseDate: form.expenseDate,
          notes: form.notes || null, receiptUrl: form.receiptUrl || null,
        });
        toast.success('Expense updated');
      } else {
        await createMut.mutateAsync({
          title: form.title, category: form.category, amount,
          currency: form.currency, expenseDate: form.expenseDate,
          notes: form.notes || null, receiptUrl: form.receiptUrl || null,
        });
        toast.success('Expense created');
      }
      setFormOpen(false);
    } catch { /* handled centrally */ }
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Expense Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Submit and track expense reimbursements</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {(role === 'employee' || role === 'admin' || role === 'hr' || role === 'finance') && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> New Expense
            </Button>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border ${
              statusFilter === tab.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-red-500">Failed to load expenses. Please refresh.</p>
          </CardContent>
        </Card>
      ) : expenses.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No expenses found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {expenses.map(expense => (
            <Card key={expense.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-0">
                  <div className="flex-1 px-4 py-3 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-blue-600">{expense.displayId ?? expense.id.slice(0,8)}</span>
                      <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[expense.status]}`}>
                        {STATUS_LABELS[expense.status]}
                      </span>
                      <span className="text-xs text-muted-foreground border border-gray-200 rounded-full px-2 py-0.5">
                        {EXPENSE_CATEGORY_LABELS[expense.category]}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">{expense.title}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                      <span>{formatDate(expense.expenseDate)}</span>
                      {expense.employeeName && <span>· {expense.employeeName}</span>}
                      {expense.rejectionReason && <span className="text-red-600">Rejected: {expense.rejectionReason}</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 px-4 py-3 border-t sm:border-t-0 sm:border-l border-gray-100 sm:min-w-[200px]">
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        {expense.currency} {expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {expense.status === 'draft' && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => openEdit(expense)}>
                            <FileText className="h-3 w-3" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                            loading={submittingId === expense.id}
                            onClick={async () => {
                              setSubmittingId(expense.id);
                              try {
                                await submitMut.mutateAsync(expense.id);
                                toast.success('Expense submitted for review');
                              } catch { /* centrally handled */ }
                              finally { setSubmittingId(null); }
                            }}
                          >
                            <Send className="h-3 w-3" /> Submit
                          </Button>
                        </>
                      )}
                      {expense.status === 'submitted' && canReview && (
                        <>
                          <Button
                            size="sm"
                            className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => { setReviewOpen({ expense, action: 'approved' }); setRejectionReason(''); }}
                          >
                            <Check className="h-3 w-3" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => { setReviewOpen({ expense, action: 'rejected' }); setRejectionReason(''); }}
                          >
                            <X className="h-3 w-3" /> Reject
                          </Button>
                        </>
                      )}
                      {expense.status === 'approved' && canMarkPaid && (
                        <Button
                          size="sm"
                          className="gap-1 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                          loading={payingId === expense.id}
                          onClick={async () => {
                            setPayingId(expense.id);
                            try {
                              await paidMut.mutateAsync(expense.id);
                              toast.success('Marked as paid');
                            } catch { /* centrally handled */ }
                            finally { setPayingId(null); }
                          }}
                        >
                          <DollarSign className="h-3 w-3" /> Mark Paid
                        </Button>
                      )}
                      {expense.status === 'draft' && (
                        <Button
                          size="sm" variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                          onClick={() => setDeleteTarget(expense)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Expense' : 'New Expense Report'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update this draft expense.' : 'Add a new expense for reimbursement.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-title">Title *</Label>
              <Input id="exp-title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Client dinner at The Capital Grille" maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v as ExpenseCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exp-date">Date *</Label>
                <Input id="exp-date" type="date" value={form.expenseDate} onChange={e => setForm(p => ({ ...p, expenseDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="exp-amount">Amount *</Label>
                <Input id="exp-amount" type="number" min="0.01" step="0.01" value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['USD','EUR','GBP','CAD','AUD','INR'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-receipt">Receipt URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="exp-receipt" type="url" value={form.receiptUrl}
                onChange={e => setForm(p => ({ ...p, receiptUrl: e.target.value }))}
                placeholder="https://drive.google.com/..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-notes">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea id="exp-notes" value={form.notes} rows={3}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Additional context..." maxLength={2000} className="resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={saveExpense} loading={isSaving} loadingText="Saving…">
              {editing ? 'Update' : 'Create'} Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review dialog (approve / reject) */}
      <Dialog open={!!reviewOpen} onOpenChange={open => { if (!open) setReviewOpen(null); }}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewOpen?.action === 'approved' ? 'Approve Expense' : 'Reject Expense'}
            </DialogTitle>
            <DialogDescription>
              {reviewOpen?.expense.title}
              {' — '}
              {reviewOpen?.expense.currency} {reviewOpen?.expense.amount.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          {reviewOpen?.action === 'rejected' && (
            <div className="space-y-1.5">
              <Label>Rejection reason <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="e.g. Missing receipt, over daily limit…"
                rows={3} maxLength={1000} className="resize-none"
              />
            </div>
          )}
          {reviewOpen?.action === 'approved' && (
            <p className="text-sm text-muted-foreground">This will approve the expense and notify the employee.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(null)} disabled={reviewMut.isPending}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!reviewOpen) return;
                try {
                  await reviewMut.mutateAsync({
                    id: reviewOpen.expense.id,
                    action: reviewOpen.action,
                    rejectionReason: rejectionReason || undefined,
                  });
                  toast.success(reviewOpen.action === 'approved' ? 'Expense approved' : 'Expense rejected');
                  setReviewOpen(null);
                } catch { /* centrally handled */ }
              }}
              loading={reviewMut.isPending}
              loadingText={reviewOpen?.action === 'approved' ? 'Approving…' : 'Rejecting…'}
              className={reviewOpen?.action === 'rejected' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
            >
              {reviewOpen?.action === 'approved' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => { if (!open) setDeleteTarget(null); }}
        title="Delete expense?"
        description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await deleteMut.mutateAsync(deleteTarget.id);
            toast.success('Expense deleted');
            setDeleteTarget(null);
          } catch { /* centrally handled */ }
        }}
      />
    </div>
  );
}
