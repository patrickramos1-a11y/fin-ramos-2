import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO, endOfMonth, subMonths } from 'date-fns';

// =============================================
// TYPES
// =============================================

export interface OpenPayment {
  id: string;
  tipo_movimento: 'ENTRADA' | 'SAIDA';
  natureza: 'RECORRENTE' | 'AVULSA';
  origem: string;
  descricao: string | null;
  valor: number;
  valor_pago: number | null;
  data_vencimento: string;
  data_pagamento: string | null;
  status: 'EM_ABERTO' | 'PAGO' | 'ATRASADO';
  competencia_mes: number;
  competencia_ano: number;
  cliente_id: string | null;
  account_id: string | null;
  entity_id: string | null;
  cliente?: { name: string } | null;
  category?: { name: string } | null;
  account?: { name: string } | null;
  entity?: { name: string } | null;
  contrato_id: string | null;
  installment_id: string | null;
  fixed_expense_id: string | null;
  days_overdue: number;
  days_until_due: number;
  due_bucket: 'overdue' | 'today' | 'next_7' | 'next_30' | 'future';
}

export interface OpenPaymentStats {
  totalReceivable: number;
  totalPayable: number;
  totalOverdue: number;
  totalDueToday: number;
  totalNext7: number;
  totalNext30: number;
  totalFuture: number;
  countReceivable: number;
  countPayable: number;
  countOverdue: number;
  countDueToday: number;
  countNext7: number;
  countNext30: number;
  countFuture: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
}

export interface OpenPaymentFilters {
  type?: 'ENTRADA' | 'SAIDA' | 'all';
  status?: 'EM_ABERTO' | 'ATRASADO' | 'PAGO' | 'all';
  bucket?: 'overdue' | 'today' | 'next_7' | 'next_30' | 'future' | 'all';
  clientId?: string;
  startDate?: string;
  endDate?: string;
  minDaysOverdue?: number;
}

// =============================================
// HOOKS
// =============================================

