import { useState, useEffect } from 'react';
import { Settings, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSystemSettings, useUpdateSettings } from '../hooks/useSettings';

const FIELDS = [
  { key: 'company_name',             label: 'Company Name',           type: 'text' },
  { key: 'company_logo_url',         label: 'Company Logo URL',       type: 'text' },
  { key: 'timezone',                 label: 'Timezone',               type: 'select', options: ['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','UTC','Asia/Kolkata','Asia/Singapore','Europe/London','Europe/Berlin'] },
  { key: 'fiscal_year_start_month',  label: 'Fiscal Year Start Month',type: 'select', options: ['1','2','3','4','5','6','7','8','9','10','11','12'], labels: ['January','February','March','April','May','June','July','August','September','October','November','December'] },
  { key: 'default_currency',         label: 'Default Currency',       type: 'select', options: ['USD','EUR','GBP','INR','SGD','AUD','CAD'] },
  { key: 'date_format',              label: 'Date Format',            type: 'select', options: ['MM/DD/YYYY','DD/MM/YYYY','YYYY-MM-DD'] },
];

export default function SystemSettings() {
  const { data: settings, isLoading } = useSystemSettings();
  const updateSettings = useUpdateSettings();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const handleSave = async () => {
    await updateSettings.mutateAsync(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Settings className="h-5 w-5 text-gray-600" /> System Settings</h2>
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        {FIELDS.map(f => (
          <div key={f.key} className="space-y-1">
            <Label>{f.label}</Label>
            {f.type === 'select' ? (
              <Select value={form[f.key] ?? ''} onValueChange={v => setForm(p => ({ ...p, [f.key]: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {f.options!.map((o, i) => <SelectItem key={o} value={o}>{f.labels ? f.labels[i] : o}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={form[f.key] ?? ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
            )}
          </div>
        ))}
        <Button onClick={handleSave} disabled={updateSettings.isPending} className="gap-2 w-full sm:w-auto">
          {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Save className="h-4 w-4" />}
          {saved ? 'Saved!' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
