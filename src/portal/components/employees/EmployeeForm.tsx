import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, PlusCircle, Loader2 } from 'lucide-react';
import type { Employee, EmployeeStatus, EmploymentType, PayFrequency, PayType, VisaType, I9Status, EmployeeDocument } from '../../types';
import { useEmployees, useUploadEmployeeDocument } from '../../hooks/useEmployees';
import { generateId } from '../../lib/idGenerators';
import { formatDate } from '../../lib/utils';
import { toast } from 'sonner';

type EmployeeFormData = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>;

interface EmployeeFormProps {
  initial?: Partial<Employee>;
  onSubmit: (data: EmployeeFormData, pendingFiles: Map<string, File>) => void;
  onCancel: () => void;
  isEdit?: boolean;
}

const defaultForm: EmployeeFormData = {
  firstName: '', lastName: '', email: '', phone: '', dob: '',
  address: { street: '', city: '', state: '', zip: '', country: 'USA' },
  department: '', jobTitle: '', employmentType: 'w2', startDate: '',
  status: 'active', payRate: 0, payType: 'hourly', payFrequency: 'biweekly',
  documents: [],
};

export function EmployeeForm({ initial, onSubmit, onCancel, isEdit = false }: EmployeeFormProps) {
  const { data: empData } = useEmployees({ limit: 500 });
  const employees = empData?.data ?? [];
  const uploadDoc = useUploadEmployeeDocument(initial?.id ?? '');
  const [form, setForm] = useState<EmployeeFormData>({ ...defaultForm, ...initial, documents: initial?.documents ?? [] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('personal');

  // Document state
  const [newDocType, setNewDocType] = useState('');
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [showAddDoc, setShowAddDoc] = useState(false);
  // Files collected in create mode — uploaded after employee is saved
  const [pendingFiles, setPendingFiles] = useState<Map<string, File>>(new Map());

  const set = (field: string, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const setAddr = (field: string, value: string) => {
    setForm(prev => ({ ...prev, address: { ...prev.address, [field]: value } }));
  };

  // Maps each field to which tab it lives on
  const FIELD_TAB: Record<string, string> = {
    firstName: 'personal', lastName: 'personal', email: 'personal',
    startDate: 'employment',
    payRate: 'payroll',
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    if (!form.startDate) errs.startDate = 'Start date (Joining Date) is required';
    if (form.payRate <= 0) errs.payRate = 'Pay rate must be greater than 0';
    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      // Jump to the first tab that has an error
      const firstErrField = Object.keys(errs)[0];
      const targetTab = FIELD_TAB[firstErrField] ?? 'personal';
      setActiveTab(targetTab);
      toast.error(Object.values(errs).join(' · '));
      return false;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) onSubmit(form, pendingFiles);
  };

  const addDocument = async () => {
    if (!newDocType || !newDocFile) return;

    if (isEdit && initial?.id) {
      // Edit mode: upload immediately
      const fd = new FormData();
      fd.append('file', newDocFile);
      fd.append('name', newDocFile.name);
      fd.append('docType', newDocType);
      try {
        await uploadDoc.mutateAsync(fd);
        toast.success('Document uploaded');
      } catch {
        toast.error('Failed to upload document');
      }
    } else {
      // Create mode: collect locally, upload after employee is saved
      const docId = generateId();
      const doc: EmployeeDocument = {
        id: docId,
        name: newDocFile.name,
        type: newDocType,
        uploadedAt: new Date().toISOString(),
      };
      set('documents', [...form.documents, doc]);
      setPendingFiles(prev => new Map(prev).set(docId, newDocFile));
    }
    setNewDocType('');
    setNewDocFile(null);
    setShowAddDoc(false);
  };

  const removeDocument = (id: string) => {
    set('documents', form.documents.filter(d => d.id !== id));
    setPendingFiles(prev => { const m = new Map(prev); m.delete(id); return m; });
  };


  // Reporting manager options — exclude self if editing
  const managerOptions = employees.filter(e =>
    e.status === 'active' && (!initial?.id || e.id !== initial.id)
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto gap-1">
          <TabsTrigger value="personal" className="relative">
            Personal
            {(errors.firstName || errors.lastName || errors.email) && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="employment" className="relative">
            Employment
            {errors.startDate && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />}
          </TabsTrigger>
          <TabsTrigger value="immigration">Immigration</TabsTrigger>
          <TabsTrigger value="payroll" className="relative">
            Payroll
            {errors.payRate && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />}
          </TabsTrigger>
          <TabsTrigger value="docs">Documents</TabsTrigger>
        </TabsList>

        {/* ── Personal ─────────────────────────────────────────────── */}
        <TabsContent value="personal">
          <Card><CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input value={form.firstName} onChange={e => set('firstName', e.target.value)} />
              {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
            </div>
            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input value={form.lastName} onChange={e => set('lastName', e.target.value)} />
              {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input type="date" value={form.dob} onChange={e => set('dob', e.target.value)} />
            </div>
            <div className="col-span-1 sm:col-span-2 space-y-2">
              <Label>Street Address</Label>
              <Input value={form.address.street} onChange={e => setAddr('street', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.address.city} onChange={e => setAddr('city', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={form.address.state} onChange={e => setAddr('state', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>ZIP Code</Label>
              <Input value={form.address.zip} onChange={e => setAddr('zip', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={form.address.country} onChange={e => setAddr('country', e.target.value)} />
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ── Employment ───────────────────────────────────────────── */}
        <TabsContent value="employment">
          <Card><CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={form.department} onChange={e => set('department', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Input value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Employment Type</Label>
              <Select value={form.employmentType} onValueChange={v => set('employmentType', v as EmploymentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="w2">W-2</SelectItem>
                  <SelectItem value="1099">1099</SelectItem>
                  <SelectItem value="c2c">C2C (Corp-to-Corp)</SelectItem>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
              {errors.startDate && <p className="text-xs text-red-500">{errors.startDate}</p>}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v as EmployeeStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reporting Manager</Label>
              <Select value={form.reportingManagerId ?? '__none__'} onValueChange={v => set('reportingManagerId', v === '__none__' ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {managerOptions.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.firstName} {e.lastName} ({e.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 sm:col-span-2 space-y-2">
              <Label>Work Location</Label>
              <Input
                value={form.workLocation ?? ''}
                onChange={e => set('workLocation', e.target.value)}
                placeholder="e.g. Remote, Onsite - New York, Hybrid"
              />
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ── Immigration ──────────────────────────────────────────── */}
        <TabsContent value="immigration">
          <Card><CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Visa Type</Label>
              <Select value={form.visaType ?? ''} onValueChange={v => set('visaType', v as VisaType)}>
                <SelectTrigger><SelectValue placeholder="Select visa type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="citizen">US Citizen</SelectItem>
                  <SelectItem value="gc">Green Card</SelectItem>
                  <SelectItem value="h1b">H-1B</SelectItem>
                  <SelectItem value="l1">L-1</SelectItem>
                  <SelectItem value="opt">OPT</SelectItem>
                  <SelectItem value="stem_opt">STEM OPT</SelectItem>
                  <SelectItem value="tn">TN</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Work Authorization Expiry</Label>
              <Input type="date" value={form.visaExpiry ?? ''} onChange={e => set('visaExpiry', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>I-9 Status</Label>
              <Select value={form.i9Status ?? ''} onValueChange={v => set('i9Status', v as I9Status)}>
                <SelectTrigger><SelectValue placeholder="Select I-9 status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>SSN (Last 4 Digits)</Label>
              <Input
                value={form.ssn ?? ''}
                onChange={e => set('ssn', e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="XXXX"
                maxLength={4}
              />
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ── Payroll ──────────────────────────────────────────────── */}
        <TabsContent value="payroll">
          <Card><CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pay Rate ($/hr or $/yr) *</Label>
              <Input
                type="number" min={0} step={0.01}
                value={form.payRate}
                onChange={e => set('payRate', parseFloat(e.target.value) || 0)}
              />
              {errors.payRate && <p className="text-xs text-red-500">{errors.payRate}</p>}
            </div>
            <div className="space-y-2">
              <Label>Pay Type</Label>
              <Select value={form.payType} onValueChange={v => set('payType', v as PayType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pay Frequency</Label>
              <Select value={form.payFrequency} onValueChange={v => set('payFrequency', v as PayFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select value={form.paymentType ?? ''} onValueChange={v => set('paymentType', v || undefined)}>
                <SelectTrigger><SelectValue placeholder="Select payment type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="w2">W-2</SelectItem>
                  <SelectItem value="1099">1099</SelectItem>
                  <SelectItem value="c2c">C2C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tax Form</Label>
              <Select value={form.taxFormType ?? ''} onValueChange={v => set('taxFormType', v || undefined)}>
                <SelectTrigger><SelectValue placeholder="Select tax form" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="w4">W-4 (Employee)</SelectItem>
                  <SelectItem value="w9">W-9 (Contractor)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 border-t pt-4 mt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Bank Details (ACH)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input value={form.bankName ?? ''} onChange={e => set('bankName', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Routing Number</Label>
                  <Input value={form.bankRoutingNumber ?? ''} onChange={e => set('bankRoutingNumber', e.target.value)} />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Account Number</Label>
                  <Input value={form.bankAccountNumber ?? ''} onChange={e => set('bankAccountNumber', e.target.value)} />
                </div>
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ── Documents ────────────────────────────────────────────── */}
        <TabsContent value="docs">
          <Card><CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Documents ({form.documents.length})</p>
              {!showAddDoc && (
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddDoc(true)}>
                  <PlusCircle className="h-4 w-4 mr-1" /> Add Document
                </Button>
              )}
            </div>

            {showAddDoc && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-md border">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Document Type *</Label>
                    <Select value={newDocType} onValueChange={setNewDocType}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Resume">Resume</SelectItem>
                        <SelectItem value="Offer Letter">Offer Letter</SelectItem>
                        <SelectItem value="ID Proof">ID Proof</SelectItem>
                        <SelectItem value="Compliance Document">Compliance Document</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">File *</Label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="block w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                      onChange={e => setNewDocFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
                {newDocFile && (
                  <p className="text-xs text-gray-500">Selected: <span className="font-medium">{newDocFile.name}</span> ({(newDocFile.size / 1024).toFixed(0)} KB)</p>
                )}
                <div className="flex gap-2 justify-end">
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setShowAddDoc(false); setNewDocType(''); setNewDocFile(null); }}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={addDocument} disabled={!newDocType || !newDocFile || uploadDoc.isPending}>
                    {uploadDoc.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    {isEdit ? 'Upload' : 'Add'}
                  </Button>
                </div>
              </div>
            )}

            {form.documents.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">File Name</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Date Added</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.documents.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell className="text-sm font-medium">{doc.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{doc.type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(doc.uploadedAt)}</TableCell>
                        <TableCell>
                          <Button
                            type="button" variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              set('documents', form.documents.filter(d => d.id !== doc.id));
                              setPendingFiles(prev => { const m = new Map(prev); m.delete(doc.id); return m; });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
                No documents added yet. Click "Add Document" to upload a file.
              </p>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{isEdit ? 'Save Changes' : 'Create Employee'}</Button>
      </div>
    </form>
  );
}
