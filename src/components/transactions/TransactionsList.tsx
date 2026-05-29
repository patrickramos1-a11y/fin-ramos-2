import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput, parseBRLToNumber } from '@/components/ui/currency-input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Search, ArrowUpCircle, ArrowDownCircle, MoreVertical, 
  CheckCircle, Clock, AlertTriangle, Send, Copy, Pencil, Trash2,
  RefreshCw, FileText, Loader2, DollarSign, ArrowUpDown, Settings2,
  ArrowUp, ArrowDown, Undo2, Filter, X, ArrowRightLeft, CalendarClock
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  useTransactions, 
  useMarkTransactionPaid, 
  useDuplicateTransaction, 
  useDeleteTransaction,
  useUpdateTransaction,
  TransactionFilters,
  TransactionWithClient,
  TransactionStatusType
} from '@/hooks/useTransactions';
import { formatCurrency } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { TransactionEditModal } from './TransactionEditModal';
import { MobileTransactionCard } from './MobileTransactionCard';
import { BulkEditPanel, type BulkContext } from './BulkEditPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { usePlannedTransfers, useExecuteOccurrence, type PlannedOccurrence, type PlannedTransferWithOccurrences } from '@/hooks/usePlannedTransfers';
import { useAccounts } from '@/hooks/useFinancialConfig';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const statusConfig: Record<TransactionStatusType, { label: string; color: string; icon: React.ComponentType<{className?: string}> }> = {
  PAGO: { label: 'Pago', color: 'bg-income/10 text-income border-income/20', icon: CheckCircle },
  EM_ABERTO: { label: 'Em Aberto', color: 'bg-warning/10 text-warning border-warning/20', icon: Clock },
  ATRASADO: { label: 'Atrasado', color: 'bg-expense/10 text-expense border-expense/20', icon: AlertTriangle },
};

const naturezaLabels = {
  RECORRENTE: { label: 'Recorrente', icon: RefreshCw },
  AVULSA: { label: 'Avulsa', icon: FileText },
};

type SortField = 'valor' | 'data_vencimento' | 'descricao';
type SortDir = 'asc' | 'desc';

const ALL_COLUMNS = [
  { key: 'tipo', label: 'Tipo', default: true },
  { key: 'descricao', label: 'Descrição', default: true },
  { key: 'cliente', label: 'Cliente', default: true },
  { key: 'natureza', label: 'Natureza', default: true },
  { key: 'categoria', label: 'Categoria', default: true },
  { key: 'conta', label: 'Conta', default: true },
  { key: 'centro_custo', label: 'C. Custo', default: false },
  { key: 'nf', label: 'NF / Doc.', default: true },
  { key: 'vencimento', label: 'Vencimento', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'valor', label: 'Valor', default: true },
] as const;

