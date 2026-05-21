import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CurrencyInput, parseBRLToNumber } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Account } from '@/hooks/useFinancialConfig';
import { AlertCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  account: Account | null;
  currentBalance: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function AccountAdjustmentModal({ open, onClose, account, currentBalance }: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'TARGET' | 'DELTA'>('TARGET');
  const [target, setTarget] = useState('');
  const [delta, setDelta] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const targetNum = parseBRLToNumber(target) || 0;
  const deltaNum = parseBRLToNumber(delta) || 0;
  const computedDelta = mode === 'TARGET' ? targetNum - currentBalance : deltaNum;

  const reset = () => {
    setMode('TARGET');
    setTarget('');
    setDelta('');
    setNotes('');
  };
  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!account || computedDelta === 0) {
      toast.error('Informe um valor diferente do saldo atual.');
      return;
    }
    setSaving(true);
    try {
      const isEntrada = computedDelta > 0;
      const catName = isEntrada ? 'AJUSTE DE SALDO (+)' : 'AJUSTE DE SALDO (-)';
      const [{ data: cat, error: catErr }, { data: ent, error: entErr }] = await Promise.all([
        supabase.from('transaction_categories').select('id, cost_center_id').eq('name', catName).maybeSingle(),
        supabase.from('financial_entities').select('id').eq('name', 'SISTEMA - AJUSTE').maybeSingle(),
      ]);
      if (catErr || !cat) throw catErr || new Error('Categoria de ajuste não encontrada.');
      if (entErr || !ent) throw entErr || new Error('Entidade SISTEMA - AJUSTE não encontrada.');

      const today = new Date();
      const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const valor = Math.abs(computedDelta);

      const { error } = await supabase.from('transactions').insert({
        tipo_movimento: isEntrada ? 'ENTRADA' : 'SAIDA',
        natureza: 'AVULSA',
        origem: 'LANCAMENTO_MANUAL',
        status: 'PAGO',
        approval_status: 'aprovado',
        account_id: account.id,
        transaction_category_id: cat.id,
        cost_center_id: cat.cost_center_id,
        entity_id: ent.id,
        valor,
        valor_pago: valor,
        data_vencimento: ymd,
        data_pagamento: ymd,
        competencia_mes: today.getMonth() + 1,
        competencia_ano: today.getFullYear(),
        descricao: `Ajuste de saldo · ${account.name}`,
        notes: notes || `Saldo ajustado de ${fmt(currentBalance)} para ${fmt(currentBalance + computedDelta)}`,
      });
      if (error) throw error;

      toast.success('Ajuste registrado com sucesso.');
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['accounts-snapshot'] });
      qc.invalidateQueries({ queryKey: ['accounts-evolution'] });
      qc.invalidateQueries({ queryKey: ['account-detail'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      handleClose();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar ajuste.');
    } finally {
      setSaving(false);
    }
  };

  if (!account) return null;
  const novoSaldo = currentBalance + computedDelta;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar saldo · {account.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              O ajuste cria uma transação de "Ajuste de Saldo" — o saldo é sempre derivado do histórico,
              nunca editado diretamente.
            </p>
          </div>

          <div>
            <Label className="text-xs">Saldo atual</Label>
            <p className="text-lg font-bold">{fmt(currentBalance)}</p>
          </div>

          <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="TARGET" id="t" />
              <Label htmlFor="t" className="text-sm font-normal">Definir novo saldo final</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="DELTA" id="d" />
              <Label htmlFor="d" className="text-sm font-normal">Lançar valor (+/-) sobre o saldo</Label>
            </div>
          </RadioGroup>

          {mode === 'TARGET' ? (
            <div>
              <Label htmlFor="target">Novo saldo</Label>
              <CurrencyInput
                id="target"
                placeholder="0,00"
                value={target}
                onValueChange={(value) => setTarget(value === null ? '' : String(value))}
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="delta">Valor do ajuste (use - para retirar)</Label>
              <CurrencyInput
                id="delta"
                placeholder="0,00"
                allowNegative
                value={delta}
                onValueChange={(value) => setDelta(value === null ? '' : String(value))}
              />
            </div>
          )}

          <div>
            <Label htmlFor="notes">Justificativa (opcional)</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Ex.: conciliação bancária de mar/26"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="rounded-lg border border-border p-3 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Variação</p>
              <p className={`text-sm font-bold ${computedDelta >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {computedDelta >= 0 ? '+' : ''}{fmt(computedDelta)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Novo saldo</p>
              <p className="text-sm font-bold">{fmt(novoSaldo)}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || computedDelta === 0}>
            {saving ? 'Salvando…' : 'Registrar ajuste'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
