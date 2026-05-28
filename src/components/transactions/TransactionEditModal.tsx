import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput, parseBRLToNumber } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Pencil, AlertCircle, History, Save, X, Link2, Lock, Unlock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatCurrency } from '@/data/mockData';
import { useAuth } from '@/hooks/useAuth';
import type { TransactionWithClient } from '@/hooks/useTransactions';
import { getEntityIcon } from '@/utils/entityIcons';
import { ensureDarkColor, colorFromName } from '@/utils/entityVisual';
import { CategorySearchInput, normalizeForSearch } from './CategorySearchInput';

interface TransactionEditModalProps {
  open: boolean;
  onClose: () => void;
  transaction: TransactionWithClient | null;
}

export function TransactionEditModal({ open, onClose, transaction }: TransactionEditModalProps) {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scope, setScope] = useState<'single' | 'future' | 'all'>('single');
  const [allowValueEdit, setAllowValueEdit] = useState(false);

  // Form state
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');
  const [status, setStatus] = useState('');
  const [valorPago, setValorPago] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [entityId, setEntityId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [documentoTipo, setDocumentoTipo] = useState('');
  const [documentoNumero, setDocumentoNumero] = useState('');
  const [notes, setNotes] = useState('');
  const [categorySearch, setCategorySearch] = useState('');

  // Lookup data — fetch active + inactive so currently-selected (possibly inactive)
  // values still appear and so newly-reactivated cost centers / accounts show up.
  const { data: categories } = useQuery({
    queryKey: ['transaction_categories_with_account_all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('transaction_categories')
        .select('id, name, type, expense_type, subtype, default_account_id, cost_center_id, color, active')
        .order('name');
      return data || [];
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts_list_all'],
    queryFn: async () => {
      const { data } = await supabase.from('accounts').select('id, name, active').order('name');
      return data || [];
    },
  });

  const { data: costCenters } = useQuery({
    queryKey: ['cost_centers_list_all'],
    queryFn: async () => {
      const { data } = await supabase.from('cost_centers').select('id, name, active').order('name');
      return data || [];
    },
  });

  const { data: entities } = useQuery({
    queryKey: ['entities_list'],
    queryFn: async () => {
      const { data } = await supabase.from('financial_entities').select('id, name, type').eq('active', true).order('name');
      return data || [];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients_list'],
    queryFn: async () => {
      const { data } = await supabase.from('recurring_clients').select('id, name').eq('active', true).order('name');
      return data || [];
    },
  });

  const isRecurring = transaction?.natureza === 'RECORRENTE';

  useEffect(() => {
    if (transaction && open) {
      setValor(String(transaction.valor));
      setDataVencimento(transaction.data_vencimento || '');
      setDataPagamento(transaction.data_pagamento || '');
      setStatus(transaction.status);
      setValorPago(transaction.valor_pago ? String(transaction.valor_pago) : '');
      setDescricao(transaction.descricao || '');
      setCategoryId(transaction.transaction_category_id || '');
      setAccountId(transaction.account_id || '');
      setCostCenterId(transaction.cost_center_id || '');
      setEntityId(transaction.entity_id || '');
      setClienteId((transaction as any).cliente_id || '');
      setDocumentoTipo(transaction.documento_tipo || '');
      setDocumentoNumero(transaction.documento_numero || '');
      setNotes(transaction.notes || '');
      setScope('single');
      setAllowValueEdit(false);
    }
  }, [transaction, open]);

  const handleSubmit = async (approveAfter: boolean = false) => {
    if (!transaction) return;
    
    const parsedValor = parseBRLToNumber(valor) ?? 0;
    if (!parsedValor || parsedValor <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    if (!entityId) {
      toast.error('Entidade é obrigatória');
      return;
    }

    setIsSubmitting(true);
    try {
      // Audit history
      await supabase.from('transaction_history').insert({
        transaction_id: transaction.id,
        evento: 'ALTERADO' as const,
        modulo_origem: 'EDICAO_TRANSACAO',
        user_id: user?.id || 'system',
        dados_anteriores: {
          valor: transaction.valor,
          status: transaction.status,
          data_vencimento: transaction.data_vencimento,
          documento_tipo: transaction.documento_tipo,
          scope,
        },
      });

      // Build update object
      const updates: any = {
        valor: parsedValor,
        data_vencimento: dataVencimento,
        status,
        descricao,
        documento_tipo: documentoTipo || null,
        documento_numero: documentoNumero || null,
        notes: notes || null,
        transaction_category_id: categoryId || null,
        account_id: accountId || null,
        cost_center_id: costCenterId || null,
        entity_id: entityId || null,
        cliente_id: clienteId || null,
      };

      // Handle payment fields
      if (status === 'PAGO') {
        updates.data_pagamento = dataPagamento || new Date().toISOString().split('T')[0];
        updates.valor_pago = parseBRLToNumber(valorPago) ?? parsedValor;
      } else {
        updates.data_pagamento = null;
        updates.valor_pago = null;
      }

      // Role-based approval: financeiro edits reset to pending, admin edits don't
      if (role === 'financeiro') {
        updates.approval_status = 'pendente';
      }

      // "Salvar e Aprovar" overrides — admin can approve in the same action
      if (approveAfter && role === 'admin') {
        updates.approval_status = 'aprovado';
        updates.approved_by = user?.id;
        updates.approved_at = new Date().toISOString();
        updates.rejection_reason = null;
      }

      await supabase.from('transactions').update(updates).eq('id', transaction.id);

      // Keep the fixed_expense master name in sync with the edited description
      // (the approval grouping uses fixed_expenses.nome as the group title).
      if (transaction.fixed_expense_id && descricao && descricao !== transaction.descricao) {
        await supabase
          .from('fixed_expenses')
          .update({ nome: descricao })
          .eq('id', transaction.fixed_expense_id);

        // Propagate the new name to sibling pending transactions of the same fixed expense
        // so the snapshot in the approval list reflects it immediately.
        await supabase
          .from('transactions')
          .update({ descricao })
          .eq('fixed_expense_id', transaction.fixed_expense_id)
          .neq('id', transaction.id)
          .neq('status', 'PAGO');
      }

      // Handle recurring scope (future or all)
      if ((scope === 'future' || scope === 'all') && isRecurring) {
        const propagateUpdates: any = { valor: parsedValor };
        if (categoryId) propagateUpdates.transaction_category_id = categoryId;
        if (accountId) propagateUpdates.account_id = accountId;
        if (costCenterId) propagateUpdates.cost_center_id = costCenterId;
        if (entityId) propagateUpdates.entity_id = entityId;
        if (clienteId) propagateUpdates.cliente_id = clienteId;
        if (documentoTipo) propagateUpdates.documento_tipo = documentoTipo;

        if (transaction.contrato_id) {
          let q = supabase
            .from('recurring_installments')
            .select('id')
            .eq('contract_id', transaction.contrato_id);
          if (scope === 'future') {
            q = q.neq('status', 'PAGO').or(`competence_year.gt.${transaction.competencia_ano},and(competence_year.eq.${transaction.competencia_ano},competence_month.gt.${transaction.competencia_mes})`);
          }
          const { data: insts } = await q;
          if (insts?.length) {
            const ids = insts.map(i => i.id);
            await supabase.from('recurring_installments').update({ expected_value: parsedValor }).in('id', ids);
            let txQ = supabase.from('transactions').update(propagateUpdates).in('installment_id', ids).neq('id', transaction.id);
            if (scope === 'future') txQ = txQ.neq('status', 'PAGO');
            await txQ;
          }
        } else if (transaction.fixed_expense_id) {
          let q = supabase
            .from('transactions')
            .update(propagateUpdates)
            .eq('fixed_expense_id', transaction.fixed_expense_id)
            .neq('id', transaction.id);
          if (scope === 'future') {
            q = q.neq('status', 'PAGO').or(`competencia_ano.gt.${transaction.competencia_ano},and(competencia_ano.eq.${transaction.competencia_ano},competencia_mes.gt.${transaction.competencia_mes})`);
          }
          await q;

          // Update base fixed expense template (UUID columns only)
          const feUpdates: any = { valor: parsedValor };
          if (categoryId) feUpdates.transaction_category_id = categoryId;
          if (accountId) feUpdates.account_id = accountId;
          if (costCenterId) feUpdates.cost_center_id = costCenterId;
          if (clienteId) feUpdates.cliente_id = clienteId;
          await supabase.from('fixed_expenses').update(feUpdates).eq('id', transaction.fixed_expense_id);
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['approval-transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['rejected-transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['recurring-installments'] }),
        queryClient.invalidateQueries({ queryKey: ['recurring_installments'] }),
        queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] }),
        queryClient.invalidateQueries({ queryKey: ['pending-approval-count'] }),
        queryClient.invalidateQueries({ queryKey: ['open-payments'] }),
        queryClient.invalidateQueries({ queryKey: ['open-payment-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions_chart_v2'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions_annual'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions_projection'] }),
      ]);
      // Force refetch of active queries so the UI updates immediately
      await queryClient.refetchQueries({ queryKey: ['approval-transactions'], type: 'active' });
      await queryClient.refetchQueries({ queryKey: ['transactions'], type: 'active' });

      const baseMsg = scope === 'all' && isRecurring
        ? 'Lançamento atualizado em TODAS as parcelas (passadas e futuras).'
        : scope === 'future' && isRecurring
        ? 'Lançamento atualizado neste e em todos os próximos.'
        : 'Lançamento atualizado com sucesso.';
      toast.success(approveAfter && role === 'admin' ? `${baseMsg} Aprovado.` : baseMsg);
      onClose();
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      toast.error('Erro ao atualizar: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!transaction) return null;

  const filteredCategories = categories?.filter(c => c.type === transaction.tipo_movimento) || [];

  // Cross-filter: a category may be filtered by account AND by cost-center
  const categoriesForFilters = filteredCategories.filter(c => {
    if (accountId && c.default_account_id && c.default_account_id !== accountId) return false;
    if (costCenterId && c.cost_center_id && c.cost_center_id !== costCenterId) return false;
    return true;
  });

  const groupedCategories = (() => {
    const q = normalizeForSearch(categorySearch.trim());
    const source = q
      ? categoriesForFilters.filter(c => normalizeForSearch(c.name).includes(q))
      : categoriesForFilters;
    const groups: Record<string, { accountName: string; items: typeof filteredCategories }> = {};
    source.forEach(c => {
      const accId = c.default_account_id || '__nodef__';
      const accName = accounts?.find(a => a.id === accId)?.name || 'Sem conta padrão';
      if (!groups[accId]) groups[accId] = { accountName: accName, items: [] };
      groups[accId].items.push(c);
    });
    return Object.values(groups).sort((a, b) => a.accountName.localeCompare(b.accountName));
  })();

  // Cascading visible lists: account list depends on CC (and vice-versa).
  // Always keep currently-selected (sticky) values visible so UI stays consistent.
  const tipo = transaction.tipo_movimento;
  const catsOfTipo = (categories || []).filter(c => c.type === tipo);

  const visibleAccounts = (() => {
    const relevant = costCenterId
      ? catsOfTipo.filter(c => c.cost_center_id === costCenterId)
      : catsOfTipo;
    const accIds = new Set(relevant.map(c => c.default_account_id).filter(Boolean));
    if (accountId) accIds.add(accountId);
    return (accounts || []).filter(a => (a.active && accIds.has(a.id)) || a.id === accountId);
  })();

  const visibleCostCenters = (() => {
    const relevant = accountId
      ? catsOfTipo.filter(c => c.default_account_id === accountId)
      : catsOfTipo;
    const ccIds = new Set(relevant.map(c => c.cost_center_id).filter(Boolean));
    if (costCenterId) ccIds.add(costCenterId);
    return (costCenters || []).filter(cc => (cc.active && ccIds.has(cc.id)) || cc.id === costCenterId);
  })();

  // When category is selected, auto-fill account + cost-center from its defaults
  const handleCategoryChange = (newCategoryId: string) => {
    setCategoryId(newCategoryId);
    if (newCategoryId) {
      const cat = filteredCategories.find(c => c.id === newCategoryId);
      if (cat?.default_account_id) setAccountId(cat.default_account_id);
      if (cat?.cost_center_id) setCostCenterId(cat.cost_center_id);
    }
  };

  // When account changes: clear category + CC if they become incompatible
  const handleAccountChange = (newAccountId: string) => {
    setAccountId(newAccountId);
    if (!newAccountId) return;
    if (categoryId) {
      const cat = filteredCategories.find(c => c.id === categoryId);
      if (cat?.default_account_id && cat.default_account_id !== newAccountId) setCategoryId('');
    }
    if (costCenterId) {
      const hasMatch = catsOfTipo.some(c => c.default_account_id === newAccountId && c.cost_center_id === costCenterId);
      if (!hasMatch) setCostCenterId('');
    }
  };

  // When cost-center changes: clear category + account if they become incompatible
  const handleCostCenterChange = (newCcId: string) => {
    setCostCenterId(newCcId);
    if (!newCcId) return;
    if (categoryId) {
      const cat = filteredCategories.find(c => c.id === categoryId);
      if (cat?.cost_center_id && cat.cost_center_id !== newCcId) setCategoryId('');
    }
    if (accountId) {
      const hasMatch = catsOfTipo.some(c => c.cost_center_id === newCcId && c.default_account_id === accountId);
      if (!hasMatch) setAccountId('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" />
            Editar Lançamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current info */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <p className="text-sm font-medium">{transaction.descricao || '—'}</p>
            <p className="text-xs text-muted-foreground">
              {transaction.recurring_clients?.name || 'Sem cliente'} • 
              {' '}{transaction.competencia_mes.toString().padStart(2, '0')}/{transaction.competencia_ano}
              {isRecurring && ' • Recorrente'}
            </p>
            <p className="text-sm">
              Valor atual: <strong>{formatCurrency(Number(transaction.valor))}</strong>
            </p>
          </div>

          {/* Description */}
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          {/* Value + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="flex items-center gap-1.5">
                Valor (R$) *
                {allowValueEdit ? <Unlock className="w-3 h-3 text-amber-500" /> : <Lock className="w-3 h-3 text-muted-foreground" />}
              </Label>
              <CurrencyInput
                value={valor}
                onValueChange={(n) => setValor(n === null ? '' : String(n))}
                disabled={!allowValueEdit}
                autoFocus={allowValueEdit}
              />
              <label className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <Checkbox
                  checked={allowValueEdit}
                  onCheckedChange={(v) => setAllowValueEdit(v === true)}
                />
                Permitir alteração do valor
              </label>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EM_ABERTO">Em Aberto</SelectItem>
                  <SelectItem value="PAGO">Pago</SelectItem>
                  <SelectItem value="ATRASADO">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Payment fields when PAGO */}
          {status === 'PAGO' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Pago</Label>
                <CurrencyInput value={valorPago} onValueChange={(n) => setValorPago(n === null ? '' : String(n))} placeholder={valor || '0,00'} />
              </div>
              <div>
                <Label>Data Pagamento</Label>
                <Input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
              </div>
            </div>
          )}

          {/* Dates */}
          <div>
            <Label>Data Vencimento</Label>
            <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
          </div>

          {/* Cliente */}
          <div>
            <Label>Cliente</Label>
            <Select value={clienteId || '__none__'} onValueChange={(v) => setClienteId(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {clients?.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Account first (filters categories) — with clear button */}
          <div>
            <div className="flex items-center justify-between">
              <Label>Conta</Label>
              {(accountId || costCenterId) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setAccountId(''); setCostCenterId(''); }}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  title="Limpar filtros (mantém a categoria)"
                >
                  <X className="w-3 h-3 mr-1" /> Limpar filtros
                </Button>
              )}
            </div>
            <Select value={accountId || '__none__'} onValueChange={(v) => handleAccountChange(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Todas as contas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Todas as contas</SelectItem>
                {visibleAccounts.map(a => {
                  const Icon = getEntityIcon(a.name);
                  const color = colorFromName(a.name);
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded"
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          <Icon className="w-3 h-3" />
                        </span>
                        <span style={{ color }} className="font-medium">{a.name}</span>
                        {!a.active && <Badge variant="outline" className="text-[9px] px-1 py-0">inativo</Badge>}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Category grouped by account, with icons + colors */}
          <div>
            <Label>
              Categoria{' '}
              {(accountId || costCenterId) && (
                <span className="text-xs text-muted-foreground">
                  (filtrada {accountId && costCenterId ? 'pela conta + centro de custo' : accountId ? 'pela conta' : 'pelo centro de custo'})
                </span>
              )}
            </Label>
            <Select value={categoryId || '__none__'} onValueChange={(v) => handleCategoryChange(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent className="max-h-[360px]">
                <CategorySearchInput value={categorySearch} onChange={setCategorySearch} />
                <SelectItem value="__none__">Nenhuma</SelectItem>
                {groupedCategories.map(group => (
                  <div key={group.accountName}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/40 sticky top-0">
                      {group.accountName}
                    </div>
                    {group.items.map(c => {
                      const Icon = getEntityIcon(c.name);
                      const color = ensureDarkColor((c as any).color);
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-flex items-center justify-center w-5 h-5 rounded"
                              style={{ backgroundColor: `${color}20`, color }}
                            >
                              <Icon className="w-3 h-3" />
                            </span>
                            <span style={{ color }} className="font-medium">{c.name}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </div>
                ))}
                {groupedCategories.length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center space-y-2">
                    <p>Nenhuma categoria para este filtro</p>
                    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                      {accountId && (
                        <button
                          type="button"
                          className="text-primary underline"
                          onClick={() => setAccountId('')}
                        >
                          Limpar Conta
                        </button>
                      )}
                      {costCenterId && (
                        <button
                          type="button"
                          className="text-primary underline"
                          onClick={() => setCostCenterId('')}
                        >
                          Limpar Centro de Custo
                        </button>
                      )}
                      {accountId && costCenterId && (
                        <button
                          type="button"
                          className="text-primary underline"
                          onClick={() => { setAccountId(''); setCostCenterId(''); }}
                        >
                          Limpar ambos
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Inheritance panel — Conta + C. Custo herdados da categoria */}
          {categoryId && (() => {
            const linkedAccount = accounts?.find(a => a.id === accountId);
            const linkedCC = costCenters?.find(cc => cc.id === costCenterId);
            return (
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1 border border-border/50">
                <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                  <Link2 className="w-3 h-3" />
                  <span>Vínculos automáticos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Conta vinculada:</span>
                  <span className={`font-medium ${!linkedAccount ? 'text-warning' : ''}`}>
                    {linkedAccount?.name || '⚠ Sem conta'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Centro de Custo:</span>
                  <span className="font-medium">{linkedCC?.name || '—'}</span>
                </div>
              </div>
            );
          })()}
          <div>
            <Label>Vinculado a (Entidade) <span className="text-destructive">*</span></Label>
            <p className="text-[10px] text-muted-foreground mb-1">Pessoa ou grupo beneficiário do lançamento (ex.: FGTS → colaborador específico).</p>
            <Select value={entityId || '__none__'} onValueChange={(v) => setEntityId(v === '__none__' ? '' : v)}>
              <SelectTrigger className={!entityId ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecione uma entidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhuma</SelectItem>
                {entities?.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!entityId && (
              <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Entidade é obrigatória
              </p>
            )}
          </div>

          <div>
            <Label>Centro de Custo</Label>
            <Select value={costCenterId || '__none__'} onValueChange={(v) => handleCostCenterChange(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {visibleCostCenters.map(cc => {
                  const Icon = getEntityIcon(cc.name);
                  const color = colorFromName(cc.name);
                  return (
                    <SelectItem key={cc.id} value={cc.id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded"
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          <Icon className="w-3 h-3" />
                        </span>
                        <span style={{ color }} className="font-medium">{cc.name}</span>
                        {!cc.active && <Badge variant="outline" className="text-[9px] px-1 py-0">inativo</Badge>}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Document type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo Documento</Label>
              <Select value={documentoTipo} onValueChange={setDocumentoTipo}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEM_DOCUMENTO">Sem Documento</SelectItem>
                  <SelectItem value="NF">Nota Fiscal</SelectItem>
                  <SelectItem value="RECIBO">Recibo</SelectItem>
                  <SelectItem value="NOTA_DEBITO">Nota de Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nº Documento</Label>
              <Input value={documentoNumero} onChange={(e) => setDocumentoNumero(e.target.value)} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {/* Recurring scope */}
          {isRecurring && (
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-warning" />
                Aplicar alteração em:
              </p>
              <RadioGroup value={scope} onValueChange={(v) => setScope(v as 'single' | 'future' | 'all')}>
                <div className="flex items-start gap-3 p-2 rounded hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="single" id="edit-scope-single" className="mt-0.5" />
                  <label htmlFor="edit-scope-single" className="cursor-pointer">
                    <p className="text-sm font-medium">Somente neste lançamento</p>
                    <p className="text-xs text-muted-foreground">
                      Apenas na competência {transaction.competencia_mes.toString().padStart(2, '0')}/{transaction.competencia_ano}
                    </p>
                  </label>
                </div>
                <div className="flex items-start gap-3 p-2 rounded hover:bg-muted/30 cursor-pointer">
                  <RadioGroupItem value="future" id="edit-scope-future" className="mt-0.5" />
                  <label htmlFor="edit-scope-future" className="cursor-pointer">
                    <p className="text-sm font-medium">Este e todos os próximos</p>
                    <p className="text-xs text-muted-foreground">Atualiza este e todos os lançamentos futuros em aberto</p>
                  </label>
                </div>
                <div className="flex items-start gap-3 p-2 rounded hover:bg-destructive/5 cursor-pointer border border-destructive/20">
                  <RadioGroupItem value="all" id="edit-scope-all" className="mt-0.5" />
                  <label htmlFor="edit-scope-all" className="cursor-pointer">
                    <p className="text-sm font-medium text-destructive">Todas (passadas, em aberto e futuras)</p>
                    <p className="text-xs text-muted-foreground">
                      ⚠️ Corrige toda a série, inclusive parcelas já pagas. Use para corrigir um cadastro errado em massa.
                    </p>
                  </label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Approval note */}
          {role === 'financeiro' && (
            <div className="flex items-start gap-2 p-2 rounded bg-warning/10 text-xs text-warning">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Esta alteração enviará o lançamento para re-aprovação.</span>
            </div>
          )}

          {/* Audit note */}
          <div className="flex items-start gap-2 p-2 rounded bg-muted/30 text-xs text-muted-foreground">
            <History className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Os valores anteriores serão preservados no histórico para fins de auditoria.</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting || !entityId}
            className="flex-1"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Alterações
          </Button>
          {role === 'admin' && (transaction as any).approval_status === 'pendente' && (
            <Button
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting || !entityId}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar e Aprovar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
