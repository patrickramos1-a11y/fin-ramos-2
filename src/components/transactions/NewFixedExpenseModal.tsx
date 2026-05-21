import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput, parseBRLToNumber } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Loader2, Building2, Info } from 'lucide-react';
import { useCreateFixedExpense, useGenerateFixedExpenseTransactions } from '@/hooks/useFixedExpenses';
import { useAccounts, useTransactionCategories, useCostCenters, usePaymentMethods } from '@/hooks/useFinancialConfig';
import { useClients } from '@/hooks/useTransactions';
import { useSaveTransactionEntities } from '@/hooks/useTransactionEntities';
import { formatCurrency } from '@/data/mockData';
import { MultiEntitySelector } from './MultiEntitySelector';
import { CategoryFilteredSelector } from './CategoryFilteredSelector';
import { toast } from 'sonner';

interface NewFixedExpenseModalProps {
  open: boolean;
  onClose: () => void;
  defaultMonth?: number;
  defaultYear?: number;
}

export function NewFixedExpenseModal({ open, onClose, defaultMonth, defaultYear }: NewFixedExpenseModalProps) {
  const currentYear = defaultYear || new Date().getFullYear();

  const [formData, setFormData] = useState({
    nome: '',
    valor: '',
    dia_vencimento: 10,
    categoria_id: '',
    forma_pagamento_id: '',
    cliente_id: '',
    data_inicio: `${currentYear}-01-01`,
    data_fim: '',
    notes: '',
    documento_tipo: '' as string,
    account_id_override: '' as string, // usado quando categoria não tem default_account_id
  });

  const [entityIds, setEntityIds] = useState<string[]>([]);
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterCostCenterId, setFilterCostCenterId] = useState('');
  const [resolvedAccountId, setResolvedAccountId] = useState<string | null>(null);
  const [resolvedCostCenterId, setResolvedCostCenterId] = useState<string | null>(null);

  const { data: accounts } = useAccounts();
  const { data: categories } = useTransactionCategories();
  const { data: costCenters } = useCostCenters();
  const { data: paymentMethods } = usePaymentMethods();
  const { data: clients } = useClients();
  
  const createFixedExpense = useCreateFixedExpense();
  const generateTransactions = useGenerateFixedExpenseTransactions();
  const saveEntities = useSaveTransactionEntities();

  const selectedCategory = categories?.find(c => c.id === formData.categoria_id);

  const valor = parseBRLToNumber(formData.valor) || 0;

  const resetForm = () => {
    setFormData({
      nome: '', valor: '', dia_vencimento: 10, categoria_id: '',
      forma_pagamento_id: '', cliente_id: '',
      data_inicio: `${currentYear}-01-01`, data_fim: '', notes: '',
      documento_tipo: '',
      account_id_override: '',
    });
    setEntityIds([]);
    setFilterAccountId('');
    setFilterCostCenterId('');
    setResolvedAccountId(null);
    setResolvedCostCenterId(null);
  };

  const handleClose = () => { resetForm(); onClose(); };

  // Conta efetiva: vem do CategoryFilteredSelector (default da categoria → override)
  const effectiveAccountId = resolvedAccountId;

  const handleSubmit = async () => {
    if (!effectiveAccountId) {
      toast.error('Selecione uma Conta — a categoria escolhida não tem conta padrão.');
      return;
    }

    const result = await createFixedExpense.mutateAsync({
      nome: formData.nome,
      valor,
      dia_vencimento: formData.dia_vencimento,
      transaction_category_id: formData.categoria_id || null,
      cost_center_id: resolvedCostCenterId,
      account_id: effectiveAccountId,
      payment_method_id: formData.forma_pagamento_id || null,
      cliente_id: formData.cliente_id || null,
      data_inicio: formData.data_inicio,
      data_fim: formData.data_fim || null,
      notes: formData.notes || null,
    });

    // Save multi-entity links
    if (entityIds.length > 0 && result?.id) {
      await saveEntities.mutateAsync({
        fixedExpenseId: result.id,
        entityIds,
      });
    }

    // Generate transactions
    for (let m = 1; m <= 12; m++) {
      await generateTransactions.mutateAsync({ year: currentYear, month: m });
    }

    handleClose();
  };

  const isSubmitting = createFixedExpense.isPending || generateTransactions.isPending;
  const canSubmit = formData.nome.trim().length > 0 && valor > 0 && formData.dia_vencimento >= 1 && formData.dia_vencimento <= 31 && formData.categoria_id.length > 0 && formData.forma_pagamento_id.length > 0 && formData.cliente_id.length > 0 && entityIds.length > 0 && formData.documento_tipo.length > 0 && !!effectiveAccountId;

  const startDate = new Date(formData.data_inicio);
  const startMonth = startDate.getMonth() + 1;
  const monthsInYear = 12 - startMonth + 1;
  const annualProjection = valor * monthsInYear;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-expense" />
            Nova Despesa Fixa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome / Fornecedor *</Label>
            <Input 
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Aluguel Escritório, Internet, Contador..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor Mensal (R$) *</Label>
              <CurrencyInput
                value={formData.valor}
                onValueChange={(value) => setFormData({ ...formData, valor: value === null ? '' : String(value) })}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Dia do Vencimento *</Label>
              <Input 
                type="number" min={1} max={31}
                value={formData.dia_vencimento}
                onChange={(e) => setFormData({ ...formData, dia_vencimento: parseInt(e.target.value) || 10 })}
              />
            </div>
          </div>

          {/* Category with pre-filters + inheritance panel + override (all built-in) */}
          <CategoryFilteredSelector
            tipo="SAIDA"
            subtype="FIXA"
            selectedCategoryId={formData.categoria_id}
            onCategoryChange={(v) => {
              setFormData({ ...formData, categoria_id: v, account_id_override: '' });
            }}
            filterAccountId={filterAccountId}
            onFilterAccountChange={(v) => setFilterAccountId(v === 'all' ? '' : v)}
            filterCostCenterId={filterCostCenterId}
            onFilterCostCenterChange={(v) => setFilterCostCenterId(v === 'all' ? '' : v)}
            overrideAccountId={formData.account_id_override}
            onOverrideAccountChange={(v) => setFormData({ ...formData, account_id_override: v })}
            onResolvedAccountChange={setResolvedAccountId}
            onResolvedCostCenterChange={setResolvedCostCenterId}
          />

          <div>
            <Label>Forma de Pagamento *</Label>
            <Select value={formData.forma_pagamento_id} onValueChange={(v) => setFormData({ ...formData, forma_pagamento_id: v })}>
              <SelectTrigger className={!formData.forma_pagamento_id ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods?.filter(p => p.active).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Documento Fiscal - obrigatório */}
          <div>
            <Label>Documento Fiscal *</Label>
            <Select value={formData.documento_tipo} onValueChange={(v) => setFormData({ ...formData, documento_tipo: v })}>
              <SelectTrigger className={!formData.documento_tipo ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecionar tipo de documento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NOTA_FISCAL">Nota Fiscal</SelectItem>
                <SelectItem value="RECIBO">Recibo</SelectItem>
                <SelectItem value="NOTA_DE_DEBITO">Nota de Débito</SelectItem>
                <SelectItem value="SEM_DOCUMENTO">Sem Documento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Client - obrigatório */}
          <div>
            <Label>Cliente (empresa) *</Label>
            <p className="text-[10px] text-muted-foreground -mt-0.5 mb-1">
              Empresa/CNPJ ao qual a despesa será atribuída.
            </p>
            <Select value={formData.cliente_id} onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}>
              <SelectTrigger className={!formData.cliente_id ? 'border-destructive' : ''}>
                <SelectValue placeholder="Vincular a um cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Multi-Entity Selector */}
          <MultiEntitySelector
            selectedIds={entityIds}
            onChange={setEntityIds}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data de Início</Label>
              <Input 
                type="date" value={formData.data_inicio}
                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
              />
            </div>
            <div>
              <Label>Data de Fim (opcional)</Label>
              <Input 
                type="date" value={formData.data_fim}
                onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea 
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas adicionais..." rows={2}
            />
          </div>

          {valor > 0 && (
            <Card className="bg-expense/5 border-expense/20">
              <CardContent className="p-3 text-sm space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-expense" />
                  <span className="font-medium">Resumo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Mensal:</span>
                  <span className="font-bold text-expense">{formatCurrency(valor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vencimento:</span>
                  <span>Todo dia {formData.dia_vencimento}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Projeção Anual:</span>
                  <span className="font-medium">{formatCurrency(annualProjection)}</span>
                </div>
                {entityIds.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Responsáveis:</span>
                    <span className="font-medium">{entityIds.length} vinculado(s)</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting} className="flex-1">
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Criar Despesa e Gerar Lançamentos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
