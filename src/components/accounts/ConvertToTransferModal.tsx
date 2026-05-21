import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRightLeft, Info } from 'lucide-react';
import { useAccounts } from '@/hooks/useFinancialConfig';
import { useConvertToTransfer } from '@/hooks/useConvertToTransfer';
import type { AccountTx } from '@/hooks/useAccountDetail';

interface Props {
  open: boolean;
  onClose: () => void;
  fromAccountId: string;
  transaction: AccountTx | null;
}

export function ConvertToTransferModal({ open, onClose, fromAccountId, transaction }: Props) {
  const { data: accounts } = useAccounts();
  const convert = useConvertToTransfer();

  const [toAccountId, setToAccountId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (transaction) {
      setAmount(Number(transaction.valor_pago ?? transaction.valor ?? 0));
      setDate(transaction.data_vencimento || new Date().toISOString().slice(0, 10));
      setNotes(`Convertida: ${transaction.descricao || 'despesa planejada'}`);
      setToAccountId('');
    }
  }, [transaction]);

  const dest = (accounts || []).filter((a) => a.active && a.id !== fromAccountId);

  const handleSubmit = async () => {
    if (!transaction || !toAccountId) return;
    await convert.mutateAsync({
      transaction_id: transaction.id,
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      amount: amount || 0,
      transfer_date: date,
      notes,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            Converter em transferência
          </DialogTitle>
          <DialogDescription>
            A despesa será removida do DRE e registrada como movimentação interna entre contas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md bg-muted/50 p-2.5 text-xs flex gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">
              Use quando o lançamento original for, na verdade, um movimento entre suas próprias
              contas (sem impacto operacional).
            </span>
          </div>

          <div>
            <Label className="text-xs">Conta de destino</Label>
            <Select value={toAccountId} onValueChange={setToAccountId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione a conta destino" />
              </SelectTrigger>
              <SelectContent>
                {dest.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Valor</Label>
              <CurrencyInput
                value={amount}
                onValueChange={(value) => setAmount(value ?? 0)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Observação</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!toAccountId || amount <= 0 || convert.isPending}
          >
            Converter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
