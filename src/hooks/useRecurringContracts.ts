import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface MinimumWageConfig {
  id: string;
  year: number;
  value: number;
  effective_date: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ContractPlan {
  id: string;
  name: string;
  minimum_wage_factor: number;
  description?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecurringClient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  address?: string;
  notes?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecurringContract {
  id: string;
  client_id: string;
  plan_id?: string;
  custom_minimum_wage_factor?: number;
  start_date: string;
  end_date?: string;
  notes?: string;
  exigir_emissao_nf?: 'SEMPRE' | 'NUNCA' | 'PERGUNTAR';
  active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  client?: RecurringClient;
  plan?: ContractPlan;
}

export interface RecurringInstallment {
  id: string;
  contract_id: string;
  competence_month: number;
  competence_year: number;
  minimum_wage_value: number;
  minimum_wage_factor: number;
  expected_value: number;
  paid_value?: number;
  payment_date?: string;
  due_date: string;
  status: 'PAGO' | 'EM_ABERTO' | 'ATRASADO' | 'CANCELADO';
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  contract?: RecurringContract;
}

// Safe date parser for YYYY-MM-DD without timezone drift
function parseLocalDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Hook for minimum wage config
export function useMinimumWageConfig(year?: number) {
  return useQuery({
    queryKey: ['minimum-wage-config', year],
    queryFn: async () => {
      let query = supabase
        .from('minimum_wage_config')
        .select('*')
        .order('year', { ascending: false });
      
      if (year) {
        query = query.eq('year', year);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MinimumWageConfig[];
    },
  });
}

// Hook for contract plans
export function useContractPlans() {
  return useQuery({
    queryKey: ['contract-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_plans')
        .select('*')
        .order('minimum_wage_factor', { ascending: true });
      
      if (error) throw error;
      return data as ContractPlan[];
    },
  });
}

// Hook for recurring clients
export function useRecurringClients() {
  return useQuery({
    queryKey: ['recurring-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_clients')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as RecurringClient[];
    },
  });
}

// Hook for recurring contracts with client and plan data
export function useRecurringContracts() {
  return useQuery({
    queryKey: ['recurring-contracts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_contracts')
        .select(`
          *,
          client:recurring_clients(*),
          plan:contract_plans(*)
        `)
        .eq('active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as RecurringContract[];
    },
  });
}

// Hook for installments with filters
export function useRecurringInstallments(filters?: {
  year?: number;
  month?: number;
  status?: string;
  contractId?: string;
}) {
  return useQuery({
    queryKey: ['recurring-installments', filters],
    queryFn: async () => {
      let query = supabase
        .from('recurring_installments')
        .select(`
          *,
          contract:recurring_contracts(
            *,
            client:recurring_clients(*),
            plan:contract_plans(*)
          )
        `)
        .order('competence_year', { ascending: true })
        .order('competence_month', { ascending: true });
      
      if (filters?.year) {
        query = query.eq('competence_year', filters.year);
      }
      if (filters?.month) {
        query = query.eq('competence_month', filters.month);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.contractId) {
        query = query.eq('contract_id', filters.contractId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as RecurringInstallment[];
    },
  });
}

// Mutation to mark installment as paid
export function useMarkInstallmentPaid() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      installmentId, 
      paidValue, 
      paymentDate 
    }: { 
      installmentId: string; 
      paidValue: number; 
      paymentDate?: string;
    }) => {
      const { data, error } = await supabase
        .from('recurring_installments')
        .update({
          status: 'PAGO',
          paid_value: paidValue,
          payment_date: paymentDate || new Date().toISOString().split('T')[0],
        })
        .eq('id', installmentId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-installments'] });
    },
  });
}

// Mutation to update minimum wage config
export function useUpdateMinimumWage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      year, 
      value, 
      notes 
    }: { 
      year: number; 
      value: number; 
      notes?: string;
    }) => {
      // Check if exists
      const { data: existing } = await supabase
        .from('minimum_wage_config')
        .select('id')
        .eq('year', year)
        .maybeSingle();
      
      if (existing) {
        const { data, error } = await supabase
          .from('minimum_wage_config')
          .update({ value, notes })
          .eq('year', year)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('minimum_wage_config')
          .insert({ year, value, notes, effective_date: `${year}-01-01` })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minimum-wage-config'] });
    },
  });
}

