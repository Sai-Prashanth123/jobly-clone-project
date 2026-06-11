import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Send, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSendInvoice, useGetInvoicePDF, useUpdateInvoice } from '../../hooks/useInvoices';
import {
  buildGmailLink, buildOutlookLink, buildOutlookLiveLink, buildMailtoLink,
  buildInvoiceEmailBody, publicInvoiceUrl, type ComposeParams,
} from '../../lib/composeLinks';
import { formatDate } from '../../lib/utils';
import type { Invoice } from '../../types';

export const SEND_PREF_KEY = 'jobly.invoiceSendPref';

interface ClientLite {
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  billingContactName?: string;
  billingContactEmail?: string;
}

interface Props {
  invoice: Invoice;
  client?: ClientLite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Send invoice" chooser (Wave-style). Lets the user send through their own
 * Gmail/Outlook (compose opens prefilled + the PDF downloads to attach) OR send
 * directly via Jobly (server email with the PDF attached). Web compose links
 * can't attach files, so the PDF is downloaded + linked, never auto-attached.
 */
export function SendInvoiceDialog({ invoice, client, open, onOpenChange }: Props) {
  const sendInvoice = useSendInvoice(invoice.id);
  const getPDF = useGetInvoicePDF();
  const markSent = useUpdateInvoice(invoice.id);

  const contactName = client?.billingContactName || client?.contactName || 'there';
  const defaultTo = client?.billingContactEmail || client?.contactEmail || '';
  const defaultSubject = `Invoice ${invoice.invoiceNumber} from Jobly Solutions — Due ${formatDate(invoice.dueDate)}`;
  const defaultMessage =
    `Please find invoice ${invoice.invoiceNumber} attached. The amount due is ${invoice.totalAmount?.toLocaleString(undefined, { style: 'currency', currency: invoice.currency || 'USD' })}, due by ${formatDate(invoice.dueDate)}.`;

  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [externalOpened, setExternalOpened] = useState(false);
  const [dontShow, setDontShow] = useState(() => localStorage.getItem(SEND_PREF_KEY) === 'direct');

  const publicUrl = invoice.publicToken ? publicInvoiceUrl(invoice.publicToken) : undefined;

  const persistPref = (checked: boolean) => {
    setDontShow(checked);
    if (checked) localStorage.setItem(SEND_PREF_KEY, 'direct');
    else localStorage.removeItem(SEND_PREF_KEY);
  };

  // Fresh 7-day signed URL → browser download so the user can attach it.
  const downloadPdf = async () => {
    try {
      const url = await getPDF.mutateAsync(invoice.id);
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* central failed-request toast (queryClient.ts) */
    }
  };

  const openExternal = (provider: 'gmail' | 'outlook' | 'outlook-personal' | 'mailto') => {
    const body = buildInvoiceEmailBody({ contactName, message, publicUrl, withPdfNote: true });
    const params: ComposeParams = { to, subject, body };
    const url =
      provider === 'gmail' ? buildGmailLink(params)
      : provider === 'outlook' ? buildOutlookLink(params)
      : provider === 'outlook-personal' ? buildOutlookLiveLink(params)
      : buildMailtoLink(params);

    // Open the compose synchronously (preserves the click gesture so popup
    // blockers allow it); download the PDF right after.
    if (provider === 'mailto') {
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener');
    }
    void downloadPdf();
    setExternalOpened(true);
  };

  const sendViaJobly = async () => {
    try {
      const r = await sendInvoice.mutateAsync();
      if (r.emailSent) {
        toast.success(invoice.status === 'draft' ? 'Invoice sent to client via email' : 'Invoice re-sent to client');
      } else {
        toast.warning(r.warning ?? 'Invoice was prepared but the email could not be delivered. Check the client billing email.', { duration: 12000 });
      }
      onOpenChange(false);
    } catch {
      /* central toast */
    }
  };

  const markAsSent = async () => {
    try {
      await markSent.mutateAsync({ status: 'sent' });
      toast.success('Invoice marked as sent');
      onOpenChange(false);
    } catch {
      /* central toast */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send invoice {invoice.invoiceNumber}</DialogTitle>
          <DialogDescription>
            Send from your own Gmail/Outlook, or send directly through Jobly with the PDF attached.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="si-to" className="text-xs">To</Label>
            <Input id="si-to" type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="client@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="si-subject" className="text-xs">Subject</Label>
            <Input id="si-subject" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="si-msg" className="text-xs">Message</Label>
            <textarea
              id="si-msg"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        {/* Send with your own email */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Send with your email</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button type="button" variant="outline" className="justify-center gap-2" onClick={() => openExternal('gmail')}>
              <Mail className="h-4 w-4 text-red-500" /> Gmail
            </Button>
            <Button type="button" variant="outline" className="justify-center gap-2" onClick={() => openExternal('outlook')}>
              <Mail className="h-4 w-4 text-blue-600" /> Outlook
            </Button>
            <Button type="button" variant="outline" className="justify-center gap-2" onClick={() => openExternal('mailto')}>
              <Mail className="h-4 w-4 text-gray-500" /> Mail app
            </Button>
          </div>
          <button
            type="button"
            onClick={() => openExternal('outlook-personal')}
            className="text-[11px] text-muted-foreground hover:text-foreground underline"
          >
            Using a personal Outlook.com / Hotmail account?
          </button>

          {externalOpened && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900 space-y-2">
              <p>We opened your email with the message prefilled and downloaded the PDF — attach it and hit send in your mailbox.</p>
              {invoice.status === 'draft' && (
                <Button type="button" size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={markAsSent} disabled={markSent.isPending}>
                  {markSent.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Mark this invoice as sent
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-gray-200" />
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">or</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        {/* Send via Jobly */}
        <Button type="button" className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={sendViaJobly} disabled={sendInvoice.isPending}>
          {sendInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send via Jobly (PDF attached)
        </Button>

        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Checkbox checked={dontShow} onCheckedChange={v => persistPref(!!v)} />
          Don&apos;t show this again — always send via Jobly
        </label>
      </DialogContent>
    </Dialog>
  );
}
