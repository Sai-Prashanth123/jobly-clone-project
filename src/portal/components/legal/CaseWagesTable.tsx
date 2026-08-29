import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCaseWages, useUpsertWage, useCaseTaxReturns, useUpsertTaxReturn } from '../../hooks/useCases';

const CURRENT_YEAR = new Date().getUTCFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 1 - i); // last 10 completed years

// Shared by both "Wages as per W2" and "Tax Returns" tabs — same shape
// (year-by-year manual entry), just a different backing table/label.
export function CaseWagesTable({ caseId, kind }: { caseId: string; kind: 'wages' | 'tax' }) {
  const wages = useCaseWages(caseId);
  const upsertWage = useUpsertWage(caseId);
  const taxReturns = useCaseTaxReturns(caseId);
  const upsertTaxReturn = useUpsertTaxReturn(caseId);

  const { data, isLoading } = kind === 'wages' ? wages : taxReturns;
  const [editYear, setEditYear] = useState<number | null>(null);
  const [amount, setAmount] = useState('');

  const byYear = new Map<number, number | undefined>();
  for (const row of data ?? []) {
    if ('wageYear' in row) byYear.set(row.wageYear, row.salaryReceived);
    else byYear.set(row.taxYear, row.amount);
  }

  const openEdit = (year: number) => {
    setEditYear(year);
    setAmount(byYear.get(year) != null ? String(byYear.get(year)) : '');
  };

  const save = async () => {
    if (editYear == null) return;
    const parsed = amount.trim() === '' ? null : Number(amount);
    if (parsed != null && Number.isNaN(parsed)) { toast.error('Enter a valid number'); return; }
    try {
      if (kind === 'wages') await upsertWage.mutateAsync({ wageYear: editYear, salaryReceived: parsed });
      else await upsertTaxReturn.mutateAsync({ taxYear: editYear, amount: parsed });
      toast.success('Saved');
      setEditYear(null);
    } catch {
      toast.error('Could not save. Please try again.');
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const isPending = kind === 'wages' ? upsertWage.isPending : upsertTaxReturn.isPending;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide border-b border-gray-100">
            <th className="py-2 pr-4">{kind === 'wages' ? 'Wages Received Year' : 'Tax Year'}</th>
            <th className="py-2 pr-4">{kind === 'wages' ? 'Salary Received' : 'Amount'}</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {YEARS.map(year => (
            <tr key={year} className="border-b border-gray-50 last:border-0">
              <td className="py-2.5 pr-4 text-gray-900">{year}</td>
              <td className="py-2.5 pr-4 text-gray-900">
                {byYear.get(year) != null ? `$${byYear.get(year)!.toLocaleString()}` : '–'}
              </td>
              <td className="py-2.5 text-right">
                <Button variant="ghost" size="sm" onClick={() => openEdit(year)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog open={editYear != null} onOpenChange={(o) => { if (!o) setEditYear(null); }}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>{kind === 'wages' ? 'Salary Received' : 'Tax Return Amount'} — {editYear}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{kind === 'wages' ? 'Salary Received' : 'Amount'} ($)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditYear(null)} disabled={isPending}>Cancel</Button>
            <Button onClick={save} loading={isPending} loadingText="Saving…">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
