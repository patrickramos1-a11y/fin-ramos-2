import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput, parseBRLToNumber } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowDownCircle, ArrowUpCircle, Check, FileText, Loader2, Repeat, Search, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/data/mockData';
import { useAuth } from '@/hooks/useAuth';
import { useCreateTransaction, useClients } from '@/hooks/useTransactions';
import { usePaymentMethods, useTransactionCategories, type TransactionCategory } from '@/hooks/useFinancialConfig';
import { useSaveTransactionEntities } from '@/hooks/useTransactionEntities';
import { useNFEditavel, useNFPercentual } from '@/hooks/useFiscalConfig';
import { CategoryFilteredSelector } from './CategoryFilteredSelector';
import { MultiEntitySelector } from './MultiEntitySelector';
import { cn } from '@/lib/utils';

interface SmartTransactionFormProps {
  open: boolean;
  onClose: () => void;
  defaultMonth?: number;
  defaultYear?: number;
}

type SmartStep = 'category' | 'details' | 'schedule' | 'review';
type ScheduleMode = 'single' | 'installments' | 'recurring_count';

const stepOrder: SmartStep[] = ['category', 'details', 'schedule', 'review'];

const stepLabel: Record<SmartStep, string> = {
  category: 'Categoria',
  details: 'Dados',
  schedule: 'Comportamento',
  review: 'Revisao',
};

const addMonths = (date: Date, months: number) => {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
};

const toISODate = (date: Date) => date.toISOString().split('T')[0];

