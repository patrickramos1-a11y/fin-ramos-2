import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowDownCircle, ArrowUpCircle, Loader2, Send, RefreshCw,
  Repeat, Sparkles, ChevronUp, ChevronDown,
  Plus, Eye, Keyboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useTransactionCategories, useAccounts, usePaymentMethods } from '@/hooks/useFinancialConfig';
import { useCreateTransaction, useClients } from '@/hooks/useTransactions';
import { useSaveTransactionEntities } from '@/hooks/useTransactionEntities';
import { useFinancialEntities } from '@/hooks/useFinancialEntities';
import { useContractPlans, useCreateContractWithInstallments, useMinimumWageConfig } from '@/hooks/useRecurringContracts';
import { normalizeForSearch } from './CategorySearchInput';
import { MultiEntitySelector } from './MultiEntitySelector';
import { CategoryCombobox } from './CategoryCombobox';
import { CategoryChip } from './lancamento/CategoryChip';
import { QuickClientCombobox } from './lancamento/QuickClientCombobox';
import { CurrencyInput } from '@/components/ui/currency-input';
import { resolveAccountAndCostCenter } from '@/lib/financial/categoryResolution';
import { Switch } from '@/components/ui/switch';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  defaultMonth: number;
  defaultYear: number;
  /** Categorias que precisam de fluxo dedicado (RECORRENTE/FIXA) */
  onNeedsDedicatedFlow: (kind: 'recurring' | 'fixa') => void;
  onCreated?: () => void;
}