// Calculate dashboard KPIs
export function useRecurringKPIs(year: number = 2025) {
  const { data: installments, isLoading: loadingInstallments } = useRecurringInstallments({ year });
  const { data: contracts, isLoading: loadingContracts } = useRecurringContracts();
  const { data: minimumWage, isLoading: loadingMW } = useMinimumWageConfig(year);

  const isLoading = loadingInstallments || loadingContracts || loadingMW;

  const kpis = {
    totalClients: contracts?.length || 0,
    totalMinimumWagesMonthly: 0,
    totalMinimumWagesYearly: 0,
    expectedValueMonthly: 0,
    expectedValueYearly: 0,
    paidValue: 0,
    openValue: 0,
    overdueValue: 0,
    overdueClients: [] as { clientName: string; value: number; month: number }[],
    minimumWageValue: minimumWage?.[0]?.value || 1518,
  };

  if (contracts) {
    contracts.forEach((contract) => {
      const factor = contract.custom_minimum_wage_factor || contract.plan?.minimum_wage_factor || 1;
      kpis.totalMinimumWagesMonthly += factor;
    });
    kpis.totalMinimumWagesYearly = kpis.totalMinimumWagesMonthly * 12;
  }

  if (installments) {
    installments.forEach((inst) => {
      kpis.expectedValueYearly += Number(inst.expected_value);
      
      if (inst.status === 'PAGO') {
        kpis.paidValue += Number(inst.paid_value || inst.expected_value);
      } else if (inst.status === 'ATRASADO') {
        kpis.overdueValue += Number(inst.expected_value);
        kpis.overdueClients.push({
          clientName: inst.contract?.client?.name || 'N/A',
          value: Number(inst.expected_value),
          month: inst.competence_month,
        });
      } else {
        kpis.openValue += Number(inst.expected_value);
      }
    });

    // Calculate monthly expected (average per month)
    kpis.expectedValueMonthly = kpis.expectedValueYearly / 12;
  }

  return { kpis, isLoading };
}

// =============================================
// CREATE CONTRACT WITH AUTO-GENERATED INSTALLMENTS
// =============================================

export interface CreateContractInput {
  client_id: string;
  plan_id?: string;
  custom_minimum_wage_factor?: number;
  fixed_value?: number;
  start_date: string;
  end_date?: string;
  notes?: string;
  discount_type?: 'factor' | 'value' | 'percent';
  discount_amount?: number;
  discount_until?: string;
  discount_months?: number;
  default_account_id?: string;
  year?: number;
  dia_vencimento?: number;
  exigir_emissao_nf?: 'SEMPRE' | 'NUNCA' | 'PERGUNTAR';
  responsavel_id?: string | null;
}