// Mapeia documento_recebimento para badge legível
const DOC_BADGE: Record<string, { label: string; color: string }> = {
  NOTA_FISCAL: { label: 'NF', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  RECIBO: { label: 'Recibo', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  NOTA_DE_DEBITO: { label: 'N. Débito', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  SEM_DOCUMENTO: { label: 'Sem doc.', color: 'bg-muted text-muted-foreground border-border' },
};

type ColumnKey = typeof ALL_COLUMNS[number]['key'];

type PlannedTransactionRow = TransactionWithClient & {
  is_planned_transfer?: boolean;
  is_synthetic_planned_occurrence?: boolean;
  planned_occurrence_id?: string;
  planned_transfer?: PlannedTransferWithOccurrences;
  planned_occurrence?: PlannedOccurrence;
  from_account_name?: string;
  to_account_name?: string;
};

function parseLocalDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clampDay(year: number, month: number, day: number) {
  return Math.min(day, new Date(year, month, 0).getDate());
}

function plannedDatesForMonth(plan: PlannedTransferWithOccurrences, year: number, month: number) {
  const start = parseLocalDate(plan.start_date);
  const end = plan.end_date ? parseLocalDate(plan.end_date) : new Date(year, 11, 31);
  const windowStart = new Date(year, month - 1, 1);
  const windowEnd = new Date(year, month, 0);
  if (end < windowStart || start > windowEnd) return [];

  const pushIfValid = (date: Date) => {
    if (date >= start && date <= end && date >= windowStart && date <= windowEnd) {
      return [toISODate(date)];
    }
    return [];
  };

  if (plan.frequency === 'AVULSA') return pushIfValid(start);

  if (plan.frequency === 'MENSAL') {
    const day = clampDay(year, month, plan.due_day || start.getDate());
    return pushIfValid(new Date(year, month - 1, day));
  }

  if (plan.frequency === 'TRIMESTRAL') {
    const diff = (year - start.getFullYear()) * 12 + (month - 1 - start.getMonth());
    if (diff < 0 || diff % 3 !== 0) return [];
    const day = clampDay(year, month, plan.due_day || start.getDate());
    return pushIfValid(new Date(year, month - 1, day));
  }

  if (plan.frequency === 'ANUAL') {
    if (month - 1 !== start.getMonth()) return [];
    const day = clampDay(year, month, plan.due_day || start.getDate());
    return pushIfValid(new Date(year, month - 1, day));
  }

  const intervalDays =
    plan.frequency === 'SEMANAL' ? 7 :
    plan.frequency === 'QUINZENAL' ? 14 :
    plan.interval_days || 30;

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor < windowStart) cursor.setDate(cursor.getDate() + intervalDays);
  while (cursor <= windowEnd && cursor <= end) {
    dates.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + intervalDays);
  }
  return dates;
}

interface TransactionsListProps {
  filters: TransactionFilters;
  /** Define quais campos podem ser editados em massa neste contexto. */
  bulkContext?: BulkContext;
}

export function TransactionsList({ filters, bulkContext = 'GERAL' }: TransactionsListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFixedDeleteOptions, setShowFixedDeleteOptions] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<TransactionWithClient | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingTransaction, setPayingTransaction] = useState<TransactionWithClient | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payValue, setPayValue] = useState('');
  const [plannedToExecute, setPlannedToExecute] = useState<PlannedTransactionRow | null>(null);
  const [plannedExecDate, setPlannedExecDate] = useState(new Date().toISOString().split('T')[0]);
  const [plannedExecAmount, setPlannedExecAmount] = useState(0);
  const [sortField, setSortField] = useState<SortField>('data_vencimento');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithClient | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(ALL_COLUMNS.filter(c => c.default).map(c => c.key))
  );
  // Filtros por coluna estilo Excel: { coluna: Set<valor selecionado> }.
  // Quando o Set existe e está não-vazio, apenas linhas com valor pertencente são exibidas.
  // "__EMPTY__" é o valor sentinel para representar células vazias/nulas.
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateTransaction();

  // Note: `search` is intentionally NOT passed into useTransactions to avoid
  // a network refetch (and loading flash) on every keystroke. We filter the
  // already-loaded data locally below.
  const combinedFilters: TransactionFilters = {
    ...filters,
    status: statusFilter !== 'all' ? statusFilter as TransactionStatusType : undefined,
  };

  const { data: transactions, isLoading, error } = useTransactions(combinedFilters);
  const { data: plannedTransfers } = usePlannedTransfers();
  const { data: accounts } = useAccounts();
  const executeOccurrence = useExecuteOccurrence();
  const markPaidMutation = useMarkTransactionPaid();
  const duplicateMutation = useDuplicateTransaction();
  const deleteMutation = useDeleteTransaction();

  // Helper: extrai o valor "filtrável" (string) de uma transação por coluna.
  const getColumnValue = (t: TransactionWithClient, col: string): string => {
    const planned = t as PlannedTransactionRow;
    switch (col) {
      case 'tipo': return t.tipo_movimento;
      case 'cliente': return t.recurring_clients?.name || '';
      case 'natureza': {
        if (planned.is_planned_transfer) return 'Transferencia planejada';
        if (t.tipo_movimento === 'ENTRADA') return t.natureza === 'RECORRENTE' ? 'Recorrente' : 'Avulso';
        if (t.natureza === 'RECORRENTE' || (t as any).expense_type === 'FIXA' || (t as any).category_subtype === 'FIXA') return 'Fixo';
        return 'Variável';
      }
      case 'categoria': return t.category_name || '';
      case 'conta': return t.account_name || '';
      case 'centro_custo': return t.cost_center_name || '';
      case 'responsavel': return t.responsible_name || t.entity_name || '';
      case 'nf': return t.documento_recebimento || '';
      case 'status': return statusConfig[t.status]?.label || t.status;
      default: return '';
    }
  };

  // Sort + client-side text search + filtros por coluna (fluido, no refetch).
  const plannedRows = useMemo((): PlannedTransactionRow[] => {
    if (!plannedTransfers || !filters.competencia_mes || !filters.competencia_ano) return [];
    if (filters.tipo_movimento === 'ENTRADA') return [];
    if (filters.origem || filters.status === 'PAGO' || filters.status === 'ATRASADO') return [];

    const accountMap = new Map((accounts || []).map((account) => [account.id, account.name]));
    const month = filters.competencia_mes;
    const year = filters.competencia_ano;

    return plannedTransfers.flatMap((plan) => {
      if (plan.status !== 'ATIVO') return [];
      if (plan.accounting_mode !== 'AS_EXPENSE') return [];
      const natureza = plan.frequency === 'AVULSA' ? 'AVULSA' : 'RECORRENTE';
      if (filters.natureza && filters.natureza !== natureza) return [];
      const existingOccurrences = plan.occurrences
        .filter((occ) => occ.status === 'PLANEJADA' || occ.status === 'ATRASADA')
        .filter((occ) => {
          const [occYear, occMonth] = occ.scheduled_date.split('-').map(Number);
          return occYear === year && occMonth === month;
        });
      const occurrences: Array<PlannedOccurrence & { synthetic?: boolean }> = existingOccurrences.length > 0
        ? existingOccurrences
        : plannedDatesForMonth(plan, year, month).map((date) => ({
            id: `synthetic-${plan.id}-${date}`,
            planned_transfer_id: plan.id,
            scheduled_date: date,
            expected_amount: Number(plan.amount) || 0,
            status: date < new Date().toISOString().slice(0, 10) ? 'ATRASADA' : 'PLANEJADA',
            executed_transfer_id: null,
            executed_at: null,
            notes: plan.notes,
            synthetic: true,
          }));

      return occurrences
        .map((occ) => {
          const fromName = accountMap.get(plan.from_account_id) || 'Origem';
          const toName = accountMap.get(plan.to_account_id) || 'Destino';
          return {
            id: `planned-${occ.id}`,
            tipo_movimento: 'SAIDA',
            natureza,
            origem: 'TRANSFERENCIA_PLANEJADA',
            cliente_id: null,
            contrato_id: null,
            installment_id: null,
            fixed_expense_id: null,
            competencia_mes: month,
            competencia_ano: year,
            valor: Number(occ.expected_amount) || Number(plan.amount) || 0,
            valor_pago: null,
            data_vencimento: occ.scheduled_date,
            data_pagamento: null,
            status: occ.scheduled_date < new Date().toISOString().slice(0, 10) ? 'ATRASADO' : 'EM_ABERTO',
            descricao: plan.description || `Transferencia planejada: ${fromName} -> ${toName}`,
            transaction_category_id: null,
            cost_center_id: null,
            account_id: plan.from_account_id,
            documento_tipo: 'SEM_DOCUMENTO',
            documento_numero: null,
            notes: plan.notes,
            entity_id: null,
            origem_receita: null,
            documento_recebimento: null,
            responsavel_id: null,
            nf_percentual_aplicado: null,
            valor_imposto_nf: null,
            valor_liquido_nf: null,
            created_at: occ.scheduled_date,
            updated_at: occ.scheduled_date,
            category_name: 'Transferencia planejada',
            category_color: '#f59e0b',
            account_name: fromName,
            cost_center_name: null,
            entity_name: null,
            responsible_name: null,
            expense_type: null,
            category_subtype: natureza === 'RECORRENTE' ? 'FIXA' : 'AVULSA',
            is_planned_transfer: true,
            is_synthetic_planned_occurrence: Boolean(occ.synthetic),
            planned_occurrence_id: occ.synthetic ? undefined : occ.id,
            planned_transfer: plan,
            planned_occurrence: occ as PlannedOccurrence,
            from_account_name: fromName,
            to_account_name: toName,
          } as PlannedTransactionRow;
        });
    });
  }, [accounts, filters, plannedTransfers]);

  const allRows = useMemo(() => [...(transactions || []), ...plannedRows], [plannedRows, transactions]);

  const sortedTransactions = useMemo(() => {
    if (!allRows) return [];
    const q = search.trim().toLowerCase();
    let filtered = q
      ? allRows.filter(t =>
          t.descricao?.toLowerCase().includes(q) ||
          t.recurring_clients?.name?.toLowerCase().includes(q) ||
          t.category_name?.toLowerCase().includes(q) ||
          t.account_name?.toLowerCase().includes(q) ||
          (t as PlannedTransactionRow).to_account_name?.toLowerCase().includes(q)
        )
      : allRows;

    // Aplica filtros por coluna (Excel-like).
    const activeColFilters = Object.entries(columnFilters).filter(([, set]) => set.size > 0);
    if (activeColFilters.length > 0) {
      filtered = filtered.filter(t =>
        activeColFilters.every(([col, allowed]) => {
          const v = getColumnValue(t, col);
          return allowed.has(v === '' ? '__EMPTY__' : v);
        })
      );
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'valor':
          cmp = Number(a.valor) - Number(b.valor);
          break;
        case 'descricao':
          cmp = (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR');
          break;
        case 'data_vencimento':
        default:
          cmp = new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [allRows, search, sortField, sortDir, columnFilters]);

  // Valores únicos por coluna calculados a partir do conjunto SEM o filtro daquela própria coluna,
  // para que o usuário sempre veja todas as opções disponíveis no popover.
  const getUniqueValuesForColumn = (col: string): string[] => {
    if (!allRows) return [];
    const otherFilters = Object.entries(columnFilters).filter(([k, set]) => k !== col && set.size > 0);
    const base = allRows.filter(t =>
      otherFilters.every(([k, allowed]) => {
        const v = getColumnValue(t, k);
        return allowed.has(v === '' ? '__EMPTY__' : v);
      })
    );
    const set = new Set<string>();
    base.forEach(t => {
      const v = getColumnValue(t, col);
      set.add(v === '' ? '__EMPTY__' : v);
    });
    return Array.from(set).sort((a, b) => {
      if (a === '__EMPTY__') return 1;
      if (b === '__EMPTY__') return -1;
      return a.localeCompare(b, 'pt-BR');
    });
  };

  const getNatureIcon = (tipo: string) => {
    if (tipo === 'ENTRADA') return <ArrowDownCircle className="w-5 h-5 text-income" />;
    return <ArrowUpCircle className="w-5 h-5 text-expense" />;
  };

  const handleOpenPay = (t: TransactionWithClient) => {
    if ((t as PlannedTransactionRow).is_planned_transfer) {
      handleOpenPlannedExecution(t as PlannedTransactionRow);
      return;
    }
    setPayingTransaction(t);
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayValue(String(t.valor));
    setShowPayModal(true);
  };

  const handleConfirmPay = () => {
    if (payingTransaction) {
      markPaidMutation.mutate({ 
        transactionId: payingTransaction.id,
        valorPago: parseBRLToNumber(payValue) || undefined 
      });
      setShowPayModal(false);
      setPayingTransaction(null);
    }
  };

  const handleOpenPlannedExecution = (row: PlannedTransactionRow) => {
    setPlannedToExecute(row);
    setPlannedExecDate(row.data_vencimento || new Date().toISOString().split('T')[0]);
    setPlannedExecAmount(Number(row.valor) || 0);
  };

  const handleConfirmPlannedExecution = async () => {
    if (!plannedToExecute?.planned_transfer?.id) return;
    let occurrenceId = plannedToExecute.planned_occurrence_id;
    if (!occurrenceId && plannedToExecute.is_synthetic_planned_occurrence) {
      const { data, error } = await supabase
        .from('planned_transfer_occurrences' as any)
        .insert({
          planned_transfer_id: plannedToExecute.planned_transfer.id,
          scheduled_date: plannedToExecute.data_vencimento,
          expected_amount: plannedExecAmount || plannedToExecute.valor,
          status: 'PLANEJADA',
          notes: plannedToExecute.notes || null,
        })
        .select('id')
        .single();
      if (error) {
        toast.error('Erro ao criar ocorrência planejada', { description: error.message });
        return;
      }
      occurrenceId = (data as any).id;
    }
    if (!occurrenceId) return;
    executeOccurrence.mutate(
      {
        occurrence_id: occurrenceId,
        real_date: plannedExecDate,
        amount: plannedExecAmount,
      },
      {
        onSuccess: () => {
          setPlannedToExecute(null);
        },
      },
    );
  };

  const handleMarkPaid = (transaction: TransactionWithClient) => {
    handleOpenPay(transaction);
  };

  const handleDuplicate = (transaction: TransactionWithClient) => {
    duplicateMutation.mutate(transaction.id);
  };

  const handleSendCollection = (transaction: TransactionWithClient) => {
    toast.success(`Cobrança enviada para ${transaction.recurring_clients?.name || 'cliente'}!`);
  };

  const confirmDelete = (transaction: TransactionWithClient) => {
    setDeletingTransaction(transaction);
    if (transaction.fixed_expense_id) {
      setShowFixedDeleteOptions(true);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleDelete = () => {
    if (deletingTransaction) {
      deleteMutation.mutate(deletingTransaction.id);
      setDeletingTransaction(null);
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === selectableTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableTransactions.map(t => t.id)));
    }
  };

  const refreshAfterDelete = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['fixed_expenses'] }),
      queryClient.invalidateQueries({ queryKey: ['open-payments'] }),
      queryClient.invalidateQueries({ queryKey: ['approval-transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['pending-approval-count'] }),
    ]);
  };

  const closeFixedDeleteOptions = () => {
    setShowFixedDeleteOptions(false);
    setDeletingTransaction(null);
  };

  const handleFixedExpenseDelete = async (mode: 'single' | 'future' | 'all') => {
    if (!deletingTransaction?.fixed_expense_id) return;

    const tx = deletingTransaction;
    const fixedExpenseId = tx.fixed_expense_id;
    const previousMonthDate = new Date(tx.competencia_ano, tx.competencia_mes - 1, 0);
    const endBeforeCurrent = previousMonthDate.toISOString().split('T')[0];

    try {
      if (mode === 'single') {
        await deleteMutation.mutateAsync(tx.id);
      }

      if (mode === 'future') {
        const { error: updateError } = await supabase
          .from('fixed_expenses')
          .update({ data_fim: endBeforeCurrent })
          .eq('id', fixedExpenseId);
        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from('transactions')
          .delete()
          .eq('fixed_expense_id', fixedExpenseId)
          .neq('status', 'PAGO')
          .or(`competencia_ano.gt.${tx.competencia_ano},and(competencia_ano.eq.${tx.competencia_ano},competencia_mes.gte.${tx.competencia_mes})`);
        if (deleteError) throw deleteError;
      }

      if (mode === 'all') {
        const { error: updateError } = await supabase
          .from('fixed_expenses')
          .update({ active: false, data_fim: endBeforeCurrent })
          .eq('id', fixedExpenseId);
        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from('transactions')
          .delete()
          .eq('fixed_expense_id', fixedExpenseId)
          .neq('status', 'PAGO');
        if (deleteError) throw deleteError;
      }

      await refreshAfterDelete();
      toast.success(
        mode === 'single'
          ? 'Parcela excluída. Atenção: a despesa fixa continua ativa.'
          : mode === 'future'
          ? 'Despesa fixa encerrada a partir desta competência.'
          : 'Despesa fixa desativada e parcelas em aberto removidas.'
      );
      closeFixedDeleteOptions();
    } catch (error: any) {
      console.error('Error deleting fixed expense transaction:', error);
      toast.error('Erro ao excluir despesa fixa: ' + (error?.message || 'tente novamente'));
    }
  };

  const toggleSelect = (id: string) => {
    if (id.startsWith('planned-')) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    selectedIds.forEach(id => deleteMutation.mutate(id));
    setSelectedIds(new Set());
    toast.success(`${selectedIds.size} transações excluídas`);
  };

  const handleRevertToPending = (t: TransactionWithClient) => {
    updateMutation.mutate({ 
      id: t.id, 
      status: 'EM_ABERTO', 
      valor_pago: null, 
      data_pagamento: null 
    } as any);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  // Filtro estilo Excel por coluna: popover com checkboxes dos valores únicos.
  const ColumnFilter = ({ col, label }: { col: string; label: string }) => {
    const active = columnFilters[col]?.size ?? 0;
    const [popoverSearch, setPopoverSearch] = useState('');
    const uniqueValues = getUniqueValuesForColumn(col);
    const filteredValues = popoverSearch
      ? uniqueValues.filter(v => {
          const display = v === '__EMPTY__' ? 'em branco' : v;
          return display.toLowerCase().includes(popoverSearch.toLowerCase());
        })
      : uniqueValues;
    const current = columnFilters[col] ?? new Set<string>();
    const allSelected = current.size === 0;

    const toggleValue = (v: string) => {
      setColumnFilters(prev => {
        const next = { ...prev };
        const set = new Set(next[col] ?? []);
        // Se vazio (= todos), inicia com todos os valores e remove o clicado.
        if (set.size === 0) {
          uniqueValues.forEach(uv => set.add(uv));
        }
        if (set.has(v)) set.delete(v);
        else set.add(v);
        // Se voltou a ter todos, limpa o filtro.
        if (set.size === uniqueValues.length || set.size === 0) {
          delete next[col];
        } else {
          next[col] = set;
        }
        return next;
      });
    };

    const clearFilter = () => {
      setColumnFilters(prev => {
        const next = { ...prev };
        delete next[col];
        return next;
      });
    };

    const selectOnly = (v: string) => {
      setColumnFilters(prev => ({ ...prev, [col]: new Set([v]) }));
    };

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "ml-1 inline-flex items-center justify-center rounded p-0.5 hover:bg-muted transition-colors",
              active > 0 && "bg-primary/15 text-primary"
            )}
            title={`Filtrar ${label}`}
          >
            <Filter className="w-3 h-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-2 border-b flex items-center justify-between gap-2">
            <span className="text-xs font-medium">Filtrar: {label}</span>
            {active > 0 && (
              <button onClick={clearFilter} className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <X className="w-3 h-3" /> Limpar
              </button>
            )}
          </div>
          <div className="p-2 border-b">
            <Input
              autoFocus
              value={popoverSearch}
              onChange={e => setPopoverSearch(e.target.value)}
              placeholder="Pesquisar..."
              className="h-7 text-xs"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredValues.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhum valor</p>
            )}
            {filteredValues.map(v => {
              const display = v === '__EMPTY__' ? '(em branco)' : v;
              const isChecked = allSelected || current.has(v);
              return (
                <div
                  key={v}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted text-xs group"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleValue(v)}
                  />
                  <span className="flex-1 truncate cursor-pointer" onClick={() => toggleValue(v)}>
                    {display}
                  </span>
                  <button
                    onClick={() => selectOnly(v)}
                    className="opacity-0 group-hover:opacity-100 text-[9px] text-primary hover:underline"
                  >
                    só este
                  </button>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const hasActiveColumnFilters = Object.values(columnFilters).some(s => s.size > 0);
  const selectableTransactions = sortedTransactions.filter((t) => !(t as PlannedTransactionRow).is_planned_transfer);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Erro ao carregar transações. Tente novamente.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {/* Status filter pills on mobile */}
        {isMobile ? (
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {['all', 'PAGO', 'EM_ABERTO', 'ATRASADO'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "filter-pill whitespace-nowrap text-xs",
                  statusFilter === s && "active"
                )}
              >
                {s === 'all' ? 'Todos' : s === 'PAGO' ? 'Pago' : s === 'EM_ABERTO' ? 'Aberto' : 'Atrasado'}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PAGO">Pago</SelectItem>
                <SelectItem value="EM_ABERTO">Em Aberto</SelectItem>
                <SelectItem value="ATRASADO">Atrasado</SelectItem>
              </SelectContent>
            </Select>

            {/* Column config */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Settings2 className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48" align="end">
                <p className="text-xs font-medium mb-2 text-muted-foreground">Colunas visíveis</p>
                <div className="space-y-2">
                  {ALL_COLUMNS.map(col => (
                    <label key={col.key} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox 
                        checked={visibleColumns.has(col.key)}
                        onCheckedChange={() => toggleColumn(col.key)}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Active column filters indicator */}
      {hasActiveColumnFilters && !isMobile && (
        <div className="flex items-center gap-2 flex-wrap mb-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs">
          <Filter className="w-3 h-3 text-primary" />
          <span className="font-medium">{sortedTransactions.length}</span>
          <span className="text-muted-foreground">de {allRows.length} linhas apos filtros de coluna</span>
          {Object.entries(columnFilters).filter(([, s]) => s.size > 0).map(([col, set]) => (
            <Badge key={col} variant="outline" className="text-[10px] gap-1">
              {col}: {set.size} valor(es)
              <button onClick={() => setColumnFilters(prev => { const n = { ...prev }; delete n[col]; return n; })}>
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          ))}
          <button onClick={() => setColumnFilters({})} className="ml-auto text-primary hover:underline">
            Limpar todos
          </button>
        </div>
      )}

      {/* Mobile Card List */}
      {isMobile ? (
        <div className="space-y-2">
          {sortedTransactions.length > 0 ? (
            sortedTransactions.map(t => (
              <MobileTransactionCard
                key={t.id}
                transaction={t}
                onMarkPaid={handleMarkPaid}
                onDuplicate={handleDuplicate}
                onSendCollection={handleSendCollection}
                onDelete={confirmDelete}
                onEdit={setEditingTransaction}
                onRevert={handleRevertToPending}
                onConvertPlanned={handleOpenPlannedExecution}
              />
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Nenhuma transação encontrada.
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Desktop Table */
        <Card>
          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap p-3 bg-primary/5 border-b">
              <span className="text-sm font-medium">{selectedIds.size} selecionada(s)</span>
              <Button size="sm" variant="default" onClick={() => setShowBulkEdit(true)} className="h-7 text-xs">
                <Pencil className="w-3 h-3 mr-1" /> Editar Selecionadas
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const ids = selectableTransactions.filter(t => !t.entity_id).map(t => t.id);
                  setSelectedIds(new Set(ids));
                  if (ids.length === 0) toast.info('Nenhum lançamento sem entidade nesta listagem');
                }}
                className="h-7 text-xs"
              >
                Selecionar sem Entidade
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const ids = selectableTransactions.filter(t => !t.documento_recebimento).map(t => t.id);
                  setSelectedIds(new Set(ids));
                  if (ids.length === 0) toast.info('Nenhum lançamento sem documento (NF) nesta listagem');
                }}
                className="h-7 text-xs"
              >
                Selecionar sem NF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const ids = selectableTransactions.filter(t => !t.account_id).map(t => t.id);
                  setSelectedIds(new Set(ids));
                  if (ids.length === 0) toast.info('Nenhum lançamento sem conta nesta listagem');
                }}
                className="h-7 text-xs"
              >
                Selecionar sem Conta
              </Button>
              <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="h-7 text-xs">
                <Trash2 className="w-3 h-3 mr-1" /> Excluir Selecionadas
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="h-7 text-xs">
                Limpar Seleção
              </Button>
            </div>
          )}
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-4 w-10">
                      <Checkbox 
                        checked={selectableTransactions.length > 0 && selectedIds.size === selectableTransactions.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    {visibleColumns.has('tipo') && (
                      <th className="text-left p-4 text-sm font-medium">
                        <span className="inline-flex items-center">Tipo<ColumnFilter col="tipo" label="Tipo" /></span>
                      </th>
                    )}
                    {visibleColumns.has('descricao') && (
                      <th className="text-left p-4 text-sm font-medium">
                        <button onClick={() => toggleSort('descricao')} className="flex items-center hover:text-foreground">
                          Descrição <SortIcon field="descricao" />
                        </button>
                      </th>
                    )}
                    {visibleColumns.has('cliente') && (
                      <th className="text-left p-4 text-sm font-medium">
                        <span className="inline-flex items-center">Cliente<ColumnFilter col="cliente" label="Cliente" /></span>
                      </th>
                    )}
                    {visibleColumns.has('natureza') && (
                      <th className="text-left p-4 text-sm font-medium">
                        <span className="inline-flex items-center">Natureza<ColumnFilter col="natureza" label="Natureza" /></span>
                      </th>
                    )}
                    {visibleColumns.has('categoria') && (
                      <th className="text-left p-4 text-sm font-medium">
                        <span className="inline-flex items-center">Categoria<ColumnFilter col="categoria" label="Categoria" /></span>
                      </th>
                    )}
                    {visibleColumns.has('conta') && (
                      <th className="text-left p-4 text-sm font-medium">
                        <span className="inline-flex items-center">Conta<ColumnFilter col="conta" label="Conta" /></span>
                      </th>
                    )}
                    {visibleColumns.has('centro_custo') && (
                      <th className="text-left p-4 text-sm font-medium">
                        <span className="inline-flex items-center">C. Custo<ColumnFilter col="centro_custo" label="Centro de Custo" /></span>
                      </th>
                    )}
                    {visibleColumns.has('nf') && (
                      <th className="text-left p-4 text-sm font-medium">
                        <span className="inline-flex items-center">NF / Doc.<ColumnFilter col="nf" label="NF / Doc." /></span>
                      </th>
                    )}
                    {visibleColumns.has('vencimento') && (
                      <th className="text-left p-4 text-sm font-medium">
                        <button onClick={() => toggleSort('data_vencimento')} className="flex items-center hover:text-foreground">
                          Vencimento <SortIcon field="data_vencimento" />
                        </button>
                      </th>
                    )}
                    {visibleColumns.has('status') && (
                      <th className="text-left p-4 text-sm font-medium">
                        <span className="inline-flex items-center">Status<ColumnFilter col="status" label="Status" /></span>
                      </th>
                    )}
                    {visibleColumns.has('valor') && (
                      <th className="text-right p-4 text-sm font-medium">
                        <button onClick={() => toggleSort('valor')} className="flex items-center justify-end hover:text-foreground ml-auto">
                          Valor <SortIcon field="valor" />
                        </button>
                      </th>
                    )}
                    <th className="text-center p-4 text-sm font-medium w-24">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedTransactions.length > 0 ? (
                    sortedTransactions.map(t => {
                      const planned = t as PlannedTransactionRow;
                      const isPlannedTransfer = Boolean(planned.is_planned_transfer);
                      const status = statusConfig[t.status];
                      const StatusIcon = status.icon;
                      const natureza = naturezaLabels[t.natureza];
                      const NaturezaIcon = natureza.icon;

                      // Type badge
                      const getTypeBadge = () => {
                        if (isPlannedTransfer) {
                          return { label: 'Transf. planejada', color: 'bg-amber-100 text-amber-700 border-amber-200' };
                        }
                        if (t.tipo_movimento === 'ENTRADA') {
                          return t.natureza === 'RECORRENTE' 
                            ? { label: 'Recorrente', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
                            : { label: 'Avulso', color: 'bg-blue-100 text-blue-700 border-blue-200' };
                        }
                        // SAIDA
                        if (t.natureza === 'RECORRENTE' || t.expense_type === 'FIXA' || t.category_subtype === 'FIXA') {
                          return { label: 'Fixo', color: 'bg-red-100 text-red-700 border-red-200' };
                        }
                        return { label: 'Variável', color: 'bg-amber-100 text-amber-700 border-amber-200' };
                      };
                      const typeBadge = getTypeBadge();
                      
                      return (
                        <tr key={t.id} className={cn("hover:bg-muted/30 transition-colors", selectedIds.has(t.id) && "bg-primary/5")}>
                          <td className="p-4">
                            <Checkbox
                              disabled={isPlannedTransfer}
                              checked={!isPlannedTransfer && selectedIds.has(t.id)}
                              onCheckedChange={() => toggleSelect(t.id)}
                            />
                          </td>
                          {visibleColumns.has('tipo') && (
                            <td className="p-4">
                              {isPlannedTransfer ? <ArrowRightLeft className="w-5 h-5 text-warning" /> : getNatureIcon(t.tipo_movimento)}
                            </td>
                          )}
                          {visibleColumns.has('descricao') && (
                            <td className="p-4">
                              <p className="font-medium text-sm">{t.descricao || '-'}</p>
                              <p className="text-xs text-muted-foreground">
                                {t.competencia_mes.toString().padStart(2, '0')}/{t.competencia_ano}
                                {isPlannedTransfer && ` • ${planned.from_account_name} -> ${planned.to_account_name}`}
                              </p>
                            </td>
                          )}
                          {visibleColumns.has('cliente') && (
                            <td className="p-4">
                              <span className="text-sm">{t.recurring_clients?.name || '-'}</span>
                            </td>
                          )}
                          {visibleColumns.has('natureza') && (
                            <td className="p-4">
                              <Badge variant="outline" className={cn("text-xs", typeBadge.color)}>
                                <NaturezaIcon className="w-3 h-3 mr-1" />
                                {typeBadge.label}
                              </Badge>
                            </td>
                          )}
                          {visibleColumns.has('categoria') && (
                            <td className="p-4">
                              <span className="text-xs font-medium" style={{ color: t.category_color || undefined }}>
                                {t.category_name || 'Não vinculado'}
                              </span>
                            </td>
                          )}
                          {visibleColumns.has('conta') && (
                            <td className="p-4">
                              {t.account_name ? (
                                <span className="text-xs text-muted-foreground">{t.account_name}</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditingTransaction(t)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20 transition-colors"
                                  title="Clique para vincular uma conta"
                                >
                                  ⚠ Sem conta
                                </button>
                              )}
                            </td>
                          )}
                          {visibleColumns.has('centro_custo') && (
                            <td className="p-4">
                              <span className="text-xs text-muted-foreground">{t.cost_center_name || 'Não vinculado'}</span>
                            </td>
                          )}
                          {visibleColumns.has('nf') && (
                            <td className="p-4">
                              {t.documento_recebimento ? (
                                <Badge
                                  variant="outline"
                                  className={cn("text-[10px]", DOC_BADGE[t.documento_recebimento]?.color || 'bg-muted text-muted-foreground')}
                                >
                                  {DOC_BADGE[t.documento_recebimento]?.label || t.documento_recebimento}
                                </Badge>
                              ) : (
                                <span className="text-[10px] italic text-muted-foreground">não informado</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.has('vencimento') && (
                            <td className="p-4">
                              <span className="text-sm">{formatDate(t.data_vencimento)}</span>
                            </td>
                          )}
                          {visibleColumns.has('status') && (
                            <td className="p-4">
                              <Badge variant="outline" className={cn("text-xs", status.color)}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {status.label}
                              </Badge>
                            </td>
                          )}
                          {visibleColumns.has('valor') && (
                            <td className="p-4 text-right">
                              <span className={cn(
                                "font-semibold",
                                t.tipo_movimento === 'ENTRADA' && "text-income",
                                t.tipo_movimento === 'SAIDA' && "text-expense"
                              )}>
                                {formatCurrency(Number(t.valor))}
                              </span>
                            </td>
                          )}
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-1">
                              {t.status !== 'PAGO' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 px-2 text-xs text-income hover:text-income hover:bg-income/10"
                                  onClick={() => handleOpenPay(t)}
                                >
                                  <DollarSign className="w-3.5 h-3.5 mr-0.5" />
                                  {isPlannedTransfer ? 'Converter' : 'Pagar'}
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {isPlannedTransfer ? (
                                    <DropdownMenuItem onClick={() => handleOpenPlannedExecution(planned)}>
                                      <ArrowRightLeft className="w-4 h-4 mr-2" /> Converter em transferência
                                    </DropdownMenuItem>
                                  ) : (
                                    <>
                                      <DropdownMenuItem onClick={() => setEditingTransaction(t)}>
                                        <Pencil className="w-4 h-4 mr-2" /> Editar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleDuplicate(t)}>
                                        <Copy className="w-4 h-4 mr-2" /> Duplicar
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {t.status !== 'PAGO' && !isPlannedTransfer && (
                                    <DropdownMenuItem onClick={() => handleOpenPay(t)}>
                                      <CheckCircle className="w-4 h-4 mr-2" /> Marcar Pago
                                    </DropdownMenuItem>
                                  )}
                                  {t.status === 'PAGO' && (
                                    <DropdownMenuItem onClick={() => handleRevertToPending(t)}>
                                      <Undo2 className="w-4 h-4 mr-2" /> Reverter p/ Em Aberto
                                    </DropdownMenuItem>
                                  )}
                                  {t.tipo_movimento === 'ENTRADA' && t.status !== 'PAGO' && (
                                    <DropdownMenuItem onClick={() => handleSendCollection(t)}>
                                      <Send className="w-4 h-4 mr-2" /> Enviar Cobrança
                                    </DropdownMenuItem>
                                  )}
                                  {!isPlannedTransfer && <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => confirmDelete(t)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                  </DropdownMenuItem>}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={13} className="p-8 text-center text-muted-foreground">
                        Nenhuma transação encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Planned transfer execution modal */}
      <Dialog open={!!plannedToExecute} onOpenChange={(v) => !v && setPlannedToExecute(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-warning" />
              Converter em transferência
            </DialogTitle>
          </DialogHeader>
          {plannedToExecute && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-sm font-medium">{plannedToExecute.descricao || 'Transferencia planejada'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {plannedToExecute.from_account_name} para {plannedToExecute.to_account_name}
                </p>
                <p className="text-lg font-bold mt-2">{formatCurrency(Number(plannedToExecute.valor))}</p>
              </div>
              <div>
                <Label>Valor real</Label>
                <CurrencyInput
                  value={plannedExecAmount}
                  onValueChange={(value) => setPlannedExecAmount(value ?? 0)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Data real</Label>
                <Input
                  type="date"
                  value={plannedExecDate}
                  onChange={(e) => setPlannedExecDate(e.target.value)}
                />
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground flex gap-2">
                <CalendarClock className="w-4 h-4 flex-shrink-0" />
                Ao converter, o sistema cria uma saída na conta origem e uma entrada na conta destino. Não entra no DRE.
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPlannedToExecute(null)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmPlannedExecution}
                  disabled={executeOccurrence.isPending || plannedExecAmount <= 0 || !plannedExecDate}
                  className="flex-1"
                >
                  {executeOccurrence.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                  )}
                  Converter
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay Modal */}
      <Dialog open={showPayModal} onOpenChange={(v) => !v && setShowPayModal(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-income" />
              Confirmar Pagamento
            </DialogTitle>
          </DialogHeader>
          {payingTransaction && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">{payingTransaction.descricao || '-'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {payingTransaction.recurring_clients?.name || 'Sem cliente'} • {formatDate(payingTransaction.data_vencimento)}
                </p>
                <p className="text-lg font-bold mt-2">{formatCurrency(Number(payingTransaction.valor))}</p>
              </div>
              <div>
                <Label>Valor Pago</Label>
                <CurrencyInput
                  value={payValue}
                  onValueChange={(value) => setPayValue(value === null ? '' : String(value))}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Data de Pagamento</Label>
                <Input 
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowPayModal(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button 
                  onClick={handleConfirmPay} 
                  disabled={markPaidMutation.isPending}
                  className="flex-1 bg-income hover:bg-income/90"
                >
                  {markPaidMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Excluir Transação"
        message={`Tem certeza que deseja excluir "${deletingTransaction?.descricao}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
      />

      <Dialog open={showFixedDeleteOptions} onOpenChange={(v) => !v && closeFixedDeleteOptions()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Excluir despesa fixa
            </DialogTitle>
          </DialogHeader>
          {deletingTransaction && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm font-medium">{deletingTransaction.descricao || 'Despesa fixa'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Competência {String(deletingTransaction.competencia_mes).padStart(2, '0')}/{deletingTransaction.competencia_ano} • {formatCurrency(Number(deletingTransaction.valor))}
                </p>
              </div>

              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                Esta transação veio de uma despesa fixa-mãe. Se você apagar só esta parcela, a despesa fixa continua ativa e pode gerar novos meses no futuro.
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => handleFixedExpenseDelete('single')}
                  disabled={deleteMutation.isPending}
                >
                  <div className="text-left">
                    <p className="font-medium">Excluir somente esta parcela</p>
                    <p className="text-xs text-muted-foreground">Remove apenas este lançamento. A despesa fixa continua ativa.</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => handleFixedExpenseDelete('future')}
                  disabled={deleteMutation.isPending}
                >
                  <div className="text-left">
                    <p className="font-medium">Encerrar desta competência em diante</p>
                    <p className="text-xs text-muted-foreground">Define fim no mês anterior e remove parcelas futuras em aberto.</p>
                  </div>
                </Button>
                <Button
                  variant="destructive"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => handleFixedExpenseDelete('all')}
                  disabled={deleteMutation.isPending}
                >
                  <div className="text-left">
                    <p className="font-medium">Desativar despesa fixa inteira</p>
                    <p className="text-xs text-destructive-foreground/80">Desativa a despesa-mãe e remove parcelas em aberto.</p>
                  </div>
                </Button>
              </div>

              <Button variant="ghost" onClick={closeFixedDeleteOptions} className="w-full">
                Cancelar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Recurring Value Modal */}
      <TransactionEditModal
        open={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        transaction={editingTransaction}
      />

      {/* Bulk Edit Panel — edição em massa com proteções por contexto */}
      <BulkEditPanel
        open={showBulkEdit}
        onClose={() => setShowBulkEdit(false)}
        selectedTransactions={sortedTransactions.filter(t => selectedIds.has(t.id))}
        context={bulkContext}
        onSuccess={() => setSelectedIds(new Set())}
      />
    </>
  );
}
