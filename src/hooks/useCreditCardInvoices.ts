import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  brDateToISO,
  normalizeCardDescription,
  type CreditCardStatementCard,
  type ParsedCreditCardStatement,
} from '@/lib/credit-card-fatura-parser';

export type CreditCardInvoice = {
  id: string;
  competence_month: number;
  competence_year: number;
  file_name: string | null;
  holder: string | null;
  invoice_label: string | null;
  source_meta: Record<string, unknown>;
  selected_cards: Array<Record<string, unknown>>;
  total_amount: number;
  total_transactions: number;
  status: 'CONFERENCIA' | 'PRONTA' | 'CONVERTIDA' | 'ARQUIVADA';
  created_at: string;
  updated_at: string;
};

export type CreditCardInvoiceItem = {
  id: string;
  invoice_id: string;
  card_name: string;
  card_final_digits: string | null;
  card_type: string | null;
  transaction_date: string | null;
  description: string;
  normalized_description: string | null;
  installment: string | null;
  scope: 'nacional' | 'internacional';
  country: string | null;
  usd_value: number | null;
  fx_rate: number | null;
  amount: number;
  category_hint: string | null;
  transaction_category_id: string | null;
  account_id: string | null;
  entity_id: string | null;
  notes: string | null;
  review_status: 'PENDENTE' | 'REVISADO' | 'IGNORADO' | 'CONVERTIDO';
  transaction_categories?: { name: string; color?: string | null } | null;
};

export function useCreditCardInvoices() {
  return useQuery({
    queryKey: ['credit-card-invoices'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('credit_card_invoices')
        .select('*')
        .order('competence_year', { ascending: false })
        .order('competence_month', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as CreditCardInvoice[];
    },
  });
}

export function useCreditCardInvoiceItems(invoiceId?: string | null) {
  return useQuery({
    queryKey: ['credit-card-invoice-items', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('credit_card_invoice_items')
        .select('*, transaction_categories:transaction_category_id(name, color)')
        .eq('invoice_id', invoiceId)
        .order('transaction_date', { ascending: true })
        .order('description', { ascending: true });
      if (error) throw error;
      return (data || []) as CreditCardInvoiceItem[];
    },
  });
}

export function useSaveCreditCardInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      parsed,
      selectedCards,
      fileName,
      month,
      year,
      invoiceLabel,
    }: {
      parsed: ParsedCreditCardStatement;
      selectedCards: CreditCardStatementCard[];
      fileName: string;
      month: number;
      year: number;
      invoiceLabel?: string;
    }) => {
      const totalAmount = selectedCards.reduce((sum, card) => sum + card.total, 0);
      const totalTransactions = selectedCards.reduce((sum, card) => sum + card.transactions.length, 0);

      const { data: invoice, error: invoiceError } = await (supabase as any)
        .from('credit_card_invoices')
        .insert({
          competence_month: month,
          competence_year: year,
          file_name: fileName,
          holder: parsed.meta.holder || null,
          invoice_label: invoiceLabel || parsed.meta.invoice || null,
          source_meta: parsed.meta,
          selected_cards: selectedCards.map(card => ({
            name: card.name,
            finalDigits: card.finalDigits,
            type: card.type,
            total: card.total,
            totalNacional: card.totalNacional,
            totalInternacional: card.totalInternacional,
          })),
          total_amount: totalAmount,
          total_transactions: totalTransactions,
          status: 'CONFERENCIA',
        })
        .select('*')
        .single();

      if (invoiceError) throw invoiceError;

      const rows = selectedCards.flatMap(card => card.transactions.map(tx => ({
        invoice_id: invoice.id,
        card_name: card.name,
        card_final_digits: card.finalDigits,
        card_type: card.type,
        transaction_date: brDateToISO(tx.date, year),
        description: tx.description,
        normalized_description: normalizeCardDescription(tx.description),
        installment: tx.installment || null,
        scope: tx.scope,
        country: tx.country || null,
        usd_value: tx.usdValue ?? null,
        fx_rate: tx.fxRate ?? null,
        amount: tx.value,
        category_hint: tx.categoryHint || null,
        review_status: 'PENDENTE',
      })));

      if (rows.length > 0) {
        const { error: itemsError } = await (supabase as any)
          .from('credit_card_invoice_items')
          .insert(rows);
        if (itemsError) throw itemsError;
      }

      return invoice as CreditCardInvoice;
    },
    onSuccess: async (invoice) => {
      await queryClient.invalidateQueries({ queryKey: ['credit-card-invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['credit-card-invoice-items', invoice.id] });
      toast.success('Fatura salva para conferência.');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar fatura: ' + (error?.message || ''));
    },
  });
}

export function useUpdateCreditCardInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Pick<CreditCardInvoice, 'invoice_label' | 'status'>> }) => {
      const { data, error } = await (supabase as any)
        .from('credit_card_invoices')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as CreditCardInvoice;
    },
    onSuccess: async (invoice) => {
      await queryClient.invalidateQueries({ queryKey: ['credit-card-invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['credit-card-invoice-items', invoice.id] });
      toast.success('Fatura atualizada.');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar fatura: ' + (error?.message || ''));
    },
  });
}

export function useBulkUpdateCreditCardItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Record<string, unknown> }) => {
      const { data, error } = await (supabase as any)
        .from('credit_card_invoice_items')
        .update({ ...updates, review_status: 'REVISADO' })
        .in('id', ids)
        .select('invoice_id');
      if (error) throw error;
      return data as Array<{ invoice_id: string }>;
    },
    onSuccess: async (rows) => {
      await queryClient.invalidateQueries({ queryKey: ['credit-card-invoices'] });
      const invoiceIds = Array.from(new Set((rows || []).map(row => row.invoice_id)));
      await Promise.all(invoiceIds.map(id => queryClient.invalidateQueries({ queryKey: ['credit-card-invoice-items', id] })));
      toast.success('Lançamentos atualizados.');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar lançamentos: ' + (error?.message || ''));
    },
  });
}
