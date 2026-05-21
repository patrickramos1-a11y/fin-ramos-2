import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowRightLeft, Banknote, AlertTriangle } from 'lucide-react';
import { useAccounts, useCreateAccountTransfer } from '@/hooks/useFinancialConfig';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TransferModalProps {
  open: boolean;
  onClose: () => void;
  defaultFromAccountId?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function AccountFaceCard({
  label,
  account,
  estimated,
}: {
  label: string;
  account: any | undefined;
  estimated: number | null;
}) {
  const color = account?.category?.color || 'hsl(var(--primary))';
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 min-h-[150px]">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      {account ? (
        <>
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: `${color}20` }}
            >
              <Banknote className="w-5 h-5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{account.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {account.bank || account.category?.name || '—'}
              </p>
            </div>
          </div>
          <div className="mt-auto">
            <p className="text-[10px] text-muted-foreground uppercase">Saldo atual</p>
            <p className="text-base font-bold">{fmt(Number(account.current_balance) || 0)}</p>
            {estimated !== null && (
              <p
                className={cn(
                  'text-[11px] font-medium mt-1',
                  estimated < 0 ? 'text-destructive' : 'text-primary',
                )}
              >
                Após: {fmt(estimated)}
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground my-auto">Selecione uma conta</p>
      )}
    </div>
  );
}

export function TransferModal({ open, onClose, defaultFromAccountId }: TransferModalProps) {
  const { data: accounts } = useAccounts();
  const createTransfer = useCreateAccountTransfer();

  const [formData, setFormData] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: 0,
    transferDate: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });

  const activeAccounts = (accounts || []).filter((a) => a.active);

  // Pre-select default origin (Bancária) when opening
  useEffect(() => {
    if (!open) return;
    if (formData.fromAccountId) return;
    const explicit = defaultFromAccountId
      ? activeAccounts.find((a) => a.id === defaultFromAccountId)
      : null;
    const banc = activeAccounts.find((a) => /banc/i.test(a.name));
    const chosen = explicit || banc || activeAccounts[0];
    if (chosen) {
      setFormData((p) => ({ ...p, fromAccountId: chosen.id }));
    }
  }, [open, defaultFromAccountId, activeAccounts, formData.fromAccountId]);

  const fromAccount = accounts?.find((a) => a.id === formData.fromAccountId);
  const toAccount = accounts?.find((a) => a.id === formData.toAccountId);

  const fromEstimated = fromAccount
    ? Number(fromAccount.current_balance || 0) - (formData.amount || 0)
    : null;
  const toEstimated = toAccount
    ? Number(toAccount.current_balance || 0) + (formData.amount || 0)
    : null;

  const isValid =
    formData.fromAccountId &&
    formData.toAccountId &&
    formData.fromAccountId !== formData.toAccountId &&
    formData.amount > 0;

  const negativeWarning = fromEstimated !== null && fromEstimated < 0 && formData.amount > 0;

  const reset = () =>
    setFormData({
      fromAccountId: '',
      toAccountId: '',
      amount: 0,
      transferDate: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    createTransfer.mutate(
      {
        from_account_id: formData.fromAccountId,
        to_account_id: formData.toAccountId,
        amount: formData.amount,
        transfer_date: formData.transferDate,
        notes: formData.notes || undefined,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Nova Transferência
          </DialogTitle>
          <DialogDescription>
            Movimentação entre contas. Não impacta faturamento, DRE ou resultado operacional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Visual cards */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
            <AccountFaceCard label="De" account={fromAccount} estimated={fromEstimated} />
            <div className="flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-primary" />
              </div>
            </div>
            <AccountFaceCard label="Para" account={toAccount} estimated={toEstimated} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Conta de origem</Label>
              <Select
                value={formData.fromAccountId}
                onValueChange={(v) => setFormData({ ...formData, fromAccountId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({fmt(Number(acc.current_balance) || 0)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Conta de destino</Label>
              <Select
                value={formData.toAccountId}
                onValueChange={(v) => setFormData({ ...formData, toAccountId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts
                    .filter((a) => a.id !== formData.fromAccountId)
                    .map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} ({fmt(Number(acc.current_balance) || 0)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Big value */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <Label className="text-xs text-muted-foreground">Valor da transferência</Label>
            <CurrencyInput
              value={formData.amount}
              onValueChange={(value) => setFormData({ ...formData, amount: value ?? 0 })}
              placeholder="0,00"
              className="mt-1 text-2xl font-bold h-14 border-0 bg-transparent focus-visible:ring-0"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Digite somente os numeros: 800000 vira R$ 8.000,00 e 7801850 vira R$ 78.018,50.
            </p>
            {negativeWarning && (
              <div className="flex items-center gap-2 mt-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                Saldo da origem ficará negativo após a transferência.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={formData.transferDate}
                onChange={(e) => setFormData({ ...formData, transferDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ex: reserva mensal"
                rows={1}
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || createTransfer.isPending}>
            {createTransfer.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar transferência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
