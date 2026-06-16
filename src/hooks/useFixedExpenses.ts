import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FixedExpenseRow {
  id: string;
  nome: string;
  valor: number;
  dia_vencimento: number;
  transaction_category_id: string | null;
  cost_center_id: string | null;
  account_id: string | null;
  payment_method_id: string | null;
  cliente_id: string | null;
  data_inicio: string;
  data_fim: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch all active fixed expenses
export function useFixedExpenses() {
  return useQuery({
    queryKey: ['fixed_expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fixed_expenses')
        .select('*')
        .eq('active', true)
        .order('nome');

      if (error) throw error;
      return data as FixedExpenseRow[];
    },
  });
}

// Create fixed expense
export function useCreateFixedExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expense: Partial<FixedExpenseRow>) => {
      const { data, error } = await supabase
        .from('fixed_expenses')
        .insert({
          nome: expense.nome!,
          valor: expense.valor!,
          dia_vencimento: expense.dia_vencimento!,
          transaction_category_id: expense.transaction_category_id,
          cost_center_id: expense.cost_center_id,
          account_id: expense.account_id,
          payment_method_id: expense.payment_method_id,
          cliente_id: expense.cliente_id,
          data_inicio: expense.data_inicio || new Date().toISOString().split('T')[0],
          data_fim: expense.data_fim,
          notes: expense.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_expenses'] });
      toast.success('Despesa fixa criada com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating fixed expense:', error);
      toast.error('Erro ao criar despesa fixa');
    },
  });
}

// Update fixed expense
export function useUpdateFixedExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FixedExpenseRow> & { id: string }) => {
      const { error } = await supabase
        .from('fixed_expenses')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_expenses'] });
      toast.success('Despesa fixa atualizada!');
    },
    onError: (error) => {
      console.error('Error updating fixed expense:', error);
      toast.error('Erro ao atualizar despesa fixa');
    },
  });
}

// Delete (deactivate) fixed expense
export function useDeleteFixedExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase
        .from('fixed_expenses')
        .update({ active: false })
        .eq('id', expenseId);

      if (error) throw error;
      return expenseId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_expenses'] });
      toast.success('Despesa fixa excluída!');
    },
    onError: (error) => {
      console.error('Error deleting fixed expense:', error);
      toast.error('Erro ao excluir despesa fixa');
    },
  });
}

// Generate monthly transactions from fixed expenses
export function useGenerateFixedExpenseTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ year, month }: { year: number; month: number }) => {
      const { data: expenses, error: fetchError } = await supabase
        .from('fixed_expenses')
        .select('*')
        .eq('active', true);

      if (fetchError) throw fetchError;

      // Pré-carrega categorias para resolver fallback de conta (default_account_id)
      const categoryIds = Array.from(new Set((expenses || [])
        .map(e => e.transaction_category_id).filter(Boolean))) as string[];
      const { data: categories } = categoryIds.length > 0
        ? await supabase.from('transaction_categories')
            .select('id, default_account_id, cost_center_id')
            .in('id', categoryIds)
        : { data: [] as any[] };
      const categoryMap = new Map((categories || []).map(c => [c.id, c]));

      const { data: existingTransactions } = await supabase
        .from('transactions')
        .select('fixed_expense_id')
        .eq('origem', 'DESPESA_FIXA')
        .eq('competencia_ano', year)
        .eq('competencia_mes', month);

      const { data: rejectedTransactions } = await supabase
        .from('rejected_transactions')
        .select('fixed_expense_id')
        .eq('origem', 'DESPESA_FIXA')
        .eq('competencia_ano', year)
        .eq('competencia_mes', month)
        .not('fixed_expense_id', 'is', null);

      const existingExpenseIds = new Set([
        ...(existingTransactions?.map(t => t.fixed_expense_id).filter(Boolean) || []),
        ...(rejectedTransactions?.map(t => t.fixed_expense_id).filter(Boolean) || []),
      ]);

      const orphans: string[] = [];
      const newTransactions = expenses
        ?.filter(e => !existingExpenseIds.has(e.id))
        .filter(e => {
          const startDate = new Date(e.data_inicio);
          const endDate = e.data_fim ? new Date(e.data_fim) : null;
          const checkDate = new Date(year, month - 1, 1);
          return startDate <= checkDate && (!endDate || endDate >= checkDate);
        })
        .map(e => {
          const lastDayOfMonth = new Date(year, month, 0).getDate();
          const dueDay = Math.min(e.dia_vencimento, lastDayOfMonth);
          const dueDate = new Date(year, month - 1, dueDay);

          // Fallback: conta da despesa → conta padrão da categoria
          const cat = e.transaction_category_id ? categoryMap.get(e.transaction_category_id) : null;
          const resolvedAccountId = e.account_id ?? cat?.default_account_id ?? null;
          const resolvedCostCenterId = e.cost_center_id ?? cat?.cost_center_id ?? null;

          if (!resolvedAccountId) {
            orphans.push(e.nome);
          }

          return {
            tipo_movimento: 'SAIDA' as const,
            natureza: 'RECORRENTE' as const,
            origem: 'DESPESA_FIXA' as const,
            fixed_expense_id: e.id,
            competencia_mes: month,
            competencia_ano: year,
            valor: e.valor,
            data_vencimento: dueDate.toISOString().split('T')[0],
            status: 'EM_ABERTO' as const,
            descricao: e.nome,
            transaction_category_id: e.transaction_category_id,
            cost_center_id: resolvedCostCenterId,
            account_id: resolvedAccountId,
            cliente_id: e.cliente_id,
          };
        }).filter(t => t.account_id !== null); // Bloqueia inserção de órfãs

      if (orphans.length > 0) {
        toast.error(
          `${orphans.length} despesa(s) fixa(s) sem conta vinculada (categoria também não tem conta padrão): ${orphans.slice(0, 3).join(', ')}${orphans.length > 3 ? '…' : ''}. Corrija o cadastro antes de gerar.`,
          { duration: 8000 }
        );
      }

      if (newTransactions && newTransactions.length > 0) {
        const { error: insertError } = await supabase
          .from('transactions')
          .insert(newTransactions);

        if (insertError) throw insertError;
      }

      return newTransactions?.length || 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approval-count'] });
      if (count > 0) {
        toast.success(`${count} transações de despesas fixas geradas!`);
      } else {
        toast.info('Todas as despesas fixas já foram geradas para este mês.');
      }
    },
    onError: (error) => {
      console.error('Error generating fixed expense transactions:', error);
      toast.error('Erro ao gerar transações de despesas fixas');
    },
  });
}