export function SmartTransactionForm({ open, onClose, defaultMonth, defaultYear }: SmartTransactionFormProps) {
  const now = new Date();
  const initialMonth = defaultMonth || now.getMonth() + 1;
  const initialYear = defaultYear || now.getFullYear();

  const [step, setStep] = useState<SmartStep>('category');
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(null);
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterCostCenterId, setFilterCostCenterId] = useState('');
  const [overrideAccountId, setOverrideAccountId] = useState('');
  const [resolvedAccountId, setResolvedAccountId] = useState<string | null>(null);
  const [resolvedCostCenterId, setResolvedCostCenterId] = useState<string | null>(null);
  const [entityIds, setEntityIds] = useState<string[]>([]);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('single');
  const [repeatCount, setRepeatCount] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    cliente_id: '',
    forma_pagamento_id: '',
    data_vencimento: toISODate(now),
    competencia_mes: initialMonth,
    competencia_ano: initialYear,
    documento_recebimento: '',
    origem_receita: '',
    nf_percentual_aplicado: '',
    notes: '',
  });

  const { data: categories } = useTransactionCategories();
  const { data: clients } = useClients();
  const { data: paymentMethods } = usePaymentMethods();
  const createTransaction = useCreateTransaction();
  const saveEntities = useSaveTransactionEntities();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const nfPercentualPadrao = useNFPercentual();
  const nfEditavel = useNFEditavel();

  const tipo = selectedCategory?.type || 'SAIDA';
  const isEntrada = tipo === 'ENTRADA';
  const valorTotal = parseBRLToNumber(formData.valor) || 0;
  const isNF = formData.documento_recebimento === 'NOTA_FISCAL';
  const nfPercentual = formData.nf_percentual_aplicado
    ? Number(formData.nf_percentual_aplicado) / 100
    : nfPercentualPadrao;
  const valorImpostoNF = isEntrada && isNF ? valorTotal * nfPercentual : 0;
  const valorLiquidoNF = isEntrada && isNF ? valorTotal - valorImpostoNF : valorTotal;
  const perInstallmentValue = scheduleMode === 'installments'
    ? Math.round((valorTotal / repeatCount) * 100) / 100
    : valorTotal;

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    return (categories || [])
      .filter((category) => category.active)
      .filter((category) => !q || category.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [categories, categorySearch]);

  const reset = () => {
    setStep('category');
    setCategorySearch('');
    setSelectedCategory(null);
    setFilterAccountId('');
    setFilterCostCenterId('');
    setOverrideAccountId('');
    setResolvedAccountId(null);
    setResolvedCostCenterId(null);
    setEntityIds([]);
    setScheduleMode('single');
    setRepeatCount(2);
    setFormData({
      descricao: '',
      valor: '',
      cliente_id: '',
      forma_pagamento_id: '',
      data_vencimento: toISODate(new Date()),
      competencia_mes: initialMonth,
      competencia_ano: initialYear,
      documento_recebimento: '',
      origem_receita: '',
      nf_percentual_aplicado: '',
      notes: '',
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const currentStepIndex = stepOrder.indexOf(step);
  const goNext = () => setStep(stepOrder[Math.min(stepOrder.length - 1, currentStepIndex + 1)]);
  const goBack = () => setStep(stepOrder[Math.max(0, currentStepIndex - 1)]);

  const categoryReady = Boolean(selectedCategory && resolvedAccountId);
  const detailsReady = formData.descricao.trim().length > 0
    && valorTotal > 0
    && formData.cliente_id.length > 0
    && formData.forma_pagamento_id.length > 0
    && formData.documento_recebimento.length > 0
    && entityIds.length > 0
    && (!isEntrada || formData.origem_receita.length > 0);
  const canSubmit = categoryReady && detailsReady;

  const buildOccurrences = () => {
    const baseDate = new Date(`${formData.data_vencimento}T00:00:00`);
    const count = scheduleMode === 'single' ? 1 : repeatCount;

    return Array.from({ length: count }, (_, index) => {
      const dueDate = addMonths(baseDate, index);
      const month = dueDate.getMonth() + 1;
      const year = dueDate.getFullYear();
      const suffix = scheduleMode === 'single'
        ? ''
        : scheduleMode === 'installments'
        ? ` - Parcela ${index + 1}/${count}`
        : ` - Recorrencia ${index + 1}/${count}`;

      return {
        descricao: `${formData.descricao}${suffix}`,
        valor: scheduleMode === 'installments' ? perInstallmentValue : valorTotal,
        competencia_mes: month,
        competencia_ano: year,
        data_vencimento: toISODate(dueDate),
      };
    });
  };

  const occurrences = buildOccurrences();

  const handleSubmit = async () => {
    if (!selectedCategory || !resolvedAccountId || !canSubmit) {
      toast.error('Preencha os campos obrigatorios antes de salvar.');
      return;
    }

    setIsSubmitting(true);
    try {
      for (const occurrence of occurrences) {
        const result = await createTransaction.mutateAsync({
          tipo_movimento: selectedCategory.type,
          natureza: scheduleMode === 'single' ? 'AVULSA' : 'RECORRENTE',
          origem: 'LANCAMENTO_MANUAL',
          cliente_id: formData.cliente_id || null,
          competencia_mes: occurrence.competencia_mes,
          competencia_ano: occurrence.competencia_ano,
          valor: occurrence.valor,
          data_vencimento: occurrence.data_vencimento,
          descricao: occurrence.descricao,
          categoria_id: selectedCategory.id,
          centro_custo_id: resolvedCostCenterId,
          conta_id: resolvedAccountId,
          forma_pagamento_id: formData.forma_pagamento_id || null,
          notes: formData.notes || null,
          entity_id: entityIds[0] || null,
          documento_recebimento: formData.documento_recebimento || null,
          documento_tipo: formData.documento_recebimento || null,
          origem_receita: isEntrada ? formData.origem_receita || null : null,
          nf_percentual_aplicado: isEntrada && isNF ? nfPercentual : null,
          valor_imposto_nf: isEntrada && isNF ? valorImpostoNF : null,
          valor_liquido_nf: isEntrada && isNF ? valorLiquidoNF : null,
          created_by_user_id: user?.id,
        } as any);

        if (entityIds.length > 0 && result?.id) {
          await saveEntities.mutateAsync({ transactionId: result.id, entityIds });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success(occurrences.length === 1 ? 'Lancamento criado com sucesso.' : `${occurrences.length} lancamentos criados com sucesso.`);
      handleClose();
    } catch (error: any) {
      console.error('Smart transaction creation error:', error);
      toast.error('Erro ao criar lancamento: ' + (error?.message || 'tente novamente'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const StepPill = ({ value }: { value: SmartStep }) => {
    const index = stepOrder.indexOf(value);
    const active = value === step;
    const done = index < currentStepIndex;
    return (
      <button
        type="button"
        onClick={() => {
          if (index <= currentStepIndex) setStep(value);
        }}
        className={cn(
          'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors',
          active && 'border-primary bg-primary text-primary-foreground',
          done && !active && 'border-income/30 bg-income/10 text-income',
          !active && !done && 'text-muted-foreground'
        )}
      >
        <span className="font-semibold">{index + 1}</span>
        {stepLabel[value]}
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Lancamento Inteligente
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {stepOrder.map((item) => <StepPill key={item} value={item} />)}
        </div>

        <Separator />

        {step === 'category' && (
          <div className="space-y-4">
            <div>
              <Label>Categoria *</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder="Buscar categoria..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid gap-2 max-h-72 overflow-y-auto">
              {filteredCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(category);
                    setOverrideAccountId('');
                    setResolvedAccountId(category.default_account_id || null);
                    setResolvedCostCenterId(category.cost_center_id || null);
                  }}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5',
                    selectedCategory?.id === category.id && 'border-primary bg-primary/10'
                  )}
                >
                  <span className="h-4 w-4 rounded-full" style={{ backgroundColor: category.color || '#10b981' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {category.default_account?.name || 'Sem conta padrao'} • {category.cost_center?.name || 'Sem centro de custo'}
                    </p>
                  </div>
                  <Badge variant="outline" className={category.type === 'ENTRADA' ? 'text-income' : 'text-expense'}>
                    {category.type === 'ENTRADA' ? 'Entrada' : 'Despesa'}
                  </Badge>
                </button>
              ))}
            </div>

            {selectedCategory && (
              <CategoryFilteredSelector
                tipo={selectedCategory.type}
                subtype={selectedCategory.subtype as any}
                selectedCategoryId={selectedCategory.id}
                onCategoryChange={(value) => {
                  const category = categories?.find((item) => item.id === value) || null;
                  setSelectedCategory(category);
                  setOverrideAccountId('');
                }}
                filterAccountId={filterAccountId}
                onFilterAccountChange={(value) => setFilterAccountId(value === 'all' ? '' : value)}
                filterCostCenterId={filterCostCenterId}
                onFilterCostCenterChange={(value) => setFilterCostCenterId(value === 'all' ? '' : value)}
                overrideAccountId={overrideAccountId}
                onOverrideAccountChange={setOverrideAccountId}
                onResolvedAccountChange={setResolvedAccountId}
                onResolvedCostCenterChange={setResolvedCostCenterId}
              />
            )}

            {!resolvedAccountId && selectedCategory && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Esta categoria ainda nao possui conta padrao. Escolha uma conta de excecao ou ajuste a categoria nas configuracoes.
              </p>
            )}
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge variant="outline" className={isEntrada ? 'text-income' : 'text-expense'}>
                {isEntrada ? <ArrowDownCircle className="mr-1 h-3 w-3" /> : <ArrowUpCircle className="mr-1 h-3 w-3" />}
                {isEntrada ? 'Entrada' : 'Despesa'}
              </Badge>
              <Badge variant="outline">{selectedCategory?.name}</Badge>
            </div>

            <div>
              <Label>Descricao *</Label>
              <Input
                value={formData.descricao}
                onChange={(event) => setFormData({ ...formData, descricao: event.target.value })}
                placeholder="Ex: Salario Celine, consultoria, compra de material..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Valor *</Label>
                <CurrencyInput
                  value={formData.valor}
                  onValueChange={(value) => setFormData({ ...formData, valor: value === null ? '' : String(value) })}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(event) => setFormData({ ...formData, data_vencimento: event.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Cliente *</Label>
                <Select value={formData.cliente_id} onValueChange={(value) => setFormData({ ...formData, cliente_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Forma de pagamento *</Label>
                <Select value={formData.forma_pagamento_id} onValueChange={(value) => setFormData({ ...formData, forma_pagamento_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar forma" /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods?.filter((method) => method.active).map((method) => (
                      <SelectItem key={method.id} value={method.id}>{method.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <MultiEntitySelector selectedIds={entityIds} onChange={setEntityIds} required />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isEntrada && (
                <div>
                  <Label>Origem da receita *</Label>
                  <Select value={formData.origem_receita} onValueChange={(value) => setFormData({ ...formData, origem_receita: value })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SERVICO">Servico</SelectItem>
                      <SelectItem value="VENDA">Venda</SelectItem>
                      <SelectItem value="REEMBOLSO">Reembolso</SelectItem>
                      <SelectItem value="AJUSTE_FINANCEIRO">Ajuste financeiro</SelectItem>
                      <SelectItem value="OUTRO">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Documento *</Label>
                <Select
                  value={formData.documento_recebimento}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    documento_recebimento: value,
                    nf_percentual_aplicado: value === 'NOTA_FISCAL' ? String(nfPercentualPadrao * 100) : '',
                  })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar documento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOTA_FISCAL">Nota Fiscal</SelectItem>
                    <SelectItem value="RECIBO">Recibo</SelectItem>
                    <SelectItem value="NOTA_DE_DEBITO">Nota de Debito</SelectItem>
                    {!isEntrada && <SelectItem value="SEM_DOCUMENTO">Sem Documento</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isEntrada && isNF && valorTotal > 0 && (
              <Card className="border-income/20 bg-income/5">
                <CardContent className="p-3 text-sm space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <FileText className="h-4 w-4" />
                    Calculo da NF
                  </div>
                  {nfEditavel && (
                    <div>
                      <Label className="text-xs">Percentual da NF (%)</Label>
                      <Input
                        value={formData.nf_percentual_aplicado}
                        onChange={(event) => setFormData({ ...formData, nf_percentual_aplicado: event.target.value })}
                        className="h-8 max-w-32"
                      />
                    </div>
                  )}
                  <div className="flex justify-between"><span>Bruto</span><strong>{formatCurrency(valorTotal)}</strong></div>
                  <div className="flex justify-between text-expense"><span>Imposto</span><strong>- {formatCurrency(valorImpostoNF)}</strong></div>
                  <div className="flex justify-between text-income"><span>Liquido</span><strong>{formatCurrency(valorLiquidoNF)}</strong></div>
                </CardContent>
              </Card>
            )}

            <div>
              <Label>Observacoes</Label>
              <Textarea
                value={formData.notes}
                onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                rows={2}
                placeholder="Detalhes adicionais..."
              />
            </div>
          </div>
        )}

        {step === 'schedule' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { value: 'single', title: 'Pontual', desc: 'Cria uma unica transacao' },
                { value: 'installments', title: 'Parcelado', desc: 'Divide o valor em parcelas mensais' },
                { value: 'recurring_count', title: 'Recorrente', desc: 'Repete o mesmo valor por X meses' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setScheduleMode(option.value as ScheduleMode)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors hover:border-primary/50',
                    scheduleMode === option.value && 'border-primary bg-primary/10'
                  )}
                >
                  <p className="font-semibold">{option.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{option.desc}</p>
                </button>
              ))}
            </div>

            {scheduleMode !== 'single' && (
              <div className="max-w-xs">
                <Label>Quantidade</Label>
                <Select value={String(repeatCount)} onValueChange={(value) => setRepeatCount(Number(value))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 23 }, (_, index) => index + 2).map((count) => (
                      <SelectItem key={count} value={String(count)}>{count}x</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Repeat className="h-4 w-4" />
                  Previa de geracao
                </div>
                {occurrences.slice(0, 6).map((occurrence) => (
                  <div key={`${occurrence.competencia_ano}-${occurrence.competencia_mes}-${occurrence.descricao}`} className="flex justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    <span>{String(occurrence.competencia_mes).padStart(2, '0')}/{occurrence.competencia_ano}</span>
                    <span className="font-medium">{formatCurrency(occurrence.valor)}</span>
                  </div>
                ))}
                {occurrences.length > 6 && <p className="text-xs text-muted-foreground">+ {occurrences.length - 6} competencias</p>}
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Resumo</p>
                    <p className="text-lg font-bold">{formData.descricao || 'Lancamento sem descricao'}</p>
                  </div>
                  <Badge variant="outline" className={isEntrada ? 'text-income' : 'text-expense'}>
                    {isEntrada ? 'Entrada' : 'Despesa'}
                  </Badge>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Categoria:</span> <strong>{selectedCategory?.name}</strong></div>
                  <div><span className="text-muted-foreground">Valor base:</span> <strong>{formatCurrency(valorTotal)}</strong></div>
                  <div><span className="text-muted-foreground">Lancamentos:</span> <strong>{occurrences.length}</strong></div>
                  <div><span className="text-muted-foreground">Natureza:</span> <strong>{scheduleMode === 'single' ? 'Pontual' : 'Recorrente'}</strong></div>
                </div>
                <p className="rounded-lg bg-background p-3 text-xs text-muted-foreground">
                  O sistema vai herdar conta e centro de custo pela categoria. Este lancamento entra no fluxo de aprovacao conforme a regra atual do sistema.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <Button variant="outline" onClick={currentStepIndex === 0 ? handleClose : goBack}>
            {currentStepIndex === 0 ? 'Cancelar' : 'Voltar'}
          </Button>
          {step !== 'review' ? (
            <Button
              onClick={goNext}
              disabled={(step === 'category' && !categoryReady) || (step === 'details' && !detailsReady)}
            >
              Continuar
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Salvar lancamento
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
