import { Fragment, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  CreditCard,
  FileSpreadsheet,
  CheckCircle2,
  Search,
  Tags,
  Download,
  Pencil,
  Save,
  Trash2,
  Layers3,
  ArrowRightCircle,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Wand2,
  Eye,
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  parseCreditCardStatementFile,
  type CreditCardStatementCard,
  type ParsedCreditCardStatement,
} from '@/lib/credit-card-fatura-parser';
import {
  useBulkUpdateCreditCardItems,
  useCreateCreditCardPersonalCategory,
  useConvertCreditCardItemsToTransactions,
  useCreditCardProfiles,
  useCreditCardInvoiceItems,
  useCreditCardInvoices,
  useCreditCardMerchantRules,
  useCreditCardPersonalCategories,
  useDeleteCreditCardInvoice,
  useSaveCreditCardInvoice,
  useUpdateCreditCardInvoice,
  useUpsertCreditCardProfile,
  useUpsertCreditCardMerchantRules,
  buildCreditCardProfileKey,
  type CreditCardInvoice,
  type CreditCardInvoiceItem,
  type CreditCardMerchantRule,
  type CreditCardPersonalCategory,
  type CreditCardProfile,
} from '@/hooks/useCreditCardInvoices';
import { useAccounts, useTransactionCategories } from '@/hooks/useFinancialConfig';
import { useClients } from '@/hooks/useTransactions';
import { cn } from '@/lib/utils';

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const fmt = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type SortKey = 'date' | 'description' | 'card' | 'scope' | 'category' | 'client' | 'amount' | 'conversion';
type SortDirection = 'asc' | 'desc';
type CardWorkspaceTab = 'GERAL' | 'PESSOAL' | 'EMPRESA' | 'REEMBOLSOS' | 'FINANCEIRO';
type MerchantRule = {
  merchantKey: string;
  label: string;
  categoryId: string;
  usageScope: 'EMPRESA' | 'PESSOAL' | 'DUVIDA';
  updatedAt: string;
};

