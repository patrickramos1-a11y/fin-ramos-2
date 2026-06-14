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
  cliente_id: string | null;
  cost_center_id: string | null;
  entity_id: string | null;
  notes: string | null;
  review_status: 'PENDENTE' | 'REVISADO' | 'IGNORADO' | 'CONVERTIDO';
  usage_scope: 'EMPRESA' | 'PESSOAL' | 'DUVIDA';
  conversion_status: 'NAO_SELECIONADO' | 'PRONTO' | 'CONVERTIDO' | 'IGNORADO';
  transaction_id: string | null;
  converted_at: string | null;
  transaction_categories?: { id?: string; name: string; color?: string | null; default_account_id?: string | null; cost_center_id?: string | null } | null;
  accounts?: { id: string; name: string } | null;
  recurring_clients?: { id: string; name: string } | null;
  cost_centers?: { id: string; name: string } | null;
  financial_entities?: { id: string; name: string } | null;
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
        .select(`
          *,
          transaction_categories:transaction_category_id(id, name, color, default_account_id, cost_center_id),
          accounts:account_id(id, name),
          recurring_clients:cliente_id(id, name),
          cost_centers:cost_center_id(id, name),
          financial_entities:entity_id(id, name)
        `)
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
        usage_scope: 'DUVIDA',
        conversion_status: 'NAO_SELECIONADO',
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

export function useDeleteCreditCardInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { count, error: countError } = await (supabase as any)
        .from('credit_card_invoice_items')
        .select('id', { count: 'exact', head: true })
        .eq('invoice_id', invoiceId)
        .not('transaction_id', 'is', null);
      if (countError) throw countError;
      if ((count || 0) > 0) {
        throw new Error('Esta fatura possui itens já convertidos em transações. Remova ou revise essas transações antes de excluir a fatura.');
      }

      const { error } = await (supabase as any)
        .from('credit_card_invoices')
        .delete()
        .eq('id', invoiceId);
      if (error) throw error;
      return invoiceId;
    },
    onSuccess: async (invoiceId) => {
      await queryClient.invalidateQueries({ queryKey: ['credit-card-invoices'] });
      await queryClient.removeQueries({ queryKey: ['credit-card-invoice-items', invoiceId] });
      toast.success('Fatura excluída.');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir fatura: ' + (error?.message || ''));
    },
  });
}

export function useUpdateCreditCardItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreditCardInvoiceItem> }) => {
      const { data, error } = await (supabase as any)
        .from('credit_card_invoice_items')
        .update(normalizeItemUpdates(updates))
        .eq('id', id)
        .select('invoice_id')
        .single();
      if (error) throw error;
      return data as { invoice_id: string };
    },
    onSuccess: async (row) => {
      await queryClient.invalidateQueries({ queryKey: ['credit-card-invoice-items', row.invoice_id] });
      await queryClient.invalidateQueries({ queryKey: ['credit-card-invoices'] });
      toast.success('Item atualizado.');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar item: ' + (error?.message || ''));
    },
  });
}

export function useBulkUpdateCreditCardItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Record<string, unknown> }) => {
      const { data, error } = await (supabase as any)
        .from('credit_card_invoice_items')
        .update(normalizeItemUpdates({ ...updates, review_status: 'REVISADO' }))
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

export function useConvertCreditCardItemsToTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, itemIds }: { invoiceId: string; itemIds: string[] }) => {
      if (itemIds.length === 0) throw new Error('Selecione pelo menos um item para converter.');

      const { data: invoice, error: invoiceError } = await (supabase as any)
        .from('credit_card_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();
      if (invoiceError) throw invoiceError;

      const { data: items, error: itemsError } = await (supabase as any)
        .from('credit_card_invoice_items')
        .select(`
          *,
          transaction_categories:transaction_category_id(id, name, default_account_id, cost_center_id)
        `)
        .in('id', itemIds);
      if (itemsError) throw itemsError;

      const rows = (items || []) as CreditCardInvoiceItem[];
      const invalid = rows.filter(item =>
        item.usage_scope !== 'EMPRESA' ||
        item.conversion_status !== 'PRONTO' ||
        !!item.transaction_id ||
        !item.transaction_category_id ||
        !item.cliente_id
      );
      if (invalid.length > 0) {
        throw new Error('Existem itens sem marcação Empresa, sem status Pronto, já convertidos, sem categoria ou sem cliente.');
      }

      const transactionsToInsert = rows.map((item) => {
        const accountId = item.account_id || item.transaction_categories?.default_account_id || null;
        const costCenterId = item.cost_center_id || item.transaction_categories?.cost_center_id || null;
        if (!accountId) throw new Error(`Item "${item.description}" não possui conta definida nem conta padrão da categoria.`);
        if (!costCenterId) throw new Error(`Item "${item.description}" não possui centro de custo definido nem centro padrão da categoria.`);

        return {
          tipo_movimento: 'SAIDA',
          natureza: 'AVULSA',
          origem: 'IMPORTACAO',
          cliente_id: item.cliente_id,
          competencia_mes: invoice.competence_month,
          competencia_ano: invoice.competence_year,
          valor: Math.abs(Number(item.amount) || 0),
          data_vencimento: item.transaction_date || `${invoice.competence_year}-${String(invoice.competence_month).padStart(2, '0')}-01`,
          status: 'EM_ABERTO',
          descricao: item.description,
          transaction_category_id: item.transaction_category_id,
          account_id: accountId,
          cost_center_id: costCenterId,
          documento_tipo: 'SEM_DOCUMENTO',
          notes: [
            `Importado da fatura de cartão: ${invoice.invoice_label || invoice.file_name || 'Fatura'}`,
            `Cartão: ${item.card_name}${item.card_final_digits ? ` final ${item.card_final_digits}` : ''}`,
            item.installment ? `Parcela: ${item.installment}` : null,
          ].filter(Boolean).join('\n'),
          entity_id: item.entity_id,
          approval_status: 'pendente',
        };
      });

      const { data: created, error: createError } = await (supabase as any)
        .from('transactions')
        .insert(transactionsToInsert)
        .select('id');
      if (createError) throw createError;

      const createdRows = (created || []) as Array<{ id: string }>;
      for (let index = 0; index < rows.length; index += 1) {
        const transactionId = createdRows[index]?.id;
        if (!transactionId) continue;
        await (supabase as any)
          .from('credit_card_invoice_items')
          .update({
            transaction_id: transactionId,
            conversion_status: 'CONVERTIDO',
            review_status: 'CONVERTIDO',
            converted_at: new Date().toISOString(),
          })
          .eq('id', rows[index].id);

        await (supabase as any)
          .from('transaction_history')
          .insert({
            transaction_id: transactionId,
            evento: 'CRIADO',
            modulo_origem: 'CARTAO_CREDITO',
            user_id: 'system',
          });
      }

      return { invoiceId, count: createdRows.length };
    },
    onSuccess: async ({ invoiceId, count }) => {
      await queryClient.invalidateQueries({ queryKey: ['credit-card-invoice-items', invoiceId] });
      await queryClient.invalidateQueries({ queryKey: ['credit-card-invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['pending-approval-count'] });
      toast.success(`${count} transação(ões) criada(s) a partir do cartão.`);
    },
    onError: (error: any) => {
      toast.error('Erro ao converter cartão: ' + (error?.message || ''));
    },
  });
}

function normalizeItemUpdates(updates: Record<string, unknown>) {
  const next = { ...updates };
  if (next.usage_scope === 'PESSOAL') {
    next.conversion_status = 'IGNORADO';
  }
  if (next.conversion_status === 'IGNORADO') {
    next.review_status = 'IGNORADO';
  }
  if (next.conversion_status === 'PRONTO') {
    next.usage_scope = 'EMPRESA';
  }
  return next;
}
