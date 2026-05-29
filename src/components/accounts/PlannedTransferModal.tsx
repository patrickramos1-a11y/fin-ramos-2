import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowRightLeft, CalendarClock } from 'lucide-react';
import { useAccounts } from '@/hooks/useFinancialConfig';
import {
  useCreatePlannedTransfer,
  useUpdatePlannedTransfer,
  getPlannedAccountingMode,
  stripPlannedAccountingMode,
  type PlannedAccountingMode,
  type PlannedFrequency,
  type PlannedTransfer,
} from '@/hooks/usePlannedTransfers';

const FREQS: { v: PlannedFrequency; label: string }[] = [
  { v: 'AVULSA', label: 'Avulsa (uma vez)' },
  { v: 'SEMANAL', label: 'Semanal' },
  { v: 'QUINZENAL', label: 'Quinzenal' },
  { v: 'MENSAL', label: 'Mensal' },
  { v: 'TRIMESTRAL', label: 'Trimestral' },
  { v: 'ANUAL', label: 'Anual' },
  { v: 'CUSTOM', label: 'Personalizada (dias)' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  planned?: PlannedTransfer | null;
}

export function PlannedTransferModal({ open, onClose, planned }: Props) {
  const { data: accounts } = useAccounts();
  const create = useCreatePlannedTransfer();
  const update = useUpdatePlannedTransfer();

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: 0,
    frequency: 'MENSAL' as PlannedFrequency,
    interval_days: 30,
    start_date: today,
    end_date: '',
    due_day: 10,
    accounting_mode: 'TRANSFER_ONLY' as PlannedAccountingMode,
    description: '',
    notes: '',
  });

  useEffect(() => {
    if (!open) return;
    if (planned) {
      setForm({
        from_account_id: planned.from_account_id,
        to_account_id: planned.to_account_id,
        amount: Number(planned.amount),
        frequency: planned.frequency,
        interval_days: planned.interval_days ?? 30,
        start_date: planned.start_date,
        end_date: planned.end_date ?? '',
        due_day: planned.due_day ?? 10,
        accounting_mode: getPlannedAccountingMode(planned.notes),
        description: planned.description ?? '',
        notes: stripPlannedAccountingMode(planned.notes),
      });
    } else {
      const banc = (accounts || []).find((a) => /banc/i.test(a.name));
      setForm({
        from_account_id: banc?.id ?? (accounts?.[0]?.id ?? ''),
        to_account_id: '',
        amount: 0,
        frequency: 'MENSAL',
        interval_days: 30,
        start_date: today,
        end_date: '',
        due_day: 10,
        accounting_mode: 'TRANSFER_ONLY',
        description: '',
        notes: '',
      });
    }
  }, [open, planned, accounts]);

  const active = (accounts || []).filter((a) => a.active);
  const valid =
    form.from_account_id &&
    form.to_account_id &&
    form.from_account_id !== form.to_account_id &&
    form.amount > 0 &&
    form.start_date;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const payload = {
      from_account_id: form.from_account_id,
      to_account_id: form.to_account_id,
      amount: form.amount,
      frequency: form.frequency,
      interval_days: form.frequency === 'CUSTOM' ? form.interval_days : null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      due_day: form.due_day,
      accounting_mode: form.accounting_mode,
      description: form.description || undefined,
      notes: form.notes || undefined,
    };
    if (planned) {
      update.mutate({ id: planned.id, ...payload }, { onSuccess: onClose });
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            {planned ? 'Editar transferência planejada' : 'Nova transferência planejada'}
          </DialogTitle>
          <DialogDescription>
            Planeje transferências futuras (avulsas ou recorrentes). Não impactam DRE.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Conta de origem</Label>
              <Select
                value={form.from_account_id}
                onValueChange={(v) => setForm({ ...form, from_account_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {active.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Conta de destino</Label>
              <Select
                value={form.to_account_id}
                onValueChange={(v) => setForm({ ...form, to_account_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {active.filter((a) => a.id !== form.from_account_id).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <Label className="text-xs text-muted-foreground">Valor</Label>
            <CurrencyInput
              value={form.amount}
              onValueChange={(value) => setForm({ ...form, amount: value ?? 0 })}
              placeholder="0,00"
              className="mt-1 text-2xl font-bold h-12 border-0 bg-transparent focus-visible:ring-0"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Entrada por centavos: 100000 vira R$ 1.000,00.
            </p>
          </div>

          <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
            <Label>Como este planejamento deve aparecer?</Label>
            <div className="grid sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, accounting_mode: 'TRANSFER_ONLY' })}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  form.accounting_mode === 'TRANSFER_ONLY'
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background'
                }`}
              >
                <p className="text-sm font-semibold">Só transferência</p>
                <p className="text-xs text-muted-foreground">
                  Movimenta saldo entre contas, mas não entra como despesa nos lançamentos.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, accounting_mode: 'AS_EXPENSE' })}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  form.accounting_mode === 'AS_EXPENSE'
                    ? 'border-expense bg-expense/10'
                    : 'border-border bg-background'
                }`}
              >
                <p className="text-sm font-semibold">Provisionar como despesa</p>
                <p className="text-xs text-muted-foreground">
                  Aparece em Transações/Em aberto para acompanhamento operacional.
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Frequência</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm({ ...form, frequency: v as PlannedFrequency })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQS.map((f) => (
                    <SelectItem key={f.v} value={f.v}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.frequency === 'CUSTOM' && (
              <div className="space-y-1.5">
                <Label>Intervalo (dias)</Label>
                <Input
                  type="number" min={1}
                  value={form.interval_days}
                  onChange={(e) => setForm({ ...form, interval_days: parseInt(e.target.value) || 1 })}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Data inicial</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            {form.frequency !== 'AVULSA' && (
              <div className="space-y-1.5">
                <Label>Data final (opcional)</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex: Reserva mensal para investimentos"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!valid || pending}>
            {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <ArrowRightLeft className="w-4 h-4 mr-1.5" />
            {planned ? 'Salvar' : 'Criar planejamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
