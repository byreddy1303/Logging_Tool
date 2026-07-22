import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

export default function MissingTagsConfirm({
  open,
  saving = false,
  onGoBack,
  onConfirm
}: {
  open: boolean;
  saving?: boolean;
  onGoBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onGoBack} title="Save without pattern or trigger?">
      <div className="flex flex-col gap-4">
        <div className="relative overflow-hidden rounded border border-warn/30 bg-highlight/10 py-3 pl-5 pr-3">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-warn" />
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0 text-warn"
              aria-hidden
            />
            <div className="flex flex-col gap-1">
              <p className="font-display text-[14px] font-semibold text-text">
                Both learning cues are empty.
              </p>
              <p className="text-[13px] leading-relaxed text-text-muted">
                A pattern or trigger helps you recognise the method when this question returns for a
                re-attempt. Are you sure you want to save without either one?
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onConfirm} disabled={saving}>
            {saving ? 'Saving…' : 'Save without tags'}
          </Button>
          <Button variant="primary" onClick={onGoBack} disabled={saving} autoFocus>
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
            Go back and add tags
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