export function InlineLancamentoForm({ defaultMonth, defaultYear, onNeedsDedicatedFlow, onCreated }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: categories } = useTransactionCategories();
  const { data: accounts } = useAccounts();
  const { data: clients } = useClients();
  const { data: entities } = useFinancialEntities();
  const { data: paymentMethods } = usePaymentMethods();
  const { data: contractPlans } = useContractPlans();
  const createTransaction = useCreateTransaction();
  const saveEntities = useSaveTransactionEntities();
  const createRecurringContract = useCreateContractWithInstallments();

  const today = new Date().toISOString().split('T')[0];

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [valorNum, setValorNum] = useState<number>(0);
  const [dataVenc, setDataVenc] = useState(today);
  const [descricao, setDescricao] = useState('');
  const [descricaoTouched, setDescricaoTouched] = useState(false);
  const [clienteId, setClienteId] = useState('');
  const [entityIds, setEntityIds] = useState<string[]>([]);
  const [accountOverride, setAccountOverride] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [structuredStep, setStructuredStep] = useState(1);

  // Status/competência/pagamento (contexto rico)
  const [status, setStatus] = useState<'EM_ABERTO' | 'PAGO'>('EM_ABERTO');
  const [dataPagamento, setDataPagamento] = useState(today);
  const [competenciaMes, setCompetenciaMes] = useState(defaultMonth);
  const [competenciaAno, setCompetenciaAno] = useState(defaultYear);
  const { data: minimumWageConfigs } = useMinimumWageConfig(competenciaAno);

  // Dados fiscais (Entrada Avulsa)
  const [origemReceita, setOrigemReceita] = useState('');
  const [documentoRecebimento, setDocumentoRecebimento] = useState('');

  // Repetição simples
  const [enableRep, setEnableRep] = useState(false);
  const [repCount, setRepCount] = useState(2);
  const [pricingModel, setPricingModel] = useState<'SM' | 'FIXED'>('SM');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [customFactor, setCustomFactor] = useState('');
  const [fixedValue, setFixedValue] = useState('');
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'value' | 'factor'>('percent');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountMonths, setDiscountMonths] = useState('');
  const [discountUntil, setDiscountUntil] = useState('');
  const [discountDuration, setDiscountDuration] = useState<'months' | 'date'>('months');
  const [exigirNF, setExigirNF] = useState<'SEMPRE' | 'NUNCA' | 'PERGUNTAR'>('PERGUNTAR');

  const activeCategories = (categories || []).filter(c => c.active);
  const filtered = useMemo(() => {
    if (!search.trim()) return activeCategories;
    const q = normalizeForSearch(search);
    return activeCategories.filter(c => normalizeForSearch(c.name).includes(q));
  }, [activeCategories, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof activeCategories> = {
      'ENTRADA-RECORRENTE': [], 'ENTRADA-AVULSA': [],
      'SAIDA-FIXA': [], 'SAIDA-VARIAVEL': [],
    };
    for (const c of filtered) {
      const key = `${c.type}-${c.subtype}`;
      if (groups[key]) groups[key].push(c);
    }
    return groups;
  }, [filtered]);

  const selected = activeCategories.find(c => c.id === categoryId) || null;
  const resolution = useMemo(
    () => resolveAccountAndCostCenter(selected as any, accountOverride),
    [selected, accountOverride]
  );

  const isEntrada = selected?.type === 'ENTRADA';
  const isEntradaRecorrente = selected?.type === 'ENTRADA' && selected?.subtype === 'RECORRENTE';
  const isStructuredFlow = selected?.subtype === 'RECORRENTE' || selected?.subtype === 'FIXA';
  const canRepeat = selected?.subtype === 'RECORRENTE' || selected?.subtype === 'FIXA' || selected?.subtype === 'VARIAVEL';
  const needsDedicated = false;

  const accObj = accounts?.find(a => a.id === resolution.accountId);
  const selectedPlan = contractPlans?.find((plan) => plan.id === selectedPlanId);
  const minimumWageValue = minimumWageConfigs?.[0]?.value || 1518;
  const recurringFixedValue = Number(fixedValue) || 0;
  const effectiveFactor = customFactor ? Number(customFactor) : selectedPlan?.minimum_wage_factor || 1;
  const recurringMonthlyValue = pricingModel === 'FIXED'
    ? recurringFixedValue
    : effectiveFactor * minimumWageValue;
  const discountNumber = Number(discountAmount) || 0;
  const recurringDiscountedValue = !hasDiscount
    ? recurringMonthlyValue
    : discountType === 'percent'
    ? recurringMonthlyValue * (1 - discountNumber / 100)
    : discountType === 'value'
    ? recurringMonthlyValue - discountNumber
    : (effectiveFactor - discountNumber) * minimumWageValue;
  const recurringInstallmentsCount = useMemo(() => {
    if (!dataVenc) return 0;
    const start = new Date(dataVenc + 'T00:00:00');
    if (Number.isNaN(start.getTime())) return 0;
    return Math.max(0, 12 - start.getMonth());
  }, [dataVenc]);

  // Default Ramos Engenharia client for fixed expenses (rule from memory)
  const ramosClient = useMemo(
    () => (clients || []).find((c: any) => /ramos/i.test(c.name)),
    [clients]
  );
  const ramosEntity = useMemo(
    () => (entities || []).find((e) => /ramos/i.test(e.name)),
    [entities]
  );

  useEffect(() => {
    if (isEntrada && entityIds.length > 0) setEntityIds([]);
  }, [isEntrada, entityIds.length]);

  useEffect(() => {
    setStructuredStep(1);
  }, [categoryId]);

  const reset = () => {
    setSearch(''); setCategoryId(''); setValorNum(0); setDataVenc(today);
    setDescricao(''); setDescricaoTouched(false);
    setClienteId(''); setEntityIds([]); setAccountOverride('');
    setPaymentMethodId(''); setNotes('');
    setEnableRep(false); setRepCount(2);
    setPricingModel('SM'); setSelectedPlanId(''); setCustomFactor(''); setFixedValue('');
    setHasDiscount(false); setDiscountType('percent'); setDiscountAmount(''); setDiscountMonths('');
    setDiscountUntil(''); setDiscountDuration('months');
    setExigirNF('PERGUNTAR');
    setStructuredStep(1);
    setStatus('EM_ABERTO'); setDataPagamento(today);
    setCompetenciaMes(defaultMonth); setCompetenciaAno(defaultYear);
    setOrigemReceita(''); setDocumentoRecebimento('');
  };

  const fiscalRequired = !!isEntrada;
  const paidRequired = status === 'PAGO';
  const clientRequired = true;
  const entityRequired = !isEntrada;
  const clientStepValid = isEntradaRecorrente
    ? !!clienteId && !!dataVenc
    : !!clienteId && (!entityRequired || entityIds.length > 0);

  const canSubmit =
    !!selected && !needsDedicated && valorNum > 0 && !!dataVenc &&
    !!resolution.accountId &&
    (!clientRequired || !!clienteId) &&
    (!entityRequired || entityIds.length > 0) &&
    (!fiscalRequired || (!!origemReceita && !!documentoRecebimento)) &&
    (!paidRequired || (!!dataPagamento && !!paymentMethodId)) &&
    !!descricao.trim();
  const canSubmitRecurringContract =
    !!selected && isEntradaRecorrente && !!clienteId && !!dataVenc &&
    (pricingModel === 'FIXED' ? recurringFixedValue > 0 : !!selectedPlanId) &&
    !!origemReceita && !!documentoRecebimento;
  const finalCanSubmit = isEntradaRecorrente ? canSubmitRecurringContract : canSubmit;

  const structuredStepValid =
    structuredStep === 1 ? clientStepValid :
    structuredStep === 2 ? (isEntradaRecorrente ? (pricingModel === 'FIXED' ? recurringFixedValue > 0 : !!selectedPlanId) : valorNum > 0 && !!dataVenc && !!descricao.trim() && !!resolution.accountId) :
    structuredStep === 3 ? (!fiscalRequired || (!!origemReceita && !!documentoRecebimento)) && (!paidRequired || (!!dataPagamento && !!paymentMethodId)) :
    (isEntradaRecorrente ? canSubmitRecurringContract : canSubmit);

  const handleSubmit = async (andNew = false) => {
    if (!selected) return;
    if (isEntradaRecorrente) {
      if (!canSubmitRecurringContract) return;
      setSubmitting(true);
      try {
        await createRecurringContract.mutateAsync({
          client_id: clienteId,
          plan_id: pricingModel === 'SM' ? selectedPlanId : undefined,
          custom_minimum_wage_factor: pricingModel === 'SM' && customFactor ? Number(customFactor) : undefined,
          fixed_value: pricingModel === 'FIXED' ? recurringFixedValue : undefined,
          start_date: dataVenc,
          notes: notes || undefined,
          year: competenciaAno,
          dia_vencimento: new Date(dataVenc + 'T00:00:00').getDate(),
          exigir_emissao_nf: exigirNF,
          ...(hasDiscount && discountNumber > 0 ? {
            discount_type: discountType,
          discount_amount: discountNumber,
            discount_months: discountDuration === 'months' && discountMonths ? Number(discountMonths) : undefined,
            discount_until: discountDuration === 'date' && discountUntil ? discountUntil : undefined,
          } : {}),
        });
        reset();
        onCreated?.();
      } catch (e: any) {
        toast.error(e?.message || 'Erro ao criar contrato recorrente');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const reps = enableRep && repCount > 1 ? repCount : 1;
      const valorParcela = valorNum;

      let m = competenciaMes;
      let y = competenciaAno;
      const baseDay = new Date(dataVenc + 'T00:00:00').getDate();

      for (let i = 0; i < reps; i++) {
        const due = new Date(y, m - 1, baseDay).toISOString().split('T')[0];
        const suffix = reps > 1
          ? ` - Repetição ${i + 1}/${reps}`
          : '';
        const isPaidThis = paidRequired && i === 0;
        const result = await createTransaction.mutateAsync({
          tipo_movimento: selected.type,
          natureza: selected.subtype === 'AVULSA' ? 'AVULSA' : 'RECORRENTE',
          origem: 'LANCAMENTO_MANUAL',
          cliente_id: clienteId || null,
          competencia_mes: m,
          competencia_ano: y,
          valor: valorParcela,
          data_vencimento: due,
          descricao: (descricao || selected.name) + suffix,
          categoria_id: selected.id,
          centro_custo_id: resolution.costCenterId,
          conta_id: resolution.accountId,
          notes: notes || null,
          entity_id: !isEntrada ? entityIds[0] || null : null,
          created_by_user_id: user?.id,
          status: isPaidThis ? 'PAGO' : 'EM_ABERTO',
          valor_pago: isPaidThis ? valorParcela : null,
          data_pagamento: isPaidThis ? dataPagamento : null,
          origem_receita: isEntrada ? origemReceita : null,
          documento_recebimento: isEntrada ? documentoRecebimento : null,
        } as any);
        if (!isEntrada && entityIds.length > 0 && result?.id) {
          await saveEntities.mutateAsync({ transactionId: result.id, entityIds });
        }
        m++;
        if (m > 12) { m = 1; y++; }
      }

      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['recent-launches'] });
      toast.success(reps > 1 ? `${reps} lançamentos criados!` : 'Lançamento criado!');
      if (andNew) {
        setValorNum(0);
        setDescricao('');
        setDescricaoTouched(false);
        setNotes('');
        setStatus('EM_ABERTO');
        setEnableRep(false);
        setRepCount(2);
        toast.message('Pronto para o próximo ⚡');
      } else {
        reset();
      }
      onCreated?.();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar lançamento');
    } finally {
      setSubmitting(false);
    }
  };

  // Atalhos: Ctrl/Cmd+Enter = Lançar | Ctrl/Cmd+Shift+Enter = Lançar e novo | Esc = limpar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key === 'Enter') {
        e.preventDefault();
        if (finalCanSubmit && !submitting) handleSubmit(e.shiftKey);
      } else if (e.key === 'Escape' && selected) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalCanSubmit, submitting, selected]);

  const subtypeBadge = selected && {
    'RECORRENTE': { label: 'Entrada Recorrente', cls: 'border-income/40 text-income' },
    'AVULSA': { label: 'Entrada Avulsa', cls: 'border-income/40 text-income' },
    'FIXA': { label: 'Despesa Fixa', cls: 'border-expense/40 text-expense' },
    'VARIAVEL': { label: 'Despesa Variável', cls: 'border-expense/40 text-expense' },
  }[selected.subtype || 'AVULSA'];

  const SUBTYPE_HEADERS: Record<string, { label: string; icon: any; color: string }> = {
    'ENTRADA-RECORRENTE': { label: 'Entradas Recorrentes', icon: RefreshCw, color: 'text-income' },
    'ENTRADA-AVULSA': { label: 'Entradas Avulsas', icon: ArrowDownCircle, color: 'text-income' },
    'SAIDA-FIXA': { label: 'Despesas Fixas', icon: RefreshCw, color: 'text-expense' },
    'SAIDA-VARIAVEL': { label: 'Despesas Variáveis', icon: ArrowUpCircle, color: 'text-expense' },
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className={cn("p-4 lg:p-6", collapsed ? "space-y-0" : "space-y-4")}>
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
            !selected && "bg-muted text-muted-foreground",
            selected?.type === 'ENTRADA' && "bg-income text-white",
            selected?.type === 'SAIDA' && "bg-expense text-white"
          )}>
            {selected?.type === 'ENTRADA' ? (
              <ArrowDownCircle className="w-4 h-4" />
            ) : selected?.type === 'SAIDA' ? (
              <ArrowUpCircle className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base lg:text-lg font-bold">Novo lançamento</h2>
            <p className="text-xs text-muted-foreground truncate">
              {collapsed
                ? 'Clique para expandir e criar um novo lançamento.'
                : 'A categoria define tipo, conta e centro de custo automaticamente.'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 h-8 w-8 p-0"
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expandir' : 'Minimizar'}
            title={collapsed ? 'Expandir' : 'Minimizar'}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
        </div>

        {!collapsed && (
          <div className="space-y-4">
            {/* Linha 1: Categoria — combobox compacto OU chip pós-seleção */}
            {!selected ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  1. Categoria *
                </Label>
                <CategoryCombobox
                  categories={activeCategories as any}
                  accounts={accounts as any}
                  value={categoryId}
                  onChange={(id) => { setCategoryId(id); setAccountOverride(''); }}
                />
                <p className="text-[11px] text-muted-foreground">
                  A categoria define automaticamente tipo, conta e centro de custo.
                </p>
              </div>
            ) : (
              <CategoryChip
                category={selected as any}
                accountName={accObj?.name}
                onChange={() => { setCategoryId(''); setAccountOverride(''); }}
              />
            )}

        {selected && !needsDedicated && (
          <>
            {/* Badges removidos — agora exibidos no CategoryChip */}

            {isStructuredFlow && (
              <div className="grid grid-cols-4 gap-2 rounded-xl border bg-background/70 p-2">
                {[
                  ['Cliente', 'Quem/para quem'],
                  ['Valor', 'Plano e dados'],
                  ['Regras', 'Fiscal e repetição'],
                  ['Confirmar', 'Revisão final'],
                ].map(([title, subtitle], idx) => {
                  const number = idx + 1;
                  const active = structuredStep === number;
                  const done = structuredStep > number;
                  return (
                    <button
                      key={title}
                      type="button"
                      onClick={() => number <= structuredStep && setStructuredStep(number)}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-left transition-colors',
                        active && 'border-primary bg-primary text-primary-foreground',
                        done && !active && 'border-income/30 bg-income/10 text-income',
                        !active && !done && 'border-border text-muted-foreground'
                      )}
                    >
                      <span className="block text-xs font-bold">{number}. {title}</span>
                      <span className="block text-[10px] opacity-80">{subtitle}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {isEntradaRecorrente && structuredStep === 2 && (
              <div className="space-y-4 rounded-xl border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
                  <div>
                    <p className="text-sm font-semibold">Contrato recorrente por plano</p>
                    <p className="text-xs text-muted-foreground">
                      Esta etapa substitui o modal antigo: plano por salário mínimo ou mensalidade fixa.
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {recurringInstallmentsCount} parcelas em {competenciaAno}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={pricingModel === 'SM' ? 'default' : 'outline'}
                    onClick={() => setPricingModel('SM')}
                  >
                    Salário mínimo
                  </Button>
                  <Button
                    type="button"
                    variant={pricingModel === 'FIXED' ? 'default' : 'outline'}
                    onClick={() => setPricingModel('FIXED')}
                  >
                    Valor fixo
                  </Button>
                </div>

                {pricingModel === 'SM' ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Plano *</Label>
                      <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                        <SelectTrigger className={!selectedPlanId ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Selecionar plano" />
                        </SelectTrigger>
                        <SelectContent>
                          {contractPlans?.filter((plan) => plan.active).map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name} - {plan.minimum_wage_factor} SM
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Fator customizado</Label>
                      <Input
                        type="number"
                        step="0.25"
                        min="0"
                        value={customFactor}
                        onChange={(e) => setCustomFactor(e.target.value)}
                        placeholder={selectedPlan ? String(selectedPlan.minimum_wage_factor) : 'Opcional'}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs">Valor fixo mensal *</Label>
                    <CurrencyInput
                      value={fixedValue}
                      onValueChange={(value) => setFixedValue(value === null ? '' : String(value))}
                      placeholder="0,00"
                    />
                  </div>
                )}

                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Início *</Label>
                    <Input type="date" value={dataVenc} onChange={(e) => setDataVenc(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Ano</Label>
                    <Select value={String(competenciaAno)} onValueChange={(v) => setCompetenciaAno(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[defaultYear - 1, defaultYear, defaultYear + 1].map((year) => (
                          <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg border bg-background p-2 text-xs">
                    <span className="text-muted-foreground">Mensalidade</span>
                    <p className="text-base font-bold text-income">
                      R$ {Math.max(0, recurringMonthlyValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {pricingModel === 'SM'
                        ? `${effectiveFactor.toLocaleString('pt-BR')} SM x R$ ${minimumWageValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : 'Valor fixo informado manualmente'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isEntradaRecorrente && structuredStep === 1 && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Cliente do contrato *</Label>
                  <QuickClientCombobox
                    clients={(clients || []) as any}
                    value={clienteId}
                    onChange={setClienteId}
                    required
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Para entrada recorrente, o cliente é quem gera as mensalidades do contrato.
                  </p>
                </div>
                <div>
                  <Label className="text-xs">Data de início *</Label>
                  <Input type="date" value={dataVenc} onChange={(e) => setDataVenc(e.target.value)} />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    O dia escolhido será usado como vencimento das parcelas.
                  </p>
                </div>
              </div>
            )}

            {/* Linha 2: valor + data + entidade */}
            {(!isEntradaRecorrente && (!isStructuredFlow || structuredStep === 1 || structuredStep === 2)) && (
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Valor *</Label>
                <CurrencyInput
                  value={valorNum}
                  onValueChange={(n) => setValorNum(n ?? 0)}
                  className={valorNum <= 0 ? 'border-destructive' : ''}
                />
              </div>
              <div>
                <Label className="text-xs">Vencimento *</Label>
                <Input type="date" value={dataVenc} onChange={(e) => setDataVenc(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Cliente *</Label>
                {!isEntrada && ramosClient && (
                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={clienteId === ramosClient.id ? 'default' : 'outline'}
                      onClick={() => setClienteId(ramosClient.id)}
                      className="h-8 text-xs"
                    >
                      Despesa da Ramos
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={clienteId && clienteId !== ramosClient.id ? 'default' : 'outline'}
                      onClick={() => setClienteId('')}
                      className="h-8 text-xs"
                    >
                      Vincular cliente
                    </Button>
                  </div>
                )}
                <QuickClientCombobox
                  clients={(clients || []) as any}
                  value={clienteId}
                  onChange={setClienteId}
                  required
                />
                {!isEntrada && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Para despesas internas, confirme Ramos Engenharia; se for reembolso/repasse, vincule o cliente correto.
                  </p>
                )}
              </div>
            </div>
            )}

            {/* Linha 3: conta override (se necessário) + descricao */}
            {(!isStructuredFlow || (structuredStep === 2 && !isEntradaRecorrente)) && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">
                  Conta {resolution.needsAccountOverride && <span className="text-destructive">*</span>}
                </Label>
                <Select
                  value={accountOverride || resolution.accountId || ''}
                  onValueChange={setAccountOverride}
                  disabled={!resolution.needsAccountOverride && !!resolution.accountId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.filter(a => a.active).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!resolution.needsAccountOverride && (
                  <p className="text-[10px] text-muted-foreground mt-1">Definida pela categoria.</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Descrição *</Label>
                <Input
                  value={descricao}
                  onChange={(e) => { setDescricao(e.target.value); setDescricaoTouched(true); }}
                  placeholder="Descreva o lançamento"
                  className={!descricao.trim() ? 'border-destructive' : ''}
                />
              </div>
            </div>
            )}

            {/* Bloco contextual: Dados Fiscais (entradas) */}
            {isEntrada && (!isStructuredFlow || structuredStep === 3) && (
              <div className="border border-income/30 bg-income/5 rounded-lg p-3 space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-income flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" /> Dados Fiscais (obrigatório)
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Origem da Receita *</Label>
                    <Select value={origemReceita} onValueChange={setOrigemReceita}>
                      <SelectTrigger className={!origemReceita ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SERVICO">Serviço</SelectItem>
                        <SelectItem value="PRODUTO">Produto</SelectItem>
                        <SelectItem value="OUTROS">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Documento de Recebimento *</Label>
                    <Select value={documentoRecebimento} onValueChange={setDocumentoRecebimento}>
                      <SelectTrigger className={!documentoRecebimento ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NOTA_FISCAL">Nota Fiscal (9% imposto)</SelectItem>
                        <SelectItem value="RECIBO">Recibo</SelectItem>
                        <SelectItem value="SEM_DOCUMENTO">Sem Documento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Status financeiro + competência */}
            {(!isStructuredFlow || structuredStep === 3) && (
            <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-xs font-semibold">Situação financeira</Label>
                <div className="inline-flex rounded-md border bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => setStatus('EM_ABERTO')}
                    className={cn(
                      'px-3 py-1 text-xs rounded transition-colors',
                      status === 'EM_ABERTO' ? 'bg-amber-500/15 text-amber-700 font-semibold' : 'text-muted-foreground'
                    )}
                  >Em aberto</button>
                  <button
                    type="button"
                    onClick={() => setStatus('PAGO')}
                    className={cn(
                      'px-3 py-1 text-xs rounded transition-colors',
                      status === 'PAGO' ? 'bg-income/15 text-income font-semibold' : 'text-muted-foreground'
                    )}
                  >Pago</button>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Competência</Label>
                  <div className="flex gap-1.5">
                    <Select value={String(competenciaMes)} onValueChange={(v) => setCompetenciaMes(Number(v))}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'].map((m, i) => (
                          <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={String(competenciaAno)} onValueChange={(v) => setCompetenciaAno(Number(v))}>
                      <SelectTrigger className="h-9 text-xs w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[defaultYear - 1, defaultYear, defaultYear + 1].map(y => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {status === 'PAGO' && (
                  <>
                    <div>
                      <Label className="text-xs">Data de Pagamento *</Label>
                      <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Forma de Pagamento *</Label>
                      <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                        <SelectTrigger className={!paymentMethodId ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethods?.filter(p => p.active).map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            </div>
            )}

            {isEntradaRecorrente && structuredStep === 3 && (
              <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Aplicar desconto?</p>
                    <p className="text-xs text-muted-foreground">Desconto por percentual, valor ou fator de SM.</p>
                  </div>
                  <Switch checked={hasDiscount} onCheckedChange={setHasDiscount} />
                </div>
                {hasDiscount && (
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Percentual (%)</SelectItem>
                          <SelectItem value="value">Valor fixo (R$)</SelectItem>
                          {pricingModel === 'SM' && <SelectItem value="factor">Reduzir fator SM</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Desconto</Label>
                      {discountType === 'value' ? (
                        <CurrencyInput
                          value={discountAmount}
                          onValueChange={(value) => setDiscountAmount(value === null ? '' : String(value))}
                          placeholder="0,00"
                        />
                      ) : (
                        <Input
                          type="number"
                          step={discountType === 'factor' ? '0.01' : '1'}
                          min="0"
                          value={discountAmount}
                          onChange={(e) => setDiscountAmount(e.target.value)}
                          placeholder={discountType === 'percent' ? 'Ex: 10' : 'Ex: 0.25'}
                        />
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Duração</Label>
                      <Select value={discountDuration} onValueChange={(value) => setDiscountDuration(value as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="months">Por meses</SelectItem>
                          <SelectItem value="date">Até uma data</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {hasDiscount && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {discountDuration === 'months' ? (
                      <div>
                        <Label className="text-xs">Quantidade de meses</Label>
                        <Input
                          type="number"
                          min={1}
                          value={discountMonths}
                          onChange={(e) => setDiscountMonths(e.target.value)}
                          placeholder="Ex: 3"
                        />
                      </div>
                    ) : (
                      <div>
                        <Label className="text-xs">Desconto até</Label>
                        <Input
                          type="date"
                          value={discountUntil}
                          onChange={(e) => setDiscountUntil(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}
                {hasDiscount && (
                  <div className="rounded-lg border bg-background p-2 text-xs">
                    <span className="text-muted-foreground">Valor com desconto</span>
                    <p className="text-base font-bold text-warning">
                      R$ {Math.max(0, recurringDiscountedValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Regra de NF do contrato</Label>
                  <Select value={exigirNF} onValueChange={(v) => setExigirNF(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEMPRE">Sempre emitir NF</SelectItem>
                      <SelectItem value="NUNCA">Nunca emitir NF</SelectItem>
                      <SelectItem value="PERGUNTAR">Perguntar por lançamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Entidade obrigatória apenas para despesas */}
            {!isEntrada && (!isStructuredFlow || structuredStep === 1) && (
              <div>
                {ramosEntity && (
                  <div className="mb-2 grid sm:grid-cols-3 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={entityIds.includes(ramosEntity.id) ? 'default' : 'outline'}
                      onClick={() => setEntityIds([ramosEntity.id])}
                      className="h-8 text-xs"
                    >
                      Própria Ramos
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEntityIds([])}
                      className="h-8 text-xs"
                    >
                      Cliente/grupo específico
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEntityIds([])}
                      className="h-8 text-xs"
                    >
                      Escolher manualmente
                    </Button>
                  </div>
                )}
                <MultiEntitySelector
                  selectedIds={entityIds}
                  onChange={setEntityIds}
                  label="Grupo / entidade de rastreamento *"
                />
                {entityIds.length === 0 && (
                  <p className="text-[10px] text-destructive mt-1">
                    Informe se corresponde a um grupo/pessoa, ao cliente ou à própria Ramos Engenharia.
                  </p>
                )}
              </div>
            )}

            {/* Repetição simples */}
            {canRepeat && !isEntradaRecorrente && (!isStructuredFlow || structuredStep === 3) && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5" /> Repetir lançamento
                  </Label>
                  <Switch checked={enableRep} onCheckedChange={setEnableRep} />
                </div>
                {enableRep && (
                  <div className="grid gap-2 sm:grid-cols-[220px_1fr]">
                    <Select value={repCount.toString()} onValueChange={(v) => setRepCount(parseInt(v))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 23 }, (_, i) => i + 2).map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground self-center">
                      Repete o mesmo valor nas próximas competências. Não divide o valor.
                    </p>
                  </div>
                )}
              </div>
            )}

            {isStructuredFlow && structuredStep < 4 && (
              <div className="flex justify-between border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStructuredStep((s) => Math.max(1, s - 1))}
                  disabled={structuredStep === 1}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  onClick={() => setStructuredStep((s) => Math.min(4, s + 1))}
                  disabled={!structuredStepValid}
                >
                  Continuar
                </Button>
              </div>
            )}

            {(!isStructuredFlow || structuredStep === 4) && (
            <>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
            </div>

            {/* Resumo final + Ações */}
            {finalCanSubmit && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-primary">
                  <Eye className="w-3 h-3" /> Resumo
                </div>
                {isEntradaRecorrente ? (
                  <div className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5 text-foreground/90">
                    <div><span className="text-muted-foreground">Categoria:</span> <strong>{selected.name}</strong></div>
                    <div><span className="text-muted-foreground">Cliente:</span> <strong>{clients?.find((c: any) => c.id === clienteId)?.name || '—'}</strong></div>
                    <div><span className="text-muted-foreground">Modelo:</span> <strong>{pricingModel === 'SM' ? selectedPlan?.name : 'Valor fixo'}</strong></div>
                    <div><span className="text-muted-foreground">Mensalidade:</span> <strong className="text-income">R$ {Math.max(0, recurringMonthlyValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
                    <div><span className="text-muted-foreground">Início:</span> <strong>{new Date(dataVenc + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></div>
                    <div><span className="text-muted-foreground">Parcelas no ano:</span> <strong>{recurringInstallmentsCount}</strong></div>
                    {hasDiscount && <div><span className="text-muted-foreground">Com desconto:</span> <strong className="text-warning">R$ {Math.max(0, recurringDiscountedValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>}
                    <div><span className="text-muted-foreground">NF:</span> <strong>{exigirNF === 'SEMPRE' ? 'Sempre' : exigirNF === 'NUNCA' ? 'Nunca' : 'Perguntar'}</strong></div>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5 text-foreground/90">
                    <div><span className="text-muted-foreground">Categoria:</span> <strong>{selected.name}</strong></div>
                    <div><span className="text-muted-foreground">Conta:</span> <strong>{accObj?.name || '—'}</strong></div>
                    <div><span className="text-muted-foreground">Valor:</span> <strong className={isEntrada ? 'text-income' : 'text-expense'}>R$ {valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>{enableRep && repCount > 1 && <span className="text-muted-foreground"> × {repCount} (repetido)</span>}</div>
                    <div><span className="text-muted-foreground">Vencimento:</span> <strong>{new Date(dataVenc + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></div>
                    <div><span className="text-muted-foreground">Competência:</span> <strong>{String(competenciaMes).padStart(2, '0')}/{competenciaAno}</strong></div>
                    <div><span className="text-muted-foreground">Situação:</span> <strong>{status === 'PAGO' ? 'Pago' : 'Em aberto'}</strong></div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2 border-t flex-wrap">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={reset}>Limpar</Button>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Keyboard className="w-3 h-3" /> Ctrl+Enter lança · Ctrl+Shift+Enter lança e novo · Esc limpa
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSubmit(true)}
                  disabled={!finalCanSubmit || submitting}
                  className="gap-2"
                  title="Lança e mantém categoria/cliente/competência (Ctrl+Shift+Enter)"
                >
                  <Plus className="w-4 h-4" />
                  Lançar e novo
                </Button>
                <Button onClick={() => handleSubmit(false)} disabled={!finalCanSubmit || submitting} className="gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Lançar
                </Button>
              </div>
            </div>
            </>
            )}
          </>
        )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
