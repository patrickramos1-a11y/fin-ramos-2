import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PlannedFrequency =
  | 'AVULSA'
  | 'SEMANAL'
  | 'QUINZENAL'
  | 'MENSAL'
  | 'TRIMESTRAL'
  | 'ANUAL'
  | 'CUSTOM';

export type PlannedStatus = 'ATIVO' | 'PAUSADO' | 'ENCERRADO';
export type OccurrenceStatus = 'PLANEJADA' | 'EXECUTADA' | 'ATRASADA' | 'CANCELADA';

export interface PlannedTransfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  description: string | null;
  notes: string | null;
  frequency: PlannedFrequency;
  interval_days: number | null;
  start_date: string;
  end_date: string | null;
  due_day: number | null;
  status: PlannedStatus;
  created_at: string;
  updated_at: string;
}

export interface PlannedOccurrence {
  id: string;
  planned_transfer_id: string;
  scheduled_date: string;
  expected_amount: number;
  status: OccurrenceStatus;
  executed_transfer_id: string | null;
  executed_at: string | null;
  notes: string | null;
}

export interface PlannedTransferWithOccurrences extends PlannedTransfer {
  occurrences: PlannedOccurrence[];
  next_occurrence?: PlannedOccurrence;
  total_planned_in_period?: number;
}

const today = () => new Date().toISOString().slice(0, 10);

export function usePlannedTransfers() {
  return useQuery({
    queryKey: ['planned-transfers'],
    queryFn: async (): Promise<PlannedTransferWithOccurrences[]> => {
      const [{ data: pts, error: e1 }, { data: occs, error: e2 }] = await Promise.all([
        supabase
          .from('planned_transfers' as any)
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('planned_transfer_occurrences' as any)
          .select('*')
          .order('scheduled_date', { ascending: true }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const now = today();
      const occByPt = new Map<string, PlannedOccurrence[]>();
      (occs || []).forEach((o: any) => {
        const list = occByPt.get(o.planned_transfer_id) || [];
        list.push(o as PlannedOccurrence);
        occByPt.set(o.planned_transfer_id, list);
      });

      return (pts || []).map((p: any) => {
        const list = occByPt.get(p.id) || [];
        const next = list.find(
          (o) => o.status === 'PLANEJADA' && o.scheduled_date >= now,
        );
        return {
          ...p,
          amount: Number(p.amount),
          occurrences: list,
          next_occurrence: next,
        } as PlannedTransferWithOccurrences;
      });
    },
    staleTime: 30_000,
  });
}

export function usePlannedOccurrencesInRange(start: string, end: string) {
  return useQuery({
    queryKey: ['planned-occurrences', start, end],
    queryFn: async (): Promise<PlannedOccurrence[]> => {
      const { data, error } = await supabase
        .from('planned_transfer_occurrences' as any)
        .select('*')
        .gte('scheduled_date', start)
        .lte('scheduled_date', end)
        .order('scheduled_date');
      if (error) throw error;
      return (data || []) as unknown as PlannedOccurrence[];
    },
    staleTime: 30_000,
  });
}

interface CreateInput {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  description?: string;
  notes?: string;
  frequency: PlannedFrequency;
  interval_days?: number | null;
  start_date: string;
  end_date?: string | null;
  due_day?: number | null;
}

export function useCreatePlannedTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInput) => {
      const { data, error } = await supabase
        .from('planned_transfers' as any)
        .insert({
          from_account_id: input.from_account_id,
          to_account_id: input.to_account_id,
          amount: input.amount,
          description: input.description ?? null,
          notes: input.notes ?? null,
          frequency: input.frequency,
          interval_days: input.interval_days ?? null,
          start_date: input.start_date,
          end_date: input.end_date ?? null,
          due_day: input.due_day ?? 10,
          status: 'ATIVO',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planned-transfers'] });
      qc.invalidateQueries({ queryKey: ['planned-occurrences'] });
      qc.invalidateQueries({ queryKey: ['account-transfers'] });
      toast.success('Transferência planejada criada');
    },
    onError: (e: any) => toast.error('Erro ao criar', { description: e.message }),
  });
}

export function useUpdatePlannedTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<CreateInput> & { status?: PlannedStatus }) => {
      const { error } = await supabase.from('planned_transfers' as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planned-transfers'] });
      qc.invalidateQueries({ queryKey: ['planned-occurrences'] });
      toast.success('Atualizada');
    },
    onError: (e: any) => toast.error('Erro ao atualizar', { description: e.message }),
  });
}

export function useDeletePlannedTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('planned_transfers' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planned-transfers'] });
      toast.success('Removida');
    },
  });
}

export function useExecuteOccurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      occurrence_id,
      real_date,
      amount,
    }: {
      occurrence_id: string;
      real_date?: string;
      amount?: number;
    }) => {
      const { data, error } = await supabase.rpc('execute_planned_occurrence' as any, {
        p_occurrence_id: occurrence_id,
        p_real_date: real_date ?? null,
        p_amount: amount ?? null,
        p_user: null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planned-transfers'] });
      qc.invalidateQueries({ queryKey: ['planned-occurrences'] });
      qc.invalidateQueries({ queryKey: ['account-transfers'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['accounts-snapshot'] });
      qc.invalidateQueries({ queryKey: ['accounts-evolution'] });
      qc.invalidateQueries({ queryKey: ['account-detail'] });
      qc.invalidateQueries({ queryKey: ['account-annual'] });
      qc.invalidateQueries({ queryKey: ['account-forecast'] });
      toast.success('Transferência executada');
    },
    onError: (e: any) => toast.error('Erro ao executar', { description: e.message }),
  });
}

export function useUpdateOccurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      status?: OccurrenceStatus;
      expected_amount?: number;
      scheduled_date?: string;
      notes?: string;
    }) => {
      const { error } = await supabase.from('planned_transfer_occurrences' as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planned-transfers'] });
      qc.invalidateQueries({ queryKey: ['planned-occurrences'] });
    },
  });
}
