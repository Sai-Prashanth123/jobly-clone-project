import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
  /**
   * When true, the confirm button shows a spinner, is disabled, and does
   * NOT auto-close the dialog on click. Callers are responsible for
   * closing the dialog themselves after the mutation resolves.
   */
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  onConfirm,
  destructive = true,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Prevent Radix's default auto-close so the spinner stays
              // visible. Callers close the dialog after their mutation
              // resolves via onOpenChange(false).
              e.preventDefault();
              if (loading) return;
              onConfirm();
            }}
            disabled={loading}
            aria-busy={loading || undefined}
            className={cn(
              destructive ? 'bg-red-600 hover:bg-red-700 text-white' : '',
              loading && 'opacity-80 pointer-events-none',
            )}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
