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
  personal_category_id?: string | null;
  account_id: string | null;
  cliente_id: string | null;
  cost_center_id: string | null;
        entity_id: string | null;
        notes: string | null;
        review_status: 'PENDENTE' | 'REVISADO' | 'IGNORADO' | 'CONVERTIDO';
  usage_scope?: 'EMPRESA' | 'PESSOAL' | 'DUVIDA';
  conversion_status?: 'NAO_SELECIONADO' | 'PRONTO' | 'CONVERTIDO' | 'IGNORADO';
  reimbursement_status?: 'NAO_APLICA' | 'PENDENTE' | 'REEMBOLSADO';
  reimbursement_notes?: string | null;
  transaction_id: string | null;
  converted_at: string | null;
  transaction_categories?: { id?: string; name: string; color?: string | null; subtype?: string | null; expense_type?: string | null; default_account_id?: string | null; cost_center_id?: string | null } | null;
  credit_card_personal_categories?: CreditCardPersonalCategory | null;
  accounts?: { id: string; name: string } | null;
  recurring_clients?: { id: string; name: string } | null;
  cost_centers?: { id: string; name: string } | null;
  financial_entities?: { id: string; name: string } | null;
};

export type CreditCardPersonalCategory = {
  id: string;
  name: string;
  color: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreditCardMerchantRule = {
  id: string;
  merchant_key: string;
  merchant_label: string;
  transaction_category_id: string;
  usage_scope: 'EMPRESA' | 'PESSOAL' | 'DUVIDA';
  active: boolean;
  created_at: string;
  updated_at: string;
  transaction_categories?: { id?: string; name: string; color?: string | null; default_account_id?: string | null; cost_center_id?: string | null } | null;
};

export type CreditCardProfile = {
  id: string;
  card_key: string;
  card_name: string;
  card_final_digits: string | null;
  card_type: string | null;
  owner_name: string | null;
  usage_scope: 'EMPRESA' | 'PESSOAL' | 'DUVIDA';
  color: string;
  active: boolean;
  created_at: string;
  updated_at: string;
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

export function useCreditCardProfiles() {
  return useQuery({
    queryKey: ['credit-card-profiles'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('credit_card_profiles')
        .select('*')
        .eq('active', true)
        .order('card_name', { ascending: true });
      if (error) {
        if (isMissingCardProfilesSchema(error)) return [] as CreditCardProfile[];
        throw error;
      }
      return (data || []) as CreditCardProfile[];
    },
  });
}

export function useUpsertCreditCardProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: {
      card_name: string;
      card_final_digits?: string | null;
      card_type?: string | null;
      owner_name?: string | null;
      usage_scope: 'EMPRESA' | 'PESSOAL' | 'DUVIDA';
      color?: string;
    }) => {
      const row = {
        ...profile,
        card_key: buildCreditCardProfileKey(profile.card_name, profile.card_final_digits || null),
        color: profile.color || (profile.usage_scope === 'PESSOAL' ? '#f59e0b' : profile.usage_scope === 'EMPRESA' ? '#10b981' : '#64748b'),
        active: true,
      };
      const { data, error } = await (supabase as any)
        .from('credit_card_profiles')
        .upsert(row, { onConflict: 'card_key' })
        .select('*')
        .single();
      if (error) {
        if (isMissingCardProfilesSchema(error)) {
          throw new Error('A tabela de configuração de cartões ainda não existe no Supabase. Aplique a migration credit_card_profiles_personal_company.');
        }
        throw error;
      }
      return data as CreditCardProfile;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credit-card-profiles'] });
      toast.success('Perfil do cartão salvo.');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar perfil do cartão: ' + (error?.message || ''));
    },
  });
}

export function useCreditCardMerchantRules() {
  return useQuery({
    queryKey: ['credit-card-merchant-rules'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('credit_card_merchant_rules')
        .select(`
          *,
          transaction_categories:transaction_category_id(id, name, color, default_account_id, cost_center_id)
        `)
        .eq('active', true)
        .order('merchant_label', { ascending: true });
      if (error) {
        if (isMissingMerchantRulesSchema(error)) return [] as CreditCardMerchantRule[];
        throw error;
      }
      return (data || []) as CreditCardMerchantRule[];
    },
  });
}

export function useCreditCardPersonalCategories() {
  return useQuery({
    queryKey: ['credit-card-personal-categories'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('credit_card_personal_categories')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });
      if (error) {
        if (isMissingPersonalCategoriesSchema(error)) return [] as CreditCardPersonalCategory[];
        throw error;
      }
      return (data || []) as CreditCardPersonalCategory[];
    },
  });
}

export function useCreateCreditCardPersonalCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }) => {
      const cleanName = name.trim();
      if (!cleanName) throw new Error('Informe o nome da categoria pessoal.');
      const { data, error } = await (supabase as any)
        .from('credit_card_personal_categories')
        .insert({ name: cleanName, color: color || '#f59e0b', active: true })
        .select('*')
        .single();
      if (error) {
        if (isMissingPersonalCategoriesSchema(error)) {
          throw new Error('A tabela de categorias pessoais do cartão ainda não existe no Supabase. Aplique a migration credit_card_personal_categories.');
        }
        throw error;
      }
      return data as CreditCardPersonalCategory;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credit-card-personal-categories'] });
      toast.success('Categoria pessoal criada.');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar categoria pessoal: ' + (error?.message || ''));
    },
  });
}

export function useUpsertCreditCardMerchantRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rules: Array<{
      merchant_key: string;
      merchant_label: string;
      transaction_category_id: string;
      usage_scope: 'EMPRESA' | 'PESSOAL' | 'DUVIDA';
    }>) => {
      const rows = rules.map(rule => ({ ...rule, active: true }));
      const { data, error } = await (supabase as any)
        .from('credit_card_merchant_rules')
        .upsert(rows, { onConflict: 'merchant_key' })
        .select('*');
      if (error) {
        if (isMissingMerchantRulesSchema(error)) {
          throw new Error('A tabela de padrões do cartão ainda não existe no Supabase. Aplique a migration credit_card_rules_reimbursement.');
        }
        throw error;
      }
      return (data || []) as CreditCardMerchantRule[];
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credit-card-merchant-rules'] });
      toast.success('Padrão de estabelecimento salvo.');
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar padrão: ' + (error?.message || ''));
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
          transaction_categories:transaction_category_id(id, name, color, subtype, expense_type, default_account_id, cost_center_id),
          credit_card_personal_categories:personal_category_id(id, name, color, active, created_at, updated_at),
          accounts:account_id(id, name),
          recurring_clients:cliente_id(id, name),
          cost_centers:cost_center_id(id, name),
          financial_entities:entity_id(id, name)
        `)
        .eq('invoice_id', invoiceId)
        .order('transaction_date', { ascending: true })
        .order('description', { ascending: true });
      if (error) {
        if (isMissingCreditCardWorkflowSchema(error)) {
          const { data: fallbackData, error: fallbackError } = await (supabase as any)
            .from('credit_card_invoice_items')
            .select('*, transaction_categories:transaction_category_id(id, name, color)')
            .eq('invoice_id', invoiceId)
            .order('transaction_date', { ascending: true })
            .order('description', { ascending: true });
          if (fallbackError) throw fallbackError;
          return normalizeFetchedItems(fallbackData || []);
        }
        throw error;
      }
      return normalizeFetchedItems(data || []);
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

      const { data: cardProfiles } = await (supabase as any)
        .from('credit_card_profiles')
        .select('*')
        .eq('active', true);
      const profileByCard = new Map(
        ((cardProfiles || []) as CreditCardProfile[]).map(profile => [profile.card_key, profile]),
      );

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
        usage_scope: profileByCard.get(buildCreditCardProfileKey(card.name, card.finalDigits))?.usage_scope || 'DUVIDA',
        conversion_status: profileByCard.get(buildCreditCardProfileKey(card.name, card.finalDigits))?.usage_scope === 'PESSOAL'
          ? 'IGNORADO'
          : 'NAO_SELECIONADO',
      })));

      if (rows.length > 0) {
        const { error: itemsError } = await (supabase as any)
          .from('credit_card_invoice_items')
          .insert(rows);
        if (itemsError) {
          if (!isMissingCreditCardWorkflowSchema(itemsError)) throw itemsError;
          const legacyRows = rows.map(({ usage_scope, conversion_status, ...row }) => row);
          const { error: legacyError } = await (supabase as any)
            .from('credit_card_invoice_items')
            .insert(legacyRows);
          if (legacyError) throw legacyError;
          toast.warning('Fatura salva no modo básico. Aplique a migration do Cartão para liberar gestão avançada e conversão.');
        }
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
      const normalizedUpdates = normalizeItemUpdates({ ...updates, review_status: 'REVISADO' });
      const { data, error } = await (supabase as any)
        .from('credit_card_invoice_items')
        .update(normalizedUpdates)
        .in('id', ids)
        .select('invoice_id');
      if (error) {
        if (!isMissingCreditCardWorkflowSchema(error)) throw error;

        const legacyUpdates = normalizeLegacyItemUpdates(normalizedUpdates);
        const { data: legacyData, error: legacyError } = await (supabase as any)
          .from('credit_card_invoice_items')
          .update(legacyUpdates)
          .in('id', ids)
          .select('invoice_id');
        if (legacyError) throw legacyError;
        toast.warning('Atualização salva no modo básico. Aplique a migration do Cartão para liberar Empresa/Pessoal, Pronto e conversão completa.');
        return legacyData as Array<{ invoice_id: string }>;
      }
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
        !item.transaction_category_id
      );
      if (invalid.length > 0) {
        throw new Error('Existem itens sem marcação Empresa, sem status Pronto, já convertidos ou sem categoria.');
      }

      const { data: ramosClient, error: clientError } = await (supabase as any)
        .from('recurring_clients')
        .select('id, name')
        .ilike('name', '%ramos%')
        .limit(1)
        .maybeSingle();
      if (clientError) throw clientError;
      if (!ramosClient?.id) {
        throw new Error('Cliente Ramos Engenharia não encontrado. Cadastre um cliente com "Ramos" no nome para converter itens do cartão.');
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
          cliente_id: item.cliente_id || ramosClient.id,
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
            isPersonalCard(item) ? 'Reembolso pendente: gasto empresarial em cartão pessoal.' : null,
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
            reimbursement_status: isPersonalCard(rows[index]) ? 'PENDENTE' : 'NAO_APLICA',
            reimbursement_notes: isPersonalCard(rows[index])
              ? 'Despesa empresarial importada de cartão pessoal. Controlar reembolso ao titular.'
              : null,
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
    delete next.transaction_category_id;
    delete next.account_id;
    delete next.cost_center_id;
    delete next.cliente_id;
  }
  if (next.usage_scope === 'EMPRESA') {
    delete next.personal_category_id;
  }
  if (next.conversion_status === 'IGNORADO') {
    next.review_status = 'IGNORADO';
  }
  if (next.conversion_status === 'PRONTO') {
    next.usage_scope = 'EMPRESA';
    delete next.personal_category_id;
  }
  return next;
}

function normalizeLegacyItemUpdates(updates: Record<string, unknown>) {
  const next = { ...updates };
  delete next.usage_scope;
  delete next.conversion_status;
  delete next.cliente_id;
  delete next.cost_center_id;
  delete next.transaction_id;
  delete next.converted_at;
  delete next.reimbursement_status;
  delete next.reimbursement_notes;
  delete next.personal_category_id;

  if (updates.usage_scope === 'PESSOAL' || updates.conversion_status === 'IGNORADO') {
    next.review_status = 'IGNORADO';
  } else if (updates.conversion_status === 'PRONTO') {
    next.review_status = 'REVISADO';
  }

  return next;
}

function normalizeFetchedItems(items: any[]): CreditCardInvoiceItem[] {
  return items.map(item => ({
    ...item,
    usage_scope: item.usage_scope || 'DUVIDA',
    conversion_status: item.conversion_status || (
      item.review_status === 'CONVERTIDO' ? 'CONVERTIDO' :
        item.review_status === 'IGNORADO' ? 'IGNORADO' :
          'NAO_SELECIONADO'
    ),
    cliente_id: item.cliente_id || null,
    cost_center_id: item.cost_center_id || item.transaction_categories?.cost_center_id || null,
    personal_category_id: item.personal_category_id || null,
    credit_card_personal_categories: item.credit_card_personal_categories || null,
    transaction_id: item.transaction_id || null,
    converted_at: item.converted_at || null,
    reimbursement_status: item.reimbursement_status || 'NAO_APLICA',
    reimbursement_notes: item.reimbursement_notes || null,
  })) as CreditCardInvoiceItem[];
}

function isMissingCreditCardWorkflowSchema(error: any) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return /conversion_status|usage_scope|cliente_id|cost_center_id|converted_at|reimbursement_status|reimbursement_notes|personal_category_id|credit_card_personal_categories|schema cache/i.test(message);
}

function isMissingMerchantRulesSchema(error: any) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return /credit_card_merchant_rules|schema cache/i.test(message);
}

function isMissingCardProfilesSchema(error: any) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return /credit_card_profiles|schema cache/i.test(message);
}

function isMissingPersonalCategoriesSchema(error: any) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  return /credit_card_personal_categories|personal_category_id|schema cache/i.test(message);
}

export function buildCreditCardProfileKey(cardName: string, finalDigits?: string | null) {
  return `${normalizeCardDescription(cardName || 'cartao')}::${finalDigits || 'sem-final'}`;
}

function isPersonalCard(item: CreditCardInvoiceItem) {
  return item.usage_scope === 'EMPRESA' && /pessoal|titular|patrick|zenilda|gabi|darley/i.test(`${item.card_name || ''} ${item.card_type || ''}`);
}