export function useCreateContractWithInstallments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateContractInput) => {
      const year = input.year || new Date().getFullYear();
      
      // 1. Get minimum wage for the year AND previous year (for January rule)
      const { data: mwConfigs } = await supabase
        .from('minimum_wage_config')
        .select('year, value')
        .in('year', [year, year - 1])
        .order('year');
      
      const mwCurrentYear = mwConfigs?.find(m => m.year === year)?.value || 1518;
      const mwPreviousYear = mwConfigs?.find(m => m.year === year - 1)?.value || mwCurrentYear;

      // 2. Get plan details if plan_id is provided
      let planFactor = 1;
      let planName = 'Personalizado';
      if (input.plan_id) {
        const { data: plan } = await supabase
          .from('contract_plans')
          .select('*')
          .eq('id', input.plan_id)
          .single();
        
        if (plan) {
          planFactor = plan.minimum_wage_factor;
          planName = plan.name;
        }
      }

      // 3. Get client name for description
      const { data: client } = await supabase
        .from('recurring_clients')
        .select('name')
        .eq('id', input.client_id)
        .single();

      const clientName = client?.name || 'Cliente';

      // 4. Create the contract
      const { data: contract, error: contractError } = await supabase
        .from('recurring_contracts')
        .insert({
          client_id: input.client_id,
          plan_id: input.plan_id || null,
          custom_minimum_wage_factor: input.custom_minimum_wage_factor || null,
          start_date: input.start_date,
          end_date: input.end_date || null,
          notes: input.notes || null,
          active: true,
          dia_vencimento: input.dia_vencimento || 10,
          exigir_emissao_nf: input.exigir_emissao_nf || 'PERGUNTAR',
        })
        .select()
        .single();

      if (contractError) throw contractError;

      // 5. Determine factor to use
      const effectiveFactor = input.custom_minimum_wage_factor || planFactor;

      // 6. Generate installments for the year
      const installments = [];
      const startDate = parseLocalDate(input.start_date);
      const startMonth = startDate.getMonth() + 1;

      for (let month = startMonth; month <= 12; month++) {
        // January rule: use previous year's minimum wage
        const effectiveMW = month === 1 ? mwPreviousYear : mwCurrentYear;

        // Calculate value for this month
        let monthlyValue: number;
        
        if (input.fixed_value) {
          // Fixed R$ value mode
          monthlyValue = input.fixed_value;
        } else {
          // SM factor mode - apply effective MW per month
          monthlyValue = effectiveFactor * effectiveMW;
        }

        // Apply discount if applicable
        let discountApplies = false;
        const monthIndex = month - startMonth;
        
        if (input.discount_months && monthIndex < input.discount_months) {
          discountApplies = true;
        } else if (input.discount_until) {
          const discountEndDate = new Date(input.discount_until);
          const currentMonthDate = new Date(year, month - 1, 1);
          discountApplies = currentMonthDate <= discountEndDate;
        }

        if (discountApplies && input.discount_amount) {
          switch (input.discount_type) {
            case 'factor':
              // Reduce the SM factor
              monthlyValue = (effectiveFactor - input.discount_amount) * effectiveMW;
              break;
            case 'value':
              // Subtract fixed value
              monthlyValue -= input.discount_amount;
              break;
            case 'percent':
              // Apply percentage discount
              monthlyValue *= (1 - input.discount_amount / 100);
              break;
          }
        }

        // Due date: configurable day
        const dueDay = input.dia_vencimento || 10;
        const dueDate = new Date(year, month - 1, dueDay);

        installments.push({
          contract_id: contract.id,
          competence_month: month,
          competence_year: year,
          minimum_wage_value: effectiveMW,
          minimum_wage_factor: input.fixed_value ? 0 : effectiveFactor,
          expected_value: Math.max(0, monthlyValue),
          due_date: dueDate.toISOString().split('T')[0],
          status: 'EM_ABERTO',
        });
      }

      // 7. Insert all installments
      const { error: installmentsError } = await supabase
        .from('recurring_installments')
        .insert(installments);

      if (installmentsError) throw installmentsError;

      // 8. The trigger sync_installment_to_transaction will create transactions automatically
      // But let's ensure they have proper descriptions

      return {
        contract,
        installmentsCount: installments.length,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-installments'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success(`Contrato criado com ${result.installmentsCount} competências!`);
    },
    onError: (error: Error) => {
      console.error('Error creating contract:', error);
      toast.error('Erro ao criar contrato: ' + error.message);
    },
  });
}