export function CreditCardInvoicesView() {
  const now = new Date();
  const [parsed, setParsed] = useState<ParsedCreditCardStatement | null>(null);
  const [fileName, setFileName] = useState('');
  const [invoiceName, setInvoiceName] = useState('');
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [invoiceSidebarCollapsed, setInvoiceSidebarCollapsed] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingInvoiceName, setEditingInvoiceName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedCardKeys, setSelectedCardKeys] = useState<Set<string>>(new Set());
  const [scopeFilter, setScopeFilter] = useState('ALL');
  const [conversionFilter, setConversionFilter] = useState('ALL');
  const [groupByMerchant, setGroupByMerchant] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<CardWorkspaceTab>('GERAL');
  const [collapsedMerchantGroups, setCollapsedMerchantGroups] = useState<Set<string>>(new Set());
  const [merchantRuleDialogItem, setMerchantRuleDialogItem] = useState<CreditCardInvoiceItem | null>(null);
  const [merchantRuleCategoryId, setMerchantRuleCategoryId] = useState('');
  const [merchantRuleScope, setMerchantRuleScope] = useState<'EMPRESA' | 'PESSOAL' | 'DUVIDA'>('EMPRESA');
  const [cardProfileDialog, setCardProfileDialog] = useState<{
    cardName: string;
    finalDigits: string | null;
    cardType: string | null;
    ownerName: string;
    usageScope: 'EMPRESA' | 'PESSOAL' | 'DUVIDA';
    color: string;
  } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [bulkPersonalCategoryId, setBulkPersonalCategoryId] = useState('');
  const [categoryAccountFilter, setCategoryAccountFilter] = useState('ALL');
  const [merchantRuleCategoryAccountFilter, setMerchantRuleCategoryAccountFilter] = useState('ALL');
  const [newPersonalCategoryName, setNewPersonalCategoryName] = useState('');
  const [newPersonalCategoryColor, setNewPersonalCategoryColor] = useState('#f59e0b');
  const [bulkScope, setBulkScope] = useState('');
  const [bulkConversionStatus, setBulkConversionStatus] = useState('');

  const { data: invoices = [] } = useCreditCardInvoices();
  const { data: items = [], isLoading: itemsLoading } = useCreditCardInvoiceItems(selectedInvoiceId);
  const { data: savedMerchantRules = [] } = useCreditCardMerchantRules();
  const { data: cardProfiles = [] } = useCreditCardProfiles();
  const { data: personalCategories = [] } = useCreditCardPersonalCategories();

  useEffect(() => {
    if (!selectedInvoiceId && invoices.length > 0) {
      setSelectedInvoiceId(invoices[0].id);
    }
  }, [invoices, selectedInvoiceId]);
  const { data: categories = [] } = useTransactionCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: clients = [] } = useClients();
  const saveInvoice = useSaveCreditCardInvoice();
  const updateInvoice = useUpdateCreditCardInvoice();
  const deleteInvoice = useDeleteCreditCardInvoice();
  const bulkUpdate = useBulkUpdateCreditCardItems();
  const convertItems = useConvertCreditCardItemsToTransactions();
  const upsertMerchantRules = useUpsertCreditCardMerchantRules();
  const upsertCardProfile = useUpsertCreditCardProfile();
  const createPersonalCategory = useCreateCreditCardPersonalCategory();

  const selectedParsedCards = useMemo<CreditCardStatementCard[]>(
    () => parsed ? parsed.cards.filter(card => selectedCards.has(card.id)) : [],
    [parsed, selectedCards],
  );

  const totalSelected = selectedParsedCards.reduce((sum, card) => sum + card.total, 0);
  const totalTx = selectedParsedCards.reduce((sum, card) => sum + card.transactions.length, 0);
  const ramosClient = useMemo(() => findRamosClient(clients as any[]), [clients]);
  const categoryById = useMemo(() => new Map((categories as any[]).map(category => [category.id, category])), [categories]);
  const expenseCategories = useMemo(
    () => (categories as any[]).filter(category => category.type === 'SAIDA' && category.active !== false),
    [categories],
  );
  const bulkExpenseCategories = useMemo(
    () => filterCategoriesByAccount(expenseCategories, categoryAccountFilter),
    [expenseCategories, categoryAccountFilter],
  );
  const merchantExpenseCategories = useMemo(
    () => filterCategoriesByAccount(expenseCategories, merchantRuleCategoryAccountFilter),
    [expenseCategories, merchantRuleCategoryAccountFilter],
  );
  const merchantRules = useMemo<MerchantRule[]>(
    () => (savedMerchantRules as CreditCardMerchantRule[]).map(rule => ({
      merchantKey: rule.merchant_key,
      label: rule.merchant_label,
      categoryId: rule.transaction_category_id,
      usageScope: rule.usage_scope,
      updatedAt: rule.updated_at,
    })),
    [savedMerchantRules],
  );
  const merchantRuleByKey = useMemo(
    () => new Map(merchantRules.map(rule => [rule.merchantKey, rule])),
    [merchantRules],
  );
  const cardProfileByKey = useMemo(
    () => new Map((cardProfiles as CreditCardProfile[]).map(profile => [profile.card_key, profile])),
    [cardProfiles],
  );

  const activeInvoice = invoices.find(invoice => invoice.id === selectedInvoiceId) || invoices[0] || null;
  const invoiceCards = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; count: number; profile?: CreditCardProfile }>();
    for (const item of items) {
      const key = cardKey(item);
      const current = map.get(key) || {
        key,
        label: cardLabel(item),
        total: 0,
        count: 0,
        profile: cardProfileByKey.get(key),
      };
      current.total += Number(item.amount) || 0;
      current.count += 1;
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [items, cardProfileByKey]);

  const invoiceStats = useMemo(() => {
    const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const reimbursementPending = items
      .filter(item => item.reimbursement_status === 'PENDENTE')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    return {
      total,
      empresa: items.filter(item => item.usage_scope === 'EMPRESA').length,
      pessoal: items.filter(item => item.usage_scope === 'PESSOAL').length,
      duvida: items.filter(item => item.usage_scope === 'DUVIDA').length,
      prontos: items.filter(isReadyToConvert).length,
      convertidos: items.filter(item => item.conversion_status === 'CONVERTIDO').length,
      pendentes: items.filter(item => item.conversion_status !== 'CONVERTIDO' && item.conversion_status !== 'IGNORADO').length,
      reimbursementPending,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const text = search.trim().toLowerCase();
    return items.filter(item => {
      if (selectedCardKeys.size > 0 && !selectedCardKeys.has(cardKey(item))) return false;
      if (workspaceTab === 'PESSOAL' && item.usage_scope !== 'PESSOAL') return false;
      if (workspaceTab === 'EMPRESA' && item.usage_scope !== 'EMPRESA') return false;
      if (workspaceTab === 'REEMBOLSOS' && item.reimbursement_status !== 'PENDENTE') return false;
      if (workspaceTab === 'FINANCEIRO' && !(item.usage_scope === 'EMPRESA' && item.conversion_status !== 'CONVERTIDO' && item.conversion_status !== 'IGNORADO')) return false;
      if (scopeFilter !== 'ALL' && item.usage_scope !== scopeFilter) return false;
      if (conversionFilter !== 'ALL' && item.conversion_status !== conversionFilter) return false;
      if (!text) return true;
      return (
        item.description.toLowerCase().includes(text) ||
        merchantLabel(item).toLowerCase().includes(text) ||
        item.card_name.toLowerCase().includes(text) ||
        item.category_hint?.toLowerCase().includes(text) ||
        item.transaction_categories?.name?.toLowerCase().includes(text) ||
        item.accounts?.name?.toLowerCase().includes(text) ||
        item.recurring_clients?.name?.toLowerCase().includes(text)
      );
    });
  }, [items, search, selectedCardKeys, scopeFilter, conversionFilter, workspaceTab]);

  const visibleItems = useMemo(
    () => sortItems(filteredItems, sortKey, sortDirection),
    [filteredItems, sortKey, sortDirection],
  );
  const groupedVisibleItems = useMemo(() => groupItemsByMerchant(visibleItems), [visibleItems]);
  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every(item => selectedItems.has(item.id));
  const selectedCardSummary = selectedCardKeys.size === 0
    ? 'Todos cartões'
    : `${selectedCardKeys.size} cartão(ões) selecionado(s)`;
  const suggestedItems = useMemo(
    () => visibleItems.filter(item => !item.transaction_category_id && merchantRuleByKey.has(merchantKey(item))),
    [visibleItems, merchantRuleByKey],
  );

  const readyItems = useMemo(() => items.filter(isReadyToConvert), [items]);
  const selectedReadyItems = useMemo(
    () => readyItems.filter(item => selectedItems.has(item.id)),
    [readyItems, selectedItems],
  );
  const previewItems = useMemo(
    () => sortItems(
      visibleItems.filter(item => item.usage_scope === 'EMPRESA' && item.conversion_status !== 'CONVERTIDO' && item.conversion_status !== 'IGNORADO'),
      'card',
      'asc',
    ),
    [visibleItems],
  );
  const previewGroups = useMemo(() => groupItemsByCard(previewItems), [previewItems]);
  const previewCategorySummary = useMemo(() => groupItemsByCategory(previewItems), [previewItems]);
  const categorySummary = useMemo(() => groupItemsByCategory(visibleItems), [visibleItems]);
  const workspaceInfo = useMemo(() => getWorkspaceTabInfo(workspaceTab, invoiceStats, readyItems.length), [workspaceTab, invoiceStats, readyItems.length]);

  const handleFile = async (file: File) => {
    try {
      const result = await parseCreditCardStatementFile(file);
      if (result.cards.length === 0) {
        toast.error('Nenhum cartão encontrado no arquivo.');
        return;
      }
      setParsed(result);
      setFileName(file.name);
      setInvoiceName(defaultInvoiceName(result, file.name, month, year));
      setSelectedCards(new Set(result.cards.map(card => card.id)));
      toast.success(`${result.cards.length} cartão(ões) detectado(s).`);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível ler a fatura. Verifique se é uma planilha Excel válida.');
    }
  };

  const saveCurrentInvoice = async () => {
    if (!parsed || selectedParsedCards.length === 0) return;
    const invoice = await saveInvoice.mutateAsync({
      parsed,
      selectedCards: selectedParsedCards,
      fileName,
      month,
      year,
      invoiceLabel: invoiceName.trim() || undefined,
    });
    setSelectedInvoiceId(invoice.id);
    setManagerOpen(true);
    setParsed(null);
    setFileName('');
    setInvoiceName('');
    setSelectedCards(new Set());
  };

  const toggleCard = (id: string) => {
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleVisibleItems = () => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleItems.forEach(item => next.delete(item.id));
      } else {
        visibleItems.forEach(item => next.add(item.id));
      }
      return next;
    });
  };

  const toggleMerchantGroup = (groupItems: CreditCardInvoiceItem[]) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      const allSelected = groupItems.every(item => next.has(item.id));
      groupItems.forEach(item => {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      });
      return next;
    });
  };

  const toggleMerchantGroupCollapse = (key: string) => {
    setCollapsedMerchantGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleInvoiceCard = (key: string) => {
    setSelectedCardKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const changeSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'amount' ? 'desc' : 'asc');
  };

  const toggleSavedInvoice = (id: string) => {
    setSelectedInvoiceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const beginEditInvoice = (invoice: CreditCardInvoice) => {
    setEditingInvoiceId(invoice.id);
    setEditingInvoiceName(displayInvoiceName(invoice));
  };

  const saveInvoiceName = () => {
    if (!editingInvoiceId) return;
    updateInvoice.mutate({
      id: editingInvoiceId,
      updates: { invoice_label: editingInvoiceName.trim() || null },
    }, {
      onSuccess: () => {
        setEditingInvoiceId(null);
        setEditingInvoiceName('');
      },
    });
  };

  const removeInvoice = (invoice: CreditCardInvoice) => {
    const ok = window.confirm(`Excluir a fatura "${displayInvoiceName(invoice)}"? Esta ação remove a fatura e seus itens ainda não convertidos.`);
    if (!ok) return;
    deleteInvoice.mutate(invoice.id, {
      onSuccess: () => {
        setSelectedInvoiceIds(prev => {
          const next = new Set(prev);
          next.delete(invoice.id);
          return next;
        });
        if (selectedInvoiceId === invoice.id) {
          setSelectedInvoiceId(null);
          setManagerOpen(false);
          setSelectedItems(new Set());
        }
      },
    });
  };

  const openInvoiceManager = (invoice: CreditCardInvoice) => {
    setSelectedInvoiceId(invoice.id);
    setManagerOpen(true);
    setSelectedItems(new Set());
    setSelectedCardKeys(new Set());
    setScopeFilter('ALL');
    setConversionFilter('ALL');
    setSearch('');
  };

  const openCardProfileDialog = (card: { label: string; key: string; profile?: CreditCardProfile }) => {
    const sample = items.find(item => cardKey(item) === card.key);
    const profile = card.profile || cardProfileByKey.get(card.key);
    setCardProfileDialog({
      cardName: sample?.card_name || profile?.card_name || card.label,
      finalDigits: sample?.card_final_digits || profile?.card_final_digits || null,
      cardType: sample?.card_type || profile?.card_type || null,
      ownerName: profile?.owner_name || '',
      usageScope: profile?.usage_scope || 'DUVIDA',
      color: profile?.color || '#10b981',
    });
  };

  const saveCardProfile = async (applyToCurrentInvoice = false) => {
    if (!cardProfileDialog) return;
    const profile = await upsertCardProfile.mutateAsync({
      card_name: cardProfileDialog.cardName,
      card_final_digits: cardProfileDialog.finalDigits,
      card_type: cardProfileDialog.cardType,
      owner_name: cardProfileDialog.ownerName || null,
      usage_scope: cardProfileDialog.usageScope,
      color: cardProfileDialog.color,
    });

    if (applyToCurrentInvoice) {
      const ids = items
        .filter(item => buildCreditCardProfileKey(item.card_name, item.card_final_digits) === profile.card_key)
        .map(item => item.id);
      if (ids.length > 0) {
        await bulkUpdate.mutateAsync({
          ids,
          updates: {
            usage_scope: profile.usage_scope,
            conversion_status: profile.usage_scope === 'PESSOAL' ? 'IGNORADO' : 'NAO_SELECIONADO',
          },
        });
      }
    }
    setCardProfileDialog(null);
  };
  const ignoreCurrentCardInInvoice = async () => {
    if (!cardProfileDialog) return;
    const targetKey = buildCreditCardProfileKey(cardProfileDialog.cardName, cardProfileDialog.finalDigits);
    const ids = items
      .filter(item => buildCreditCardProfileKey(item.card_name, item.card_final_digits) === targetKey)
      .map(item => item.id);
    if (ids.length === 0) return;
    await bulkUpdate.mutateAsync({
      ids,
      updates: {
        usage_scope: 'DUVIDA',
        conversion_status: 'IGNORADO',
        reimbursement_status: 'NAO_APLICA',
      },
    });
    setCardProfileDialog(null);
  };

  const exportParsedCards = () => {
    if (!parsed || selectedParsedCards.length === 0) return;
    exportRowsToExcel(
      selectedParsedCards.flatMap(card => card.transactions.map(tx => ({
        'Competência': `${months[month - 1]}/${year}`,
        'Fatura': invoiceName.trim() || defaultInvoiceName(parsed, fileName, month, year),
        'Arquivo': fileName,
        'Cartão': card.name,
        'Final': card.finalDigits,
        'Tipo do cartão': card.type,
        'Data': tx.date,
        'Descrição': tx.description,
        'Parcela': tx.installment || '',
        'Escopo': tx.scope,
        'País': tx.country || '',
        'Valor USD': tx.usdValue ?? '',
        'Câmbio': tx.fxRate ?? '',
        'Sugestão': tx.categoryHint || '',
        'Valor': tx.value,
      }))),
      `fatura-cartao-${year}-${String(month).padStart(2, '0')}`,
    );
  };

  const exportVisibleItems = () => {
    if (!activeInvoice || visibleItems.length === 0) return;
    exportSavedInvoiceRows(activeInvoice, visibleItems);
  };

  const exportSelectedItems = () => {
    if (!activeInvoice) return;
    const rows = visibleItems.filter(item => selectedItems.has(item.id));
    if (rows.length === 0) {
      toast.error('Selecione pelo menos uma linha da fatura para exportar.');
      return;
    }
    exportSavedInvoiceRows(activeInvoice, rows, `${slugFileName(displayInvoiceName(activeInvoice))}-selecionados`);
  };

  const exportSelectedSavedInvoices = () => {
    const ids = selectedInvoiceIds.size > 0 ? selectedInvoiceIds : new Set(activeInvoice ? [activeInvoice.id] : []);
    const selected = invoices.filter(invoice => ids.has(invoice.id));
    if (selected.length === 0) return;
    exportRowsToExcel(
      selected.map(invoice => ({
        'Fatura': displayInvoiceName(invoice),
        'Competência': `${months[invoice.competence_month - 1]}/${invoice.competence_year}`,
        'Arquivo': invoice.file_name || '',
        'Status': invoice.status,
        'Cartões': summarizeCards(invoice),
        'Lançamentos': invoice.total_transactions,
        'Total': Number(invoice.total_amount) || 0,
        'Criada em': new Date(invoice.created_at).toLocaleString('pt-BR'),
      })),
      'faturas-cartao-salvas',
    );
  };

  const applyBulkChanges = () => {
    if (selectedItems.size === 0) return;
    const updates: Record<string, unknown> = {};
    if (bulkCategoryId) {
      Object.assign(updates, buildCategoryUpdates(bulkCategoryId, categoryById, ramosClient));
      updates.personal_category_id = null;
    }
    if (bulkPersonalCategoryId) {
      updates.personal_category_id = bulkPersonalCategoryId;
      updates.usage_scope = 'PESSOAL';
      updates.conversion_status = 'IGNORADO';
    }
    if (bulkScope) {
      updates.usage_scope = bulkScope;
      if (bulkScope === 'EMPRESA') updates.personal_category_id = null;
    }
    if (bulkConversionStatus) updates.conversion_status = bulkConversionStatus;

    const shouldAttachRamos = bulkScope === 'EMPRESA' || bulkConversionStatus === 'PRONTO';
    if (shouldAttachRamos) {
      if (!ramosClient?.id) {
        toast.error('Cliente Ramos Engenharia não encontrado. Cadastre ou mantenha um cliente com "Ramos" no nome para converter itens empresariais.');
        return;
      }
      updates.cliente_id = ramosClient.id;
    }

    if (Object.keys(updates).length === 0) {
      toast.error('Escolha pelo menos uma alteração para aplicar.');
      return;
    }

    bulkUpdate.mutate({
      ids: Array.from(selectedItems),
      updates,
    }, {
      onSuccess: () => {
        setSelectedItems(new Set());
        setBulkCategoryId('');
        setBulkPersonalCategoryId('');
        setBulkScope('');
        setBulkConversionStatus('');
      },
    });
  };

  const createPersonalCategoryFromInput = async () => {
    const name = newPersonalCategoryName.trim();
    if (!name) {
      toast.error('Informe o nome da categoria pessoal.');
      return;
    }
    const category = await createPersonalCategory.mutateAsync({
      name,
      color: newPersonalCategoryColor,
    });
    setBulkPersonalCategoryId(category.id);
    setNewPersonalCategoryName('');
  };

  const saveMerchantPatternFromSelection = () => {
    if (selectedItems.size === 0) {
      toast.error('Selecione uma ou mais compras para salvar o padrão do estabelecimento.');
      return;
    }
    if (!bulkCategoryId) {
      toast.error('Escolha uma categoria para salvar como padrão.');
      return;
    }

    const selectedRows = items.filter(item => selectedItems.has(item.id));
    upsertMerchantRules.mutate(selectedRows.map(item => ({
      merchant_key: merchantKey(item),
      merchant_label: merchantLabel(item),
      transaction_category_id: bulkCategoryId,
      usage_scope: (bulkScope as 'EMPRESA' | 'PESSOAL' | 'DUVIDA') || 'EMPRESA',
    })));

    const updates = {
      ...buildCategoryUpdates(bulkCategoryId, categoryById, ramosClient),
      usage_scope: bulkScope || 'EMPRESA',
      conversion_status: bulkScope === 'PESSOAL' ? 'IGNORADO' : 'PRONTO',
    };
    bulkUpdate.mutate({
      ids: selectedRows.map(item => item.id),
      updates,
    }, {
      onSuccess: () => {
        toast.success(`${selectedRows.length} compra(s) atualizada(s) e padrão salvo.`);
        setSelectedItems(new Set());
        setBulkCategoryId('');
        setBulkScope('');
        setBulkConversionStatus('');
      },
    });
  };

  const requestReimbursementForSelected = () => {
    if (selectedItems.size === 0) return;
    if (!ramosClient?.id) {
      toast.error('Cliente Ramos Engenharia não encontrado. Cadastre ou mantenha um cliente com "Ramos" no nome para solicitar reembolso.');
      return;
    }
    bulkUpdate.mutate({
      ids: Array.from(selectedItems),
      updates: {
        usage_scope: 'EMPRESA',
        conversion_status: 'NAO_SELECIONADO',
        reimbursement_status: 'PENDENTE',
        cliente_id: ramosClient.id,
      },
    }, {
      onSuccess: () => {
        setSelectedItems(new Set());
        setWorkspaceTab('REEMBOLSOS');
      },
    });
  };
  const applySavedMerchantRules = async () => {
    if (suggestedItems.length === 0) {
      toast.info('Nenhum padrão salvo encontrado para os itens visíveis.');
      return;
    }

    const groups = new Map<string, { rule: MerchantRule; items: CreditCardInvoiceItem[] }>();
    suggestedItems.forEach(item => {
      const rule = merchantRuleByKey.get(merchantKey(item));
      if (!rule?.categoryId) return;
      const current = groups.get(rule.categoryId) || { rule, items: [] };
      current.items.push(item);
      groups.set(rule.categoryId, current);
    });

    try {
      await Promise.all(Array.from(groups.entries()).map(([categoryId, group]) => bulkUpdate.mutateAsync({
        ids: group.items.map(item => item.id),
        updates: {
          ...buildCategoryUpdates(categoryId, categoryById, ramosClient),
          usage_scope: group.rule.usageScope,
          conversion_status: group.rule.usageScope === 'PESSOAL' ? 'IGNORADO' : group.rule.usageScope === 'EMPRESA' ? 'PRONTO' : 'NAO_SELECIONADO',
        },
      })));
      setSelectedItems(new Set());
      toast.success(`${suggestedItems.length} compra(s) receberam padrões salvos.`);
    } catch (error: any) {
      toast.error('Erro ao aplicar padrões: ' + (error?.message || ''));
    }
  };

  const openMerchantRuleDialog = (item: CreditCardInvoiceItem) => {
    const rule = merchantRuleByKey.get(merchantKey(item));
    setMerchantRuleDialogItem(item);
    setMerchantRuleCategoryId(rule?.categoryId || item.transaction_category_id || '');
    setMerchantRuleScope(rule?.usageScope || item.usage_scope || 'EMPRESA');
  };

  const saveMerchantRuleFromDialog = () => {
    if (!merchantRuleDialogItem || !merchantRuleCategoryId) {
      toast.error('Escolha uma categoria para salvar o padrão.');
      return;
    }
    upsertMerchantRules.mutate([{
      merchant_key: merchantKey(merchantRuleDialogItem),
      merchant_label: merchantLabel(merchantRuleDialogItem),
      transaction_category_id: merchantRuleCategoryId,
      usage_scope: merchantRuleScope,
    }], {
      onSuccess: () => {
        bulkUpdate.mutate({
          ids: [merchantRuleDialogItem.id],
          updates: {
            ...buildCategoryUpdates(merchantRuleCategoryId, categoryById, ramosClient),
            usage_scope: merchantRuleScope,
            conversion_status: merchantRuleScope === 'PESSOAL' ? 'IGNORADO' : merchantRuleScope === 'EMPRESA' ? 'PRONTO' : 'NAO_SELECIONADO',
          },
        });
        setMerchantRuleDialogItem(null);
      },
    });
  };

  const convertSelectedItems = () => {
    if (!activeInvoice) return;
    const ids = selectedReadyItems.length > 0 ? selectedReadyItems.map(item => item.id) : readyItems.map(item => item.id);
    convertItems.mutate({ invoiceId: activeInvoice.id, itemIds: ids }, {
      onSuccess: () => setSelectedItems(new Set()),
    });
  };

  const renderInvoiceItemRow = (item: CreditCardInvoiceItem) => {
    const rule = merchantRuleByKey.get(merchantKey(item));
    const ruleCategory = rule ? categoryById.get(rule.categoryId) : null;

    return (
      <tr key={item.id} className={cn('text-xs', selectedItems.has(item.id) && 'bg-primary/5')}>
        <td className="px-2 py-1.5"><Checkbox checked={selectedItems.has(item.id)} onCheckedChange={() => toggleItem(item.id)} /></td>
        <td className="whitespace-nowrap px-2 py-1.5">{item.transaction_date ? new Date(`${item.transaction_date}T00:00:00`).toLocaleDateString('pt-BR') : '-'}</td>
        <td className="px-2 py-1.5">
          <p className="font-medium">{item.description}</p>
          <p className="text-xs text-muted-foreground">{item.installment || merchantLabel(item)}</p>
        </td>
        <td className="px-2 py-1.5">{item.card_name} {item.card_final_digits ? `• ${item.card_final_digits}` : ''}</td>
        <td className="px-2 py-1.5"><ScopeBadge scope={item.usage_scope} /></td>
        <td className="px-2 py-1.5">
          <div className="space-y-1">
            {item.usage_scope === 'PESSOAL' ? (
              <CategoryPill
                label={item.credit_card_personal_categories?.name || item.category_hint || 'Sem categoria pessoal'}
                color={item.credit_card_personal_categories?.color || '#f59e0b'}
                helper="Pessoal"
              />
            ) : (
              <CategoryPill
                label={item.transaction_categories?.name || item.category_hint || 'Sem categoria empresa'}
                color={item.transaction_categories?.color || '#ef4444'}
                helper={categoryMetaLabel(item.transaction_categories)}
              />
            )}
          </div>
          {ruleCategory && (
            <p className="mt-1 text-[10px] font-medium text-primary">Padrão: {ruleCategory.name}</p>
          )}
        </td>
        <td className="px-2 py-1.5">{item.transaction_categories?.name || <span className="text-muted-foreground">não vinculada</span>}</td>
        <td className="px-2 py-1.5">{item.recurring_clients?.name || ramosClient?.name || <span className="text-muted-foreground">Ramos automática</span>}</td>
        <td className="px-2 py-1.5">
          <p>{item.accounts?.name || item.transaction_categories?.default_account_id ? (item.accounts?.name || 'Pela categoria') : <span className="text-muted-foreground">sem conta</span>}</p>
          <p className="text-muted-foreground">{item.cost_centers?.name || item.transaction_categories?.cost_center_id ? (item.cost_centers?.name || 'Pela categoria') : 'sem centro'}</p>
        </td>
        <td className="px-2 py-1.5 text-right font-bold text-expense">{fmt(Number(item.amount) || 0)}</td>
        <td className="px-2 py-1.5">
          <div className="space-y-1">
            <ConversionBadge status={item.conversion_status} />
            {item.transaction_id && <p className="text-[10px] text-muted-foreground">Transação criada</p>}
          </div>
        </td>
        <td className="px-2 py-1.5 text-right">
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openMerchantRuleDialog(item)}>
            <BookmarkPlus className="h-3.5 w-3.5" />
          </Button>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {!managerOpen && (
        <Card className="border-primary/20 bg-gradient-to-r from-emerald-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Importar fatura de cartão
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <label
            className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-white/70 p-6 text-center transition hover:bg-primary/5"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
          >
            <input
              type="file"
              accept=".xls,.xlsx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Upload className="mb-3 h-8 w-8 text-primary" />
            <p className="font-semibold">Arraste a fatura Excel ou clique para selecionar</p>
            <p className="text-sm text-muted-foreground">A importação salva um bloco mensal para conferência. Ainda não converte em transações.</p>
          </label>

          <div className="rounded-2xl border bg-white p-4">
            <p className="mb-3 text-sm font-semibold">Competência da fatura</p>
            <div className="grid grid-cols-2 gap-2">
              <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((label, index) => (
                    <SelectItem key={label} value={String(index + 1)}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} />
            </div>
            <div className="mt-3">
              <p className="mb-2 text-sm font-semibold">Nome da fatura</p>
              <Input
                value={invoiceName}
                onChange={(event) => setInvoiceName(event.target.value)}
                placeholder="Ex: Inter Abril 2026, XP cartão Patrick..."
              />
              <p className="mt-1 text-xs text-muted-foreground">Você pode salvar mais de uma fatura no mesmo mês com nomes diferentes.</p>
            </div>
            <div className="mt-4 rounded-xl bg-muted/60 p-3 text-sm">
              <p className="text-muted-foreground">Arquivo</p>
              <p className="truncate font-medium">{fileName || 'Nenhum arquivo selecionado'}</p>
            </div>
            <Button className="mt-4 w-full" onClick={saveCurrentInvoice} disabled={!parsed || selectedParsedCards.length === 0 || saveInvoice.isPending}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Salvar fatura para conferência
            </Button>
            <Button className="mt-2 w-full" variant="outline" onClick={exportParsedCards} disabled={!parsed || selectedParsedCards.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel processado
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {parsed && !managerOpen && (
        <Card className="border-primary/10 bg-gradient-to-r from-emerald-50/70 via-white to-white">
          <CardHeader>
            <CardTitle className="text-lg">Cartões detectados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {parsed.cards.map(card => {
                const checked = selectedCards.has(card.id);
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => toggleCard(card.id)}
                    className={cn(
                      'rounded-xl border p-4 text-left transition hover:border-primary/50',
                      checked && 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{card.name}</p>
                        <div className="mt-1 flex gap-2">
                          <Badge variant="secondary">final {card.finalDigits}</Badge>
                          <Badge variant="outline">{card.type}</Badge>
                        </div>
                      </div>
                      <Checkbox checked={checked} />
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                      <Mini label="Nacional" value={fmt(card.totalNacional)} />
                      <Mini label="Internac." value={fmt(card.totalInternacional)} />
                      <Mini label="Total" value={fmt(card.total)} strong />
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
              <CheckCircle2 className="mr-2 inline h-4 w-4 text-primary" />
              {selectedParsedCards.length} cartão(ões), {totalTx} lançamento(s), total {fmt(totalSelected)}.
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-lg">Faturas salvas</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Barra horizontal minimizável: selecione faturas, exporte resumos e abra uma fatura para gerenciar a planilha.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setInvoiceSidebarCollapsed(prev => !prev)}>
                  {invoiceSidebarCollapsed ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronUp className="mr-2 h-4 w-4" />}
                  {invoiceSidebarCollapsed ? 'Mostrar faturas' : 'Minimizar'}
                </Button>
                <Button size="sm" variant="outline" onClick={exportSelectedSavedInvoices} disabled={invoices.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar selecionadas
                </Button>
              </div>
            </div>
          </CardHeader>
          {!invoiceSidebarCollapsed && (
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma fatura salva ainda.</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {invoices.map(invoice => {
                    const active = (selectedInvoiceId || activeInvoice?.id) === invoice.id;
                    return (
                      <div
                        key={invoice.id}
                        className={cn('min-w-[220px] rounded-xl border bg-card p-2.5 hover:bg-muted/50', active && 'border-primary bg-primary/5')}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Checkbox
                            checked={selectedInvoiceIds.has(invoice.id)}
                            onCheckedChange={() => toggleSavedInvoice(invoice.id)}
                            className="mt-1"
                          />
                          <div className="flex flex-1 items-start justify-between gap-1">
                            <button type="button" onClick={() => openInvoiceManager(invoice)} className="min-w-0 flex-1 text-left">
                              <p className="truncate font-semibold">{displayInvoiceName(invoice)}</p>
                              <p className="text-xs text-muted-foreground">{months[invoice.competence_month - 1]}/{invoice.competence_year}</p>
                            </button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => beginEditInvoice(invoice)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeInvoice(invoice)} disabled={deleteInvoice.isPending}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {editingInvoiceId === invoice.id ? (
                          <div className="mt-2 flex gap-2">
                            <Input value={editingInvoiceName} onChange={(event) => setEditingInvoiceName(event.target.value)} autoFocus className="h-8" />
                            <Button size="icon" className="h-8 w-8" onClick={saveInvoiceName} disabled={updateInvoice.isPending}>
                              <Save className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-2 truncate text-xs text-muted-foreground">{invoice.file_name || invoice.invoice_label || 'Fatura'}</p>
                        )}
                        <div className="mt-2 flex items-end justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold">{fmt(Number(invoice.total_amount) || 0)}</p>
                            <p className="text-xs text-muted-foreground">
                              {invoice.total_transactions} lanç. • {Array.isArray(invoice.selected_cards) ? invoice.selected_cards.length : 0} cartões
                            </p>
                          </div>
                          <Badge variant="outline">{invoice.status}</Badge>
                        </div>
                        <Button className="mt-2 w-full" size="sm" variant={managerOpen && active ? 'default' : 'outline'} onClick={() => openInvoiceManager(invoice)}>
                          Gerenciar
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Tags className="h-5 w-5" />
                  Gerenciamento da fatura
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {managerOpen && activeInvoice ? displayInvoiceName(activeInvoice) : 'Abra uma fatura salva para revisar cartões e lançamentos.'}
                </p>
              </div>
              {managerOpen && activeInvoice && (
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                  <Mini label="Total" value={fmt(invoiceStats.total)} strong />
                  <Mini label="Empresa" value={String(invoiceStats.empresa)} />
                  <Mini label="Pessoal" value={String(invoiceStats.pessoal)} />
                  <Mini label="Prontos" value={String(invoiceStats.prontos)} strong />
                  <Mini label="Reembolso" value={fmt(invoiceStats.reimbursementPending)} strong />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!managerOpen || !activeInvoice ? (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
                <CreditCard className="mb-3 h-10 w-10 text-primary" />
                <p className="text-lg font-semibold">Abra uma fatura para gerenciar</p>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  A faixa horizontal acima serve para selecionar faturas e exportar resumos. Para revisar cartões separados,
                  classificar despesas da empresa ou pessoais e preparar transações, clique em Gerenciar fatura.
                </p>
              </div>
            ) : (
              <>
            {invoiceCards.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setSelectedCardKeys(new Set())}
                  className={cn('rounded-xl border p-3 text-left transition hover:border-primary/50', selectedCardKeys.size === 0 && 'border-primary bg-primary/5')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">Todos os cartões</p>
                    <Checkbox checked={selectedCardKeys.size === 0} />
                  </div>
                  <p className="text-xs text-muted-foreground">{items.length} lançamento(s)</p>
                  <p className="mt-2 text-sm font-bold">{fmt(invoiceStats.total)}</p>
                </button>
                {invoiceCards.map(card => (
                  <div
                    key={card.key}
                    className={cn('rounded-xl border p-3 text-left transition hover:border-primary/50', selectedCardKeys.has(card.key) && 'border-primary bg-primary/5')}
                  >
                    <button type="button" onClick={() => toggleInvoiceCard(card.key)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-semibold">{card.label}</p>
                        <Checkbox checked={selectedCardKeys.has(card.key)} />
                      </div>
                      <p className="text-xs text-muted-foreground">{card.count} lançamento(s)</p>
                      <p className="mt-2 text-sm font-bold">{fmt(card.total)}</p>
                    </button>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <CardProfileBadge profile={card.profile} />
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openCardProfileDialog(card)}>
                        <Pencil className="mr-1 h-3 w-3" />
                        Cartão
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-2 rounded-2xl border bg-muted/20 p-2 md:grid-cols-5">
              <Button variant={workspaceTab === 'GERAL' ? 'default' : 'ghost'} onClick={() => setWorkspaceTab('GERAL')} className="justify-start">
                <Layers3 className="mr-2 h-4 w-4" />
                Geral
              </Button>
              <Button variant={workspaceTab === 'PESSOAL' ? 'default' : 'ghost'} onClick={() => setWorkspaceTab('PESSOAL')} className="justify-start">
                <CreditCard className="mr-2 h-4 w-4" />
                Pessoal
              </Button>
              <Button variant={workspaceTab === 'EMPRESA' ? 'default' : 'ghost'} onClick={() => setWorkspaceTab('EMPRESA')} className="justify-start">
                <Tags className="mr-2 h-4 w-4" />
                Empresa
              </Button>
              <Button variant={workspaceTab === 'REEMBOLSOS' ? 'default' : 'ghost'} onClick={() => setWorkspaceTab('REEMBOLSOS')} className="justify-start">
                <ArrowRightCircle className="mr-2 h-4 w-4" />
                Reembolsos
              </Button>
              <Button variant={workspaceTab === 'FINANCEIRO' ? 'default' : 'ghost'} onClick={() => setWorkspaceTab('FINANCEIRO')} className="justify-start">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Financeiro
              </Button>
            </div>

            {workspaceTab === 'GERAL' && (
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className={cn('rounded-2xl border p-5', workspaceInfo.className)}>
                  <p className="text-lg font-semibold">{workspaceInfo.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{workspaceInfo.description}</p>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <Mini label="Total da fatura" value={fmt(invoiceStats.total)} strong />
                    <Mini label="Empresa" value={String(invoiceStats.empresa)} />
                    <Mini label="Pessoal" value={String(invoiceStats.pessoal)} />
                    <Mini label="Reembolsos" value={fmt(invoiceStats.reimbursementPending)} strong />
                  </div>
                </div>
                <div className="rounded-2xl border bg-card p-5">
                  <p className="font-semibold">Como trabalhar esta fatura</p>
                  <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                    <p><strong className="text-foreground">Pessoal:</strong> organize compras pessoais e solicite reembolso somente quando a compra for da empresa.</p>
                    <p><strong className="text-foreground">Empresa:</strong> classifique despesas empresariais com categoria da empresa.</p>
                    <p><strong className="text-foreground">Reembolsos:</strong> acompanhe o que saiu de cartão pessoal e precisa ser validado.</p>
                    <p><strong className="text-foreground">Financeiro:</strong> etapa final para converter apenas itens prontos em transações.</p>
                  </div>
                </div>
              </div>
            )}

            {workspaceTab !== 'FINANCEIRO' && workspaceTab !== 'GERAL' ? (
              <>
            <div className="grid gap-2 lg:grid-cols-[1fr_repeat(4,180px)]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar descrição, cartão, sugestão ou categoria..." className="pl-9" />
              </div>
              <Select value={scopeFilter} onValueChange={setScopeFilter}>
                <SelectTrigger><SelectValue placeholder="Escopo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos escopos</SelectItem>
                  <SelectItem value="EMPRESA">Empresa</SelectItem>
                  <SelectItem value="PESSOAL">Pessoal</SelectItem>
                  <SelectItem value="DUVIDA">Dúvida</SelectItem>
                </SelectContent>
              </Select>
              <Select value={conversionFilter} onValueChange={setConversionFilter}>
                <SelectTrigger><SelectValue placeholder="Conversão" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos status</SelectItem>
                  <SelectItem value="NAO_SELECIONADO">Não selecionado</SelectItem>
                  <SelectItem value="PRONTO">Pronto</SelectItem>
                  <SelectItem value="CONVERTIDO">Convertido</SelectItem>
                  <SelectItem value="IGNORADO">Ignorado</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={groupByMerchant ? 'default' : 'outline'}
                onClick={() => setGroupByMerchant(prev => !prev)}
              >
                <Layers3 className="mr-2 h-4 w-4" />
                Agrupar
              </Button>
              <div className="flex items-center rounded-md border bg-background px-3 text-xs text-muted-foreground">
                {selectedCardSummary}
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Layers3 className="h-4 w-4" />
                  Ações em massa ({selectedItems.size} selecionado(s))
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={applySavedMerchantRules} disabled={suggestedItems.length === 0 || bulkUpdate.isPending}>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Aplicar padrões ({suggestedItems.length})
                  </Button>
                  <Button variant="outline" onClick={saveMerchantPatternFromSelection} disabled={selectedItems.size === 0 || !bulkCategoryId || bulkUpdate.isPending}>
                    <BookmarkPlus className="mr-2 h-4 w-4" />
                    Salvar padrão
                  </Button>
                  {workspaceTab === 'PESSOAL' && (
                    <Button variant="outline" onClick={requestReimbursementForSelected} disabled={selectedItems.size === 0 || bulkUpdate.isPending}>
                      Solicitar reembolso
                    </Button>
                  )}
                  <Button onClick={applyBulkChanges} disabled={selectedItems.size === 0 || bulkUpdate.isPending}>
                    Aplicar alterações
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <Select value={bulkScope} onValueChange={setBulkScope}>
                  <SelectTrigger><SelectValue placeholder="Empresa / Pessoal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPRESA">Marcar Empresa</SelectItem>
                    <SelectItem value="PESSOAL">Marcar Pessoal</SelectItem>
                    <SelectItem value="DUVIDA">Marcar Dúvida</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={bulkConversionStatus} onValueChange={setBulkConversionStatus}>
                  <SelectTrigger><SelectValue placeholder="Status conversão" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NAO_SELECIONADO">Não selecionado</SelectItem>
                    <SelectItem value="PRONTO">Pronto para converter</SelectItem>
                    <SelectItem value="IGNORADO">Ignorar</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryAccountFilter} onValueChange={setCategoryAccountFilter}>
                  <SelectTrigger><SelectValue placeholder="Filtrar por conta" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas as contas</SelectItem>
                    <SelectItem value="NONE">Sem conta padrão</SelectItem>
                    {(accounts as any[]).map(account => (
                      <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Categoria da empresa" /></SelectTrigger>
                  <SelectContent>
                    {bulkExpenseCategories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        <CategorySelectLabel category={category} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={bulkPersonalCategoryId} onValueChange={setBulkPersonalCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Categoria pessoal" /></SelectTrigger>
                  <SelectContent>
                    {(personalCategories as CreditCardPersonalCategory[]).map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                          {category.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="rounded-lg border bg-white px-3 py-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Regra automática</p>
                  <p>Empresa: conta e centro vêm da categoria. Pessoal: organiza a fatura e não vira transação.</p>
                </div>
                <Button variant="outline" onClick={exportVisibleItems} disabled={!activeInvoice || visibleItems.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar visão atual
                </Button>
                <Button variant="outline" onClick={exportSelectedItems} disabled={!activeInvoice || selectedItems.size === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar selecionados
                </Button>
              </div>
              {workspaceTab === 'PESSOAL' && (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
                  <p className="text-sm font-semibold text-amber-900">Categorias pessoais</p>
                  <p className="text-xs text-amber-800/80">
                    Use para organizar gastos pessoais sem criar lançamentos financeiros da empresa.
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-[1fr_140px_auto]">
                    <Input
                      value={newPersonalCategoryName}
                      onChange={(event) => setNewPersonalCategoryName(event.target.value)}
                      placeholder="Ex: Zenilda, Dodge, Viagens pessoais, Casa..."
                    />
                    <Input
                      type="color"
                      value={newPersonalCategoryColor}
                      onChange={(event) => setNewPersonalCategoryColor(event.target.value)}
                      className="h-10"
                    />
                    <Button onClick={createPersonalCategoryFromInput} disabled={createPersonalCategory.isPending}>
                      Criar categoria pessoal
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {categorySummary.length > 0 && (
              <div className="rounded-2xl border bg-card p-3">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">Resumo gerencial da fatura</p>
                    <p className="text-xs text-muted-foreground">
                      Totais da visão atual para conferir pessoal, empresa e possíveis reembolsos antes da conversão.
                    </p>
                  </div>
                  <Badge variant="outline">{categorySummary.length} grupo(s)</Badge>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {categorySummary.slice(0, 8).map(group => (
                    <div key={group.key} className="rounded-xl border bg-muted/20 p-3">
                      <p className="truncate text-sm font-semibold">{group.label}</p>
                      <p className="text-xs text-muted-foreground">{group.count} lançamento(s)</p>
                      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                        <span>Empresa</span>
                        <span className="text-right font-semibold text-primary">{fmt(group.empresa)}</span>
                        <span>Pessoal</span>
                        <span className="text-right font-semibold">{fmt(group.pessoal)}</span>
                        <span>Reembolso</span>
                        <span className="text-right font-semibold text-amber-600">{fmt(group.reembolso)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-auto rounded-xl border">
              <table className="w-full min-w-[1180px] text-xs">
                <thead className="bg-muted/60 text-xs">
                  <tr>
                    <th className="w-10 px-2 py-2">
                      <Checkbox checked={allVisibleSelected} onCheckedChange={toggleVisibleItems} />
                    </th>
                    <th className="px-2 py-2 text-left"><SortHeader label="Data" sortKey="date" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-2 py-2 text-left"><SortHeader label="Descrição" sortKey="description" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-2 py-2 text-left"><SortHeader label="Cartão" sortKey="card" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-2 py-2 text-left"><SortHeader label="Uso" sortKey="scope" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-2 py-2 text-left">Sugestão</th>
                    <th className="px-2 py-2 text-left"><SortHeader label="Categoria" sortKey="category" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-2 py-2 text-left"><SortHeader label="Cliente" sortKey="client" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-2 py-2 text-left">Conta / C. Custo</th>
                    <th className="px-2 py-2 text-right"><SortHeader label="Valor" sortKey="amount" activeKey={sortKey} direction={sortDirection} onSort={changeSort} align="right" /></th>
                    <th className="px-2 py-2 text-left"><SortHeader label="Conversão" sortKey="conversion" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-2 py-2 text-right">Padrão</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itemsLoading ? (
                    <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
                  ) : visibleItems.length === 0 ? (
                    <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">Nenhum lançamento para exibir.</td></tr>
                  ) : groupByMerchant ? groupedVisibleItems.map(group => (
                    <Fragment key={group.key}>
                      <tr className="bg-emerald-50/70">
                        <td className="px-2 py-2">
                          <Checkbox
                            checked={group.items.every(item => selectedItems.has(item.id))}
                            onCheckedChange={() => toggleMerchantGroup(group.items)}
                          />
                        </td>
                        <td colSpan={7} className="px-2 py-2">
                          <button type="button" className="flex items-center gap-2 text-left" onClick={() => toggleMerchantGroupCollapse(group.key)}>
                            {collapsedMerchantGroups.has(group.key) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <span>
                              <span className="block font-semibold">{group.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {group.items.length} lançamento(s) • {uniqueCardCount(group.items)} cartão(ões)
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="px-2 py-2 text-xs text-muted-foreground">{selectedCardSummary}</td>
                        <td className="px-2 py-2 text-right font-bold text-expense">{fmt(group.total)}</td>
                        <td className="px-2 py-2 text-xs text-muted-foreground">Grupo</td>
                        <td className="px-2 py-2 text-right">
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openMerchantRuleDialog(group.items[0])}>
                            <BookmarkPlus className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                      {!collapsedMerchantGroups.has(group.key) && group.items.map(renderInvoiceItemRow)}
                    </Fragment>
                  )) : visibleItems.map(renderInvoiceItemRow)}
                </tbody>
              </table>
            </div>
              </>
            ) : workspaceTab === 'FINANCEIRO' ? (
              <PreviewTransactionsPanel
                groups={previewGroups}
                categorySummary={previewCategorySummary}
                readyItems={readyItems}
                selectedReadyItems={selectedReadyItems}
                selectedItems={selectedItems}
                onToggleItem={toggleItem}
                onConvert={convertSelectedItems}
                isConverting={convertItems.isPending}
              />
            ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!merchantRuleDialogItem} onOpenChange={(open) => !open && setMerchantRuleDialogItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar padrão do estabelecimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="text-sm font-semibold">{merchantRuleDialogItem ? merchantLabel(merchantRuleDialogItem) : ''}</p>
              <p className="text-xs text-muted-foreground">
                Quando esse estabelecimento aparecer novamente, o sistema poderá aplicar a categoria e o uso automaticamente.
              </p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Filtrar categoria por conta</p>
              <Select value={merchantRuleCategoryAccountFilter} onValueChange={setMerchantRuleCategoryAccountFilter}>
                <SelectTrigger><SelectValue placeholder="Todas as contas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as contas</SelectItem>
                  <SelectItem value="NONE">Sem conta padrão</SelectItem>
                  {(accounts as any[]).map(account => (
                    <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Categoria padrão</p>
              <Select value={merchantRuleCategoryId} onValueChange={setMerchantRuleCategoryId}>
                <SelectTrigger><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                <SelectContent>
                  {merchantExpenseCategories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      <CategorySelectLabel category={category} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Uso padrão</p>
              <Select value={merchantRuleScope} onValueChange={(value) => setMerchantRuleScope(value as 'EMPRESA' | 'PESSOAL' | 'DUVIDA')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPRESA">Empresa</SelectItem>
                  <SelectItem value="PESSOAL">Pessoal</SelectItem>
                  <SelectItem value="DUVIDA">Dúvida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMerchantRuleDialogItem(null)}>Cancelar</Button>
              <Button onClick={saveMerchantRuleFromDialog} disabled={!merchantRuleCategoryId || upsertMerchantRules.isPending}>
                Salvar padrão
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cardProfileDialog} onOpenChange={(open) => !open && setCardProfileDialog(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl overflow-visible">
          <DialogHeader>
            <DialogTitle>Configurar cartão</DialogTitle>
          </DialogHeader>
          {cardProfileDialog && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/40 p-3">
                <p className="text-sm font-semibold">{cardProfileDialog.cardName}</p>
                <p className="text-xs text-muted-foreground">
                  Final {cardProfileDialog.finalDigits || 'não identificado'} · {cardProfileDialog.cardType || 'tipo não informado'}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">Dono / responsável</p>
                  <Input
                    value={cardProfileDialog.ownerName}
                    onChange={(event) => setCardProfileDialog(prev => prev ? { ...prev, ownerName: event.target.value } : prev)}
                    placeholder="Ex: Patrick, Zenilda, Ramos"
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Tipo do cartão</p>
                  <Select
                    value={cardProfileDialog.usageScope}
                    onValueChange={(value: 'EMPRESA' | 'PESSOAL' | 'DUVIDA') => {
                      setCardProfileDialog(prev => prev ? {
                        ...prev,
                        usageScope: value,
                        color: value === 'EMPRESA' ? '#10b981' : value === 'PESSOAL' ? '#f59e0b' : '#64748b',
                      } : prev);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPRESA">Empresa</SelectItem>
                      <SelectItem value="PESSOAL">Pessoal</SelectItem>
                      <SelectItem value="DUVIDA">Misto / classificar manualmente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                Essa configuração será usada nas próximas importações. Se aplicar na fatura atual, todos os itens desse cartão recebem a marcação escolhida agora.
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" className="w-full" onClick={() => setCardProfileDialog(null)}>Cancelar</Button>
                <Button variant="outline" className="w-full" onClick={ignoreCurrentCardInInvoice} disabled={bulkUpdate.isPending}>
                  Ignorar nesta fatura
                </Button>
                <Button variant="outline" className="w-full" onClick={() => saveCardProfile(false)} disabled={upsertCardProfile.isPending}>
                  Salvar para próximas faturas
                </Button>
                <Button className="w-full" onClick={() => saveCardProfile(true)} disabled={upsertCardProfile.isPending || bulkUpdate.isPending}>
                  Salvar e aplicar nesta fatura
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getWorkspaceTabInfo(tab: CardWorkspaceTab, stats: { total: number; empresa: number; pessoal: number; duvida: number; prontos: number; convertidos: number; pendentes: number; reimbursementPending: number }, readyCount: number) {
  if (tab === 'PESSOAL') {
    return {
      title: `Pessoal: ${stats.pessoal} item(ns) fora do financeiro`,
      description: 'Use esta área para organizar gastos pessoais. Se alguma compra pessoal for da empresa, selecione e use Solicitar reembolso.',
      className: 'border-amber-200 bg-amber-50/70',
    };
  }
  if (tab === 'EMPRESA') {
    return {
      title: `Empresa: ${stats.empresa} item(ns) para classificar`,
      description: 'Aqui ficam despesas empresariais. A categoria da empresa define conta e centro de custo antes do financeiro.',
      className: 'border-emerald-200 bg-emerald-50/70',
    };
  }
  if (tab === 'REEMBOLSOS') {
    return {
      title: `Reembolsos: ${fmt(stats.reimbursementPending)} pendente(s)`,
      description: 'Ponte entre gastos pessoais e financeiro: revise, aplique categoria empresarial e deixe pronto antes de converter.',
      className: 'border-orange-200 bg-orange-50/70',
    };
  }
  if (tab === 'FINANCEIRO') {
    return {
      title: `Financeiro: ${readyCount} item(ns) pronto(s) para converter`,
      description: 'Etapa final. Só converte itens empresariais com categoria, conta e centro de custo. Itens sem categoria ficam bloqueados.',
      className: 'border-primary/30 bg-primary/5',
    };
  }
  return {
    title: `Geral: ${stats.pendentes} item(ns) ainda em conferência`,
    description: 'Visão consolidada da fatura. Use as abas para separar pessoal, empresa, reembolso e financeiro sem misturar contextos.',
    className: 'border-slate-200 bg-slate-50/80',
  };
}
function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = activeKey === sortKey;
  const Icon = active ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn('inline-flex w-full items-center gap-1 text-xs font-semibold text-foreground hover:text-primary', align === 'right' && 'justify-end')}
    >
      {label}
      <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'text-muted-foreground')} />
    </button>
  );
}

function PreviewTransactionsPanel({
  groups,
  categorySummary,
  readyItems,
  selectedReadyItems,
  selectedItems,
  onToggleItem,
  onConvert,
  isConverting,
}: {
  groups: Array<{ key: string; label: string; total: number; items: CreditCardInvoiceItem[] }>;
  categorySummary: Array<{ key: string; label: string; total: number; count: number; empresa: number; pessoal: number; reembolso: number }>;
  readyItems: CreditCardInvoiceItem[];
  selectedReadyItems: CreditCardInvoiceItem[];
  selectedItems: Set<string>;
  onToggleItem: (id: string) => void;
  onConvert: () => void;
  isConverting: boolean;
}) {
  const totalPreview = groups.reduce((sum, group) => sum + group.total, 0);

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-emerald-50/70">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 font-semibold">
              <Eye className="h-4 w-4 text-primary" />
              Pré-lançamentos do cartão
            </p>
            <p className="text-sm text-muted-foreground">
              Revise aqui somente as compras empresariais que ainda não foram convertidas.
              {selectedReadyItems.length > 0 ? ` ${selectedReadyItems.length} pronta(s) selecionada(s).` : ' Sem seleção, converte todas as prontas.'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Mini label="Na prévia" value={String(groups.reduce((sum, group) => sum + group.items.length, 0))} strong />
            <Mini label="Prontas" value={String(readyItems.length)} strong />
            <Mini label="Total" value={fmt(totalPreview)} strong />
            <Button onClick={onConvert} disabled={readyItems.length === 0 || isConverting}>
              Converter para transações
            </Button>
          </div>
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          Nenhuma compra empresarial preparada ainda. Volte em Gerenciar, marque como Empresa, escolha a categoria e deixe como Pronto.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border bg-card p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-semibold">Resumo antes de converter</p>
                <p className="text-xs text-muted-foreground">Totais empresariais por categoria e valor que exige reembolso.</p>
              </div>
              <Badge variant="outline">{fmt(categorySummary.reduce((sum, group) => sum + group.reembolso, 0))} em reembolso</Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {categorySummary.slice(0, 8).map(group => (
                <div key={group.key} className="rounded-xl bg-muted/30 p-3">
                  <p className="truncate text-sm font-semibold">{group.label}</p>
                  <p className="text-xs text-muted-foreground">{group.count} item(ns)</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span>Empresa</span>
                    <strong className="text-primary">{fmt(group.empresa)}</strong>
                  </div>
                  {group.reembolso > 0 && (
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span>Reembolso</span>
                      <strong className="text-amber-600">{fmt(group.reembolso)}</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {groups.map(group => (
            <div key={group.key} className="overflow-hidden rounded-2xl border">
              <div className="flex flex-col gap-2 border-b bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{group.label}</p>
                  <p className="text-xs text-muted-foreground">{group.items.length} lançamento(s) neste cartão</p>
                </div>
                <p className="font-bold text-expense">{fmt(group.total)}</p>
              </div>
              <div className="divide-y">
                {group.items.map(item => (
                  <div key={item.id} className="grid gap-3 p-3 text-sm md:grid-cols-[36px_110px_1fr_180px_120px] md:items-center">
                    <Checkbox checked={selectedItems.has(item.id)} onCheckedChange={() => onToggleItem(item.id)} />
                    <span className="text-xs text-muted-foreground">
                      {item.transaction_date ? new Date(`${item.transaction_date}T00:00:00`).toLocaleDateString('pt-BR') : '-'}
                    </span>
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{merchantLabel(item)}</p>
                    </div>
                    <div className="text-xs">
                      <p>{item.transaction_categories?.name || 'Sem categoria'}</p>
                      <p className="text-muted-foreground">{item.accounts?.name || 'Conta pela categoria'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-expense">{fmt(Number(item.amount) || 0)}</p>
                      <ConversionBadge status={item.conversion_status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/60 p-2">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={cn('truncate text-xs', strong && 'font-bold text-primary')}>{value}</p>
    </div>
  );
}

function CategorySelectLabel({ category }: { category: any }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color || '#ef4444' }} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{category.name}</span>
        <span className="truncate text-[10px] text-muted-foreground">
          {categoryMetaLabel(category)}
          {category.default_account?.name ? ` · ${category.default_account.name}` : category.default_account_id ? ' · conta vinculada' : ' · sem conta'}
        </span>
      </span>
    </span>
  );
}

function CategoryPill({ label, color, helper }: { label: string; color?: string | null; helper?: string | null }) {
  return (
    <span className="inline-flex max-w-[220px] items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-xs">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color || '#64748b' }} />
      <span className="truncate font-medium">{label}</span>
      {helper && <span className="shrink-0 text-[10px] text-muted-foreground">{helper}</span>}
    </span>
  );
}

function categoryMetaLabel(category?: any | null) {
  if (!category) return '';
  const subtype = category.subtype ? String(category.subtype).toLowerCase() : 'despesa';
  const expenseType = category.expense_type ? String(category.expense_type).toLowerCase() : '';
  return [subtype, expenseType].filter(Boolean).join(' · ');
}

function filterCategoriesByAccount(categories: any[], accountId: string) {
  if (accountId === 'ALL') return categories;
  if (accountId === 'NONE') return categories.filter(category => !category.default_account_id);
  return categories.filter(category => category.default_account_id === accountId);
}

function defaultInvoiceName(parsed: ParsedCreditCardStatement, fileName: string, month: number, year: number) {
  const holder = parsed.meta.holder ? ` - ${parsed.meta.holder}` : '';
  const source = parsed.meta.invoice || fileName.replace(/\.(xlsx|xls)$/i, '') || 'Fatura';
  return `${source}${holder} - ${months[month - 1]}/${year}`;
}

function displayInvoiceName(invoice: CreditCardInvoice) {
  return invoice.invoice_label || invoice.file_name || `Fatura ${months[invoice.competence_month - 1]}/${invoice.competence_year}`;
}

function summarizeCards(invoice: CreditCardInvoice) {
  const cards = Array.isArray(invoice.selected_cards) ? invoice.selected_cards : [];
  return cards
    .map((card: any) => [card.name, card.finalDigits ? `final ${card.finalDigits}` : ''].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(', ');
}

function exportSavedInvoiceRows(invoice: CreditCardInvoice, rows: CreditCardInvoiceItem[], fileName?: string) {
  exportRowsToExcel(
    rows.map(item => ({
      'Fatura': displayInvoiceName(invoice),
      'Competência': `${months[invoice.competence_month - 1]}/${invoice.competence_year}`,
      'Data': item.transaction_date ? new Date(`${item.transaction_date}T00:00:00`).toLocaleDateString('pt-BR') : '',
      'Descrição': item.description,
      'Estabelecimento Normalizado': merchantLabel(item),
      'Cartão': item.card_name,
      'Final': item.card_final_digits || '',
      'Tipo do cartão': item.card_type || '',
      'Parcela': item.installment || '',
      'Escopo': item.scope,
      'País': item.country || '',
      'Valor USD': item.usd_value ?? '',
      'Câmbio': item.fx_rate ?? '',
      'Sugestão': item.category_hint || '',
      'Categoria': item.transaction_categories?.name || '',
      'Cliente': item.recurring_clients?.name || '',
      'Conta': item.accounts?.name || '',
      'Centro de Custo': item.cost_centers?.name || '',
      'Entidade': item.financial_entities?.name || '',
      'Uso': item.usage_scope,
      'Status de Conversão': item.conversion_status,
      'Reembolso': item.reimbursement_status || 'NAO_APLICA',
      'Status de Revisão': item.review_status,
      'Valor': Number(item.amount) || 0,
      'Observações': item.notes || '',
    })),
    fileName || slugFileName(displayInvoiceName(invoice)),
  );
}

function exportRowsToExcel(rows: Array<Record<string, unknown>>, baseFileName: string) {
  if (rows.length === 0) {
    toast.error('Não há dados para exportar.');
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fatura');
  XLSX.writeFile(workbook, `${slugFileName(baseFileName)}.xlsx`);
  toast.success('Excel gerado.');
}

function slugFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'fatura-cartao';
}

function cardKey(item: CreditCardInvoiceItem) {
  return `${item.card_name || 'Cartão'}:${item.card_final_digits || ''}:${item.card_type || ''}`;
}

function cardLabel(item: CreditCardInvoiceItem) {
  return [item.card_name, item.card_final_digits ? `final ${item.card_final_digits}` : null].filter(Boolean).join(' • ');
}

function merchantLabel(item: CreditCardInvoiceItem) {
  return normalizeMerchantName(item.normalized_description || item.description || 'Sem descrição');
}

function merchantKey(item: CreditCardInvoiceItem) {
  return merchantLabel(item)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeMerchantName(value: string) {
  return value
    .replace(/\b\d{1,2}\/\d{1,2}(\b|$)/g, '')
    .replace(/\bparc(ela)?\.?\s*\d+\s*(de|\/)\s*\d+\b/gi, '')
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toUpperCase();
}

function groupItemsByMerchant(items: CreditCardInvoiceItem[]) {
  const map = new Map<string, { key: string; label: string; total: number; items: CreditCardInvoiceItem[] }>();
  for (const item of items) {
    const label = merchantLabel(item);
    const key = label || 'SEM_DESCRICAO';
    const current = map.get(key) || { key, label: label || 'Sem descrição', total: 0, items: [] };
    current.total += Number(item.amount) || 0;
    current.items.push(item);
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

function groupItemsByCard(items: CreditCardInvoiceItem[]) {
  const map = new Map<string, { key: string; label: string; total: number; items: CreditCardInvoiceItem[] }>();
  for (const item of items) {
    const key = cardKey(item);
    const current = map.get(key) || { key, label: cardLabel(item), total: 0, items: [] };
    current.total += Number(item.amount) || 0;
    current.items.push(item);
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function groupItemsByCategory(items: CreditCardInvoiceItem[]) {
  const map = new Map<string, { key: string; label: string; total: number; count: number; empresa: number; pessoal: number; reembolso: number }>();
  for (const item of items) {
    const label = item.usage_scope === 'PESSOAL'
      ? item.credit_card_personal_categories?.name || item.category_hint || 'Sem categoria pessoal'
      : item.transaction_categories?.name || item.category_hint || 'Sem categoria empresa';
    const current = map.get(label) || { key: label, label, total: 0, count: 0, empresa: 0, pessoal: 0, reembolso: 0 };
    const amount = Number(item.amount) || 0;
    current.total += amount;
    current.count += 1;
    if (item.usage_scope === 'EMPRESA') current.empresa += amount;
    if (item.usage_scope === 'PESSOAL') current.pessoal += amount;
    if (item.reimbursement_status === 'PENDENTE') current.reembolso += amount;
    map.set(label, current);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

function uniqueCardCount(items: CreditCardInvoiceItem[]) {
  return new Set(items.map(cardKey)).size;
}

function sortItems(items: CreditCardInvoiceItem[], sortKey: SortKey, direction: SortDirection) {
  const factor = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => compareSortValue(a, b, sortKey) * factor);
}

function compareSortValue(a: CreditCardInvoiceItem, b: CreditCardInvoiceItem, sortKey: SortKey) {
  if (sortKey === 'amount') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
  const aValue = getSortValue(a, sortKey);
  const bValue = getSortValue(b, sortKey);
  return aValue.localeCompare(bValue, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

function getSortValue(item: CreditCardInvoiceItem, sortKey: SortKey) {
  if (sortKey === 'date') return item.transaction_date || '';
  if (sortKey === 'description') return item.description || '';
  if (sortKey === 'card') return cardLabel(item);
  if (sortKey === 'scope') return item.usage_scope || '';
  if (sortKey === 'category') return item.transaction_categories?.name || item.category_hint || '';
  if (sortKey === 'client') return item.recurring_clients?.name || '';
  if (sortKey === 'conversion') return item.conversion_status || '';
  return '';
}

function findRamosClient(clients: any[]) {
  return clients.find(client => /ramos engenharia/i.test(client.name || ''))
    || clients.find(client => /^ramos$/i.test(client.name || ''))
    || clients.find(client => /ramos/i.test(client.name || ''))
    || null;
}

function buildCategoryUpdates(categoryId: string, categoryById: Map<any, any>, ramosClient: any) {
  const category = categoryById.get(categoryId);
  const updates: Record<string, unknown> = { transaction_category_id: categoryId };
  if (category?.default_account_id) updates.account_id = category.default_account_id;
  if (category?.cost_center_id) updates.cost_center_id = category.cost_center_id;
  if (ramosClient?.id) updates.cliente_id = ramosClient.id;
  return updates;
}

function isReadyToConvert(item: CreditCardInvoiceItem) {
  return (
    item.usage_scope === 'EMPRESA' &&
    item.conversion_status === 'PRONTO' &&
    !item.transaction_id &&
    !!item.transaction_category_id &&
    !!(item.account_id || item.transaction_categories?.default_account_id) &&
    !!(item.cost_center_id || item.transaction_categories?.cost_center_id)
  );
}

function CardProfileBadge({ profile }: { profile?: CreditCardProfile }) {
  if (!profile) {
    return <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">Não configurado</Badge>;
  }
  const label = profile.usage_scope === 'EMPRESA' ? 'Cartão empresa' : profile.usage_scope === 'PESSOAL' ? 'Cartão pessoal' : 'Cartão misto';
  const className = profile.usage_scope === 'EMPRESA'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : profile.usage_scope === 'PESSOAL'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-50 text-slate-600';
  return (
    <div className="flex flex-col gap-1">
      <Badge variant="outline" className={className}>{label}</Badge>
      {profile.owner_name && <span className="text-[10px] text-muted-foreground">{profile.owner_name}</span>}
    </div>
  );
}

function ScopeBadge({ scope }: { scope: CreditCardInvoiceItem['usage_scope'] }) {
  const label = scope === 'EMPRESA' ? 'Empresa' : scope === 'PESSOAL' ? 'Pessoal' : 'Misto';
  const className = scope === 'EMPRESA'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : scope === 'PESSOAL'
      ? 'border-slate-200 bg-slate-50 text-slate-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function ConversionBadge({ status }: { status: CreditCardInvoiceItem['conversion_status'] }) {
  const normalized = status || 'NAO_SELECIONADO';
  const label = {
    NAO_SELECIONADO: 'Não selecionado',
    PRONTO: 'Pronto',
    CONVERTIDO: 'Convertido',
    IGNORADO: 'Ignorado',
  }[normalized];
  const className = normalized === 'PRONTO'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : normalized === 'CONVERTIDO'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : normalized === 'IGNORADO'
        ? 'border-slate-200 bg-slate-50 text-slate-700'
        : 'border-amber-200 bg-amber-50 text-amber-700';
  return <Badge variant="outline" className={className}>{label}</Badge>;
}
