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
  Repeat, Split, Sparkles, AlertCircle, ChevronUp, ChevronDown,
  Plus, Eye, Keyboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useTransactionCategories, useAccounts, usePaymentMethods } from '@/hooks/useFinancialConfig';
import { useCreateTransaction, useClients } from '@/hooks/useTransactions';
import { useSaveTransactionEntities } from '@/hooks/useTransactionEntities';
import { useFinancialEntities } from '@/hooks/useFinancialEntities';
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
  const createTransaction = useCreateTransaction();
  const saveEntities = useSaveTransactionEntities();

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

  // Status/competência/pagamento (contexto rico)
  const [status, setStatus] = useState<'EM_ABERTO' | 'PAGO'>('EM_ABERTO');
  const [dataPagamento, setDataPagamento] = useState(today);
  const [competenciaMes, setCompetenciaMes] = useState(defaultMonth);
  const [competenciaAno, setCompetenciaAno] = useState(defaultYear);

  // Dados fiscais (Entrada Avulsa)
  const [origemReceita, setOrigemReceita] = useState('');
  const [documentoRecebimento, setDocumentoRecebimento] = useState('');

  // Parcelamento (despesa variável)
  const [enableRep, setEnableRep] = useState(false);
  const [repMode, setRepMode] = useState<'parcelamento' | 'repeticao'>('parcelamento');
  const [repCount, setRepCount] = useState(2);

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
  const isAvulsaEntrada = selected?.type === 'ENTRADA' && selected?.subtype === 'AVULSA';
  const isVariavel = selected?.subtype === 'VARIAVEL';
  const needsDedicated = selected?.subtype === 'RECORRENTE' || selected?.subtype === 'FIXA';

  const accObj = accounts?.find(a => a.id === resolution.accountId);

  // Default Ramos Engenharia client for fixed expenses (rule from memory)
  const ramosClient = useMemo(
    () => (clients || []).find((c: any) => /ramos/i.test(c.name)),
    [clients]
  );
  const ramosEntity = useMemo(
    () => (entities || []).find((e) => /ramos/i.test(e.name)),
    [entities]
  );

  // Para despesas, sugere Ramos Engenharia como cliente padrão da operação,
  // mas mantém o campo obrigatório para evitar lançamentos sem rastreio.
  useEffect(() => {
    if (selected?.type === 'SAIDA' && ramosClient && !clienteId) setClienteId(ramosClient.id);
  }, [selected?.type, ramosClient, clienteId]);

  const reset = () => {
    setSearch(''); setCategoryId(''); setValorNum(0); setDataVenc(today);
    setDescricao(''); setDescricaoTouched(false);
    setClienteId(''); setEntityIds([]); setAccountOverride('');
    setPaymentMethodId(''); setNotes('');
    setEnableRep(false); setRepMode('parcelamento'); setRepCount(2);
    setStatus('EM_ABERTO'); setDataPagamento(today);
    setCompetenciaMes(defaultMonth); setCompetenciaAno(defaultYear);
    setOrigemReceita(''); setDocumentoRecebimento('');
  };

  const fiscalRequired = isAvulsaEntrada;
  const paidRequired = status === 'PAGO';
  const clientRequired = true;
  const entityRequired = true;

  const canSubmit =
    !!selected && !needsDedicated && valorNum > 0 && !!dataVenc &&
    !!resolution.accountId &&
    (!clientRequired || !!clienteId) &&
    (!entityRequired || entityIds.length > 0) &&
    (!fiscalRequired || (!!origemReceita && !!documentoRecebimento)) &&
    (!paidRequired || (!!dataPagamento && !!paymentMethodId)) &&
    !!descricao.trim();

  const handleSubmit = async (andNew = false) => {
    if (!selected) return;
    if (needsDedicated) {
      onNeedsDedicatedFlow(selected.subtype === 'RECORRENTE' ? 'recurring' : 'fixa');
      return;
    }
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const reps = enableRep && repCount > 1 ? repCount : 1;
      const valorParcela = enableRep && repMode === 'parcelamento' && repCount > 1
        ? Math.round((valorNum / repCount) * 100) / 100
        : valorNum;

      let m = competenciaMes;
      let y = competenciaAno;
      const baseDay = new Date(dataVenc + 'T00:00:00').getDate();

      for (let i = 0; i < reps; i++) {
        const due = new Date(y, m - 1, baseDay).toISOString().split('T')[0];
        const suffix = reps > 1
          ? (repMode === 'parcelamento' ? ` - Parcela ${i + 1}/${reps}` : ` - Repetição ${i + 1}/${reps}`)
          : '';
        const isPaidThis = paidRequired && i === 0;
        const result = await createTransaction.mutateAsync({
          tipo_movimento: selected.type,
          natureza: selected.subtype === 'AVULSA' ? 'AVULSA' : 'AVULSA',
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
          entity_id: entityIds[0] || null,
          created_by_user_id: user?.id,
          status: isPaidThis ? 'PAGO' : 'EM_ABERTO',
          valor_pago: isPaidThis ? valorParcela : null,
          data_pagamento: isPaidThis ? dataPagamento : null,
          origem_receita: isAvulsaEntrada ? origemReceita : null,
          documento_recebimento: isAvulsaEntrada ? documentoRecebimento : null,
        } as any);
        if (entityIds.length > 0 && result?.id) {
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
        if (canSubmit && !submitting) handleSubmit(e.shiftKey);
      } else if (e.key === 'Escape' && selected) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSubmit, submitting, selected]);

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

        {selected && needsDedicated && (
          <Card className="border-amber-300 bg-amber-50/40">
            <CardContent className="p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 text-xs">
                <p className="font-semibold text-amber-800">
                  {selected.subtype === 'RECORRENTE' ? 'Entrada recorrente' : 'Despesa fixa'} requer cadastro completo.
                </p>
                <p className="text-amber-700/80">Vamos abrir o formulário dedicado para garantir as parcelas e regras.</p>
              </div>
              <Button size="sm" onClick={() => handleSubmit(false)}>
                Continuar
              </Button>
            </CardContent>
          </Card>
        )}

        {selected && !needsDedicated && (
          <>
            {/* Badges removidos — agora exibidos no CategoryChip */}

            {/* Linha 2: valor + data + entidade */}
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

            {/* Linha 3: conta override (se necessário) + descricao */}
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

            {/* Bloco contextual: Dados Fiscais (apenas Entrada Avulsa) */}
            {isAvulsaEntrada && (
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

            {/* Entidade obrigatória para rastreamento operacional */}
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
                  {clienteId && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEntityIds([])}
                      className="h-8 text-xs"
                    >
                      Cliente/grupo específico
                    </Button>
                  )}
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

            {/* Parcelamento — só para despesa variável */}
            {selected.subtype === 'VARIAVEL' && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5" /> Repetir / parcelar
                  </Label>
                  <Switch checked={enableRep} onCheckedChange={setEnableRep} />
                </div>
                {enableRep && (
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={repMode} onValueChange={(v) => setRepMode(v as any)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parcelamento"><Split className="w-3 h-3 inline mr-1" /> Parcelar (divide)</SelectItem>
                        <SelectItem value="repeticao"><Repeat className="w-3 h-3 inline mr-1" /> Repetir (mesmo valor)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={repCount.toString()} onValueChange={(v) => setRepCount(parseInt(v))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 23 }, (_, i) => i + 2).map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
            </div>

            {/* Resumo final + Ações */}
            {canSubmit && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-primary">
                  <Eye className="w-3 h-3" /> Resumo
                </div>
                <div className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5 text-foreground/90">
                  <div><span className="text-muted-foreground">Categoria:</span> <strong>{selected.name}</strong></div>
                  <div><span className="text-muted-foreground">Conta:</span> <strong>{accObj?.name || '—'}</strong></div>
                  <div><span className="text-muted-foreground">Valor:</span> <strong className={isEntrada ? 'text-income' : 'text-expense'}>R$ {valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>{enableRep && repCount > 1 && <span className="text-muted-foreground"> × {repCount}{repMode === 'parcelamento' ? ' (parcelado)' : ' (repetido)'}</span>}</div>
                  <div><span className="text-muted-foreground">Vencimento:</span> <strong>{new Date(dataVenc + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></div>
                  <div><span className="text-muted-foreground">Competência:</span> <strong>{String(competenciaMes).padStart(2, '0')}/{competenciaAno}</strong></div>
                  <div><span className="text-muted-foreground">Situação:</span> <strong>{status === 'PAGO' ? 'Pago' : 'Em aberto'}</strong></div>
                </div>
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
                  disabled={!canSubmit || submitting}
                  className="gap-2"
                  title="Lança e mantém categoria/cliente/competência (Ctrl+Shift+Enter)"
                >
                  <Plus className="w-4 h-4" />
                  Lançar e novo
                </Button>
                <Button onClick={() => handleSubmit(false)} disabled={!canSubmit || submitting} className="gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Lançar
                </Button>
              </div>
            </div>
          </>
        )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