// Create a client and contract together
export function useCreateClientWithContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      clientName: string;
      clientEmail?: string;
      clientPhone?: string;
      clientDocument?: string;
      plan_id?: string;
      custom_minimum_wage_factor?: number;
      fixed_value?: number;
      start_date: string;
      year?: number;
      dia_vencimento?: number;
      exigir_emissao_nf?: 'SEMPRE' | 'NUNCA' | 'PERGUNTAR';
      responsavel_id?: string | null;
    }) => {
      // 1. Create the client
      const { data: client, error: clientError } = await supabase
        .from('recurring_clients')
        .insert({
          name: input.clientName,
          email: input.clientEmail || null,
          phone: input.clientPhone || null,
          document: input.clientDocument || null,
          active: true,
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // 2. Now create the contract using the existing logic
      const year = input.year || new Date().getFullYear();
      
      const { data: mwConfig } = await supabase
        .from('minimum_wage_config')
        .select('value')
        .eq('year', year)
        .single();
      
      const minimumWageValue = mwConfig?.value || 1518;

      let planFactor = 1;
      if (input.plan_id) {
        const { data: plan } = await supabase
          .from('contract_plans')
          .select('*')
          .eq('id', input.plan_id)
          .single();
        if (plan) planFactor = plan.minimum_wage_factor;
      }

      const { data: contract, error: contractError } = await supabase
        .from('recurring_contracts')
        .insert({
          client_id: client.id,
          plan_id: input.plan_id || null,
          custom_minimum_wage_factor: input.custom_minimum_wage_factor || null,
          start_date: input.start_date,
          active: true,
          dia_vencimento: input.dia_vencimento || 10,
          exigir_emissao_nf: input.exigir_emissao_nf || 'PERGUNTAR',
        })
        .select()
        .single();

      if (contractError) throw contractError;

      const effectiveFactor = input.custom_minimum_wage_factor || planFactor;
      const startDate = parseLocalDate(input.start_date);
      const startMonth = startDate.getMonth() + 1;

      const installments = [];
      for (let month = startMonth; month <= 12; month++) {
        const monthlyValue = input.fixed_value || (effectiveFactor * minimumWageValue);
        const dueDay = input.dia_vencimento || 10;
        const dueDate = new Date(year, month - 1, dueDay);

        installments.push({
          contract_id: contract.id,
          competence_month: month,
          competence_year: year,
          minimum_wage_value: minimumWageValue,
          minimum_wage_factor: input.fixed_value ? 0 : effectiveFactor,
          expected_value: monthlyValue,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'EM_ABERTO',
        });
      }

      await supabase.from('recurring_installments').insert(installments);

      return { client, contract, installmentsCount: installments.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-clients'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-installments'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success(`Cliente "${result.client.name}" criado com contrato e ${result.installmentsCount} competências!`);
    },
    onError: (error: Error) => {
      console.error('Error creating client with contract:', error);
      toast.error('Erro ao criar cliente: ' + error.message);
    },
  });
}

// =============================================
// CANCEL / DELETE CONTRACT
// =============================================

export function useCancelContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contractId, deleteTransactions }: { contractId: string; deleteTransactions?: boolean }) => {
      // 1. Mark contract as inactive
      const { error: contractError } = await supabase
        .from('recurring_contracts')
        .update({ active: false })
        .eq('id', contractId);

      if (contractError) throw contractError;

      // 2. Cancel all non-paid installments
      const { data: openInstallments, error: fetchError } = await supabase
        .from('recurring_installments')
        .select('id')
        .eq('contract_id', contractId)
        .neq('status', 'PAGO');

      if (fetchError) throw fetchError;

      if (openInstallments && openInstallments.length > 0) {
        const installmentIds = openInstallments.map(i => i.id);

        // Delete related transactions for open installments
        if (deleteTransactions) {
          const { error: txError } = await supabase
            .from('transactions')
            .delete()
            .in('installment_id', installmentIds);

          if (txError) throw txError;
        }

        // Delete open installments
        const { error: deleteError } = await supabase
          .from('recurring_installments')
          .delete()
          .in('id', installmentIds);

        if (deleteError) throw deleteError;
      }

      return { cancelledInstallments: openInstallments?.length || 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-installments'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success(`Contrato cancelado! ${result.cancelledInstallments} parcela(s) em aberto removida(s).`);
    },
    onError: (error: Error) => {
      toast.error('Erro ao cancelar contrato: ' + error.message);
    },
  });
}

// =============================================
// CONTRACT PLANS CRUD
// =============================================

export function useCreateContractPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; minimum_wage_factor: number; description?: string }) => {
      const { data, error } = await supabase
        .from('contract_plans')
        .insert({
          name: input.name,
          minimum_wage_factor: input.minimum_wage_factor,
          description: input.description || null,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-plans'] });
      toast.success('Plano criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar plano: ' + error.message);
    },
  });
}

export function useUpdateContractPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; name?: string; minimum_wage_factor?: number; description?: string; active?: boolean }) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from('contract_plans')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-plans'] });
      toast.success('Plano atualizado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar plano: ' + error.message);
    },
  });
}