export function useOpenPayments(filters?: OpenPaymentFilters) {
  return useQuery({
    queryKey: ['open-payments', filters],
    queryFn: async () => {
      const today = new Date();
      const todayStart = parseISO(format(today, 'yyyy-MM-dd'));
      
      let query = supabase
        .from('transactions')
        .select(`
          *,
          cliente:recurring_clients(name),
          category:transaction_categories(name),
          account:accounts(name),
          entity:financial_entities!transactions_entity_id_fkey(name)
        `)
        .order('data_vencimento', { ascending: true });

      if (filters?.status === 'PAGO') {
        query = query.eq('status', 'PAGO');
      } else {
        query = query.in('status', ['EM_ABERTO', 'ATRASADO']);
      }
      
      if (filters?.type && filters.type !== 'all') {
        query = query.eq('tipo_movimento', filters.type);
      }
      
      if (filters?.status && filters.status !== 'all' && filters.status !== 'PAGO') {
        query = query.eq('status', filters.status);
      }
      
      if (filters?.clientId) {
        query = query.eq('cliente_id', filters.clientId);
      }

      if (filters?.startDate) {
        query = query.gte('data_vencimento', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('data_vencimento', filters.endDate);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      let payments: OpenPayment[] = (data || []).map(item => {
        const dueDate = item.data_vencimento ? parseISO(item.data_vencimento) : todayStart;
        const daysUntilDue = differenceInDays(dueDate, todayStart);
        const daysOverdue = Math.max(0, -daysUntilDue);
        const dueBucket: OpenPayment['due_bucket'] =
          daysUntilDue < 0 ? 'overdue' :
          daysUntilDue === 0 ? 'today' :
          daysUntilDue <= 7 ? 'next_7' :
          daysUntilDue <= 30 ? 'next_30' :
          'future';

        return {
          ...item,
          days_overdue: daysOverdue,
          days_until_due: Math.max(0, daysUntilDue),
          due_bucket: dueBucket,
        };
      });
      
      // Filter by min days overdue if specified
      if (filters?.minDaysOverdue) {
        payments = payments.filter(p => p.days_overdue >= filters.minDaysOverdue!);
      }

      if (filters?.bucket && filters.bucket !== 'all') {
        payments = payments.filter(p => p.due_bucket === filters.bucket);
      }
      
      return payments;
    },
  });
}

export function useOpenPaymentStats() {
  return useQuery({
    queryKey: ['open-payment-stats'],
    queryFn: async () => {
      const today = new Date();
      const todayStart = parseISO(format(today, 'yyyy-MM-dd'));
      
      const { data: currentData, error: currentError } = await supabase
        .from('transactions')
        .select('tipo_movimento, valor, status, data_vencimento')
        .in('status', ['EM_ABERTO', 'ATRASADO']);
      
      if (currentError) throw currentError;
      
      // Previous month comparison
      const lastMonth = subMonths(new Date(), 1);
      const lastMonthEnd = format(endOfMonth(lastMonth), 'yyyy-MM-dd');
      
      const { data: previousData, error: previousError } = await supabase
        .from('transactions')
        .select('tipo_movimento, valor')
        .in('status', ['EM_ABERTO', 'ATRASADO'])
        .lte('data_vencimento', lastMonthEnd);
      
      if (previousError) throw previousError;
      
      const stats: OpenPaymentStats = {
        totalReceivable: 0,
        totalPayable: 0,
        totalOverdue: 0,
        totalDueToday: 0,
        totalNext7: 0,
        totalNext30: 0,
        totalFuture: 0,
        countReceivable: 0,
        countPayable: 0,
        countOverdue: 0,
        countDueToday: 0,
        countNext7: 0,
        countNext30: 0,
        countFuture: 0,
        trend: 'stable',
        trendPercentage: 0,
      };
      
      currentData?.forEach(item => {
        const v = Number(item.valor) || 0;
        if (item.tipo_movimento === 'ENTRADA') {
          stats.totalReceivable += v;
          stats.countReceivable++;
        } else {
          stats.totalPayable += v;
          stats.countPayable++;
        }

        const dueDate = item.data_vencimento ? parseISO(item.data_vencimento) : todayStart;
        const daysUntilDue = differenceInDays(dueDate, todayStart);
        if (daysUntilDue < 0) {
          stats.totalOverdue += v;
          stats.countOverdue++;
        } else if (daysUntilDue === 0) {
          stats.totalDueToday += v;
          stats.countDueToday++;
        } else if (daysUntilDue <= 7) {
          stats.totalNext7 += v;
          stats.countNext7++;
        } else if (daysUntilDue <= 30) {
          stats.totalNext30 += v;
          stats.countNext30++;
        } else {
          stats.totalFuture += v;
          stats.countFuture++;
        }
      });

      // Calculate trend
      const currentTotal = stats.totalReceivable + stats.totalPayable;
      const previousTotal = previousData?.reduce((sum, item) => sum + (Number(item.valor) || 0), 0) || 0;
      
      if (previousTotal > 0) {
        const change = ((currentTotal - previousTotal) / previousTotal) * 100;
        stats.trendPercentage = Math.abs(change);
        stats.trend = change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable';
      }
      
      return stats;
    },
  });
}

export function useMarkAsPaid() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      transactionId, 
      paidValue, 
      paymentDate, 
      accountId 
    }: { 
      transactionId: string; 
      paidValue: number; 
      paymentDate: string; 
      accountId?: string;
    }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update({
          status: 'PAGO',
          valor_pago: paidValue,
          data_pagamento: paymentDate,
          account_id: accountId,
        })
        .eq('id', transactionId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update account balance if account specified
      if (accountId && data) {
        const delta = data.tipo_movimento === 'ENTRADA' ? paidValue : -paidValue;
        
        const { data: account } = await supabase
          .from('accounts')
          .select('current_balance')
          .eq('id', accountId)
          .single();
        
        if (account) {
          await supabase
            .from('accounts')
            .update({ current_balance: account.current_balance + delta })
            .eq('id', accountId);
        }
      }
      
      // Log to history
      await supabase.from('transaction_history').insert({
        transaction_id: transactionId,
        evento: 'MARCADO_PAGO',
        modulo_origem: 'EM_ABERTO',
        dados_anteriores: { valor_pago: paidValue, data_pagamento: paymentDate }
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-payments'] });
      queryClient.invalidateQueries({ queryKey: ['open-payment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Pagamento registrado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao registrar pagamento: ' + error.message);
    },
  });
}

export function useUpdateDueDate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      transactionId, 
      newDueDate 
    }: { 
      transactionId: string; 
      newDueDate: string;
    }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update({
          data_vencimento: newDueDate,
          status: differenceInDays(new Date(), parseISO(newDueDate)) > 0 ? 'ATRASADO' : 'EM_ABERTO'
        })
        .eq('id', transactionId)
        .select()
        .single();
      
      if (error) throw error;
      
      await supabase.from('transaction_history').insert({
        transaction_id: transactionId,
        evento: 'ALTERADO',
        modulo_origem: 'EM_ABERTO',
        dados_anteriores: { nova_data_vencimento: newDueDate }
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-payments'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Data de vencimento atualizada!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar data: ' + error.message);
    },
  });
}

export function useOpenPaymentsEvolution() {
  return useQuery({
    queryKey: ['open-payments-evolution'],
    queryFn: async () => {
      const months: { month: string; receivable: number; payable: number }[] = [];
      
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const monthEnd = format(endOfMonth(date), 'yyyy-MM-dd');
        
        const { data } = await supabase
          .from('transactions')
          .select('tipo_movimento, valor, created_at')
          .in('status', ['EM_ABERTO', 'ATRASADO'])
          .lte('created_at', monthEnd);
        
        const receivable = data?.filter(d => d.tipo_movimento === 'ENTRADA').reduce((sum, d) => sum + d.valor, 0) || 0;
        const payable = data?.filter(d => d.tipo_movimento === 'SAIDA').reduce((sum, d) => sum + d.valor, 0) || 0;
        
        months.push({
          month: format(date, 'MMM/yy'),
          receivable,
          payable
        });
      }
      
      return months;
    },
  });
}
