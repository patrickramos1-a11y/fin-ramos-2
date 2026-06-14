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
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Wand2,
  Eye,
  BookmarkPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  parseCreditCardStatementFile,
  type CreditCardStatementCard,
  type ParsedCreditCardStatement,
} from '@/lib/credit-card-fatura-parser';
import {
  useBulkUpdateCreditCardItems,
  useConvertCreditCardItemsToTransactions,
  useCreditCardInvoiceItems,
  useCreditCardInvoices,
  useDeleteCreditCardInvoice,
  useSaveCreditCardInvoice,
  useUpdateCreditCardInvoice,
  type CreditCardInvoice,
  type CreditCardInvoiceItem,
} from '@/hooks/useCreditCardInvoices';
import { useTransactionCategories } from '@/hooks/useFinancialConfig';
import { useClients } from '@/hooks/useTransactions';
import { cn } from '@/lib/utils';

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const fmt = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MERCHANT_RULES_STORAGE_KEY = 'fin-ramos-credit-card-merchant-rules-v1';

type SortKey = 'date' | 'description' | 'card' | 'scope' | 'category' | 'client' | 'amount' | 'conversion';
type SortDirection = 'asc' | 'desc';
type WorkflowStep = 'manage' | 'preview';
type MerchantRule = {
  merchantKey: string;
  label: string;
  categoryId: string;
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
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('manage');
  const [merchantRules, setMerchantRules] = useState<MerchantRule[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [bulkScope, setBulkScope] = useState('');
  const [bulkConversionStatus, setBulkConversionStatus] = useState('');

  const { data: invoices = [] } = useCreditCardInvoices();
  const { data: items = [], isLoading: itemsLoading } = useCreditCardInvoiceItems(selectedInvoiceId);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MERCHANT_RULES_STORAGE_KEY);
      if (raw) setMerchantRules(JSON.parse(raw));
    } catch (error) {
      console.warn('Erro ao carregar regras de estabelecimento do cartão', error);
    }
  }, []);

  useEffect(() => {
    if (!selectedInvoiceId && invoices.length > 0) {
      setSelectedInvoiceId(invoices[0].id);
    }
  }, [invoices, selectedInvoiceId]);
  const { data: categories = [] } = useTransactionCategories();
  const { data: clients = [] } = useClients();
  const saveInvoice = useSaveCreditCardInvoice();
  const updateInvoice = useUpdateCreditCardInvoice();
  const deleteInvoice = useDeleteCreditCardInvoice();
  const bulkUpdate = useBulkUpdateCreditCardItems();
  const convertItems = useConvertCreditCardItemsToTransactions();

  const selectedParsedCards = useMemo<CreditCardStatementCard[]>(
    () => parsed ? parsed.cards.filter(card => selectedCards.has(card.id)) : [],
    [parsed, selectedCards],
  );

  const totalSelected = selectedParsedCards.reduce((sum, card) => sum + card.total, 0);
  const totalTx = selectedParsedCards.reduce((sum, card) => sum + card.transactions.length, 0);
  const ramosClient = useMemo(() => findRamosClient(clients as any[]), [clients]);
  const categoryById = useMemo(() => new Map((categories as any[]).map(category => [category.id, category])), [categories]);
  const merchantRuleByKey = useMemo(
    () => new Map(merchantRules.map(rule => [rule.merchantKey, rule])),
    [merchantRules],
  );

  const activeInvoice = invoices.find(invoice => invoice.id === selectedInvoiceId) || invoices[0] || null;
  const invoiceCards = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; count: number }>();
    for (const item of items) {
      const key = cardKey(item);
      const current = map.get(key) || { key, label: cardLabel(item), total: 0, count: 0 };
      current.total += Number(item.amount) || 0;
      current.count += 1;
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  const invoiceStats = useMemo(() => {
    const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    return {
      total,
      empresa: items.filter(item => item.usage_scope === 'EMPRESA').length,
      pessoal: items.filter(item => item.usage_scope === 'PESSOAL').length,
      duvida: items.filter(item => item.usage_scope === 'DUVIDA').length,
      prontos: items.filter(isReadyToConvert).length,
      convertidos: items.filter(item => item.conversion_status === 'CONVERTIDO').length,
      pendentes: items.filter(item => item.conversion_status !== 'CONVERTIDO' && item.conversion_status !== 'IGNORADO').length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const text = search.trim().toLowerCase();
    return items.filter(item => {
      if (selectedCardKeys.size > 0 && !selectedCardKeys.has(cardKey(item))) return false;
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
  }, [items, search, selectedCardKeys, scopeFilter, conversionFilter]);

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
    }
    if (bulkScope) updates.usage_scope = bulkScope;
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
        setBulkScope('');
        setBulkConversionStatus('');
      },
    });
  };

  const persistMerchantRules = (rules: MerchantRule[]) => {
    setMerchantRules(rules);
    window.localStorage.setItem(MERCHANT_RULES_STORAGE_KEY, JSON.stringify(rules));
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
    const nextByKey = new Map(merchantRules.map(rule => [rule.merchantKey, rule]));
    selectedRows.forEach(item => {
      nextByKey.set(merchantKey(item), {
        merchantKey: merchantKey(item),
        label: merchantLabel(item),
        categoryId: bulkCategoryId,
        updatedAt: new Date().toISOString(),
      });
    });
    persistMerchantRules(Array.from(nextByKey.values()).sort((a, b) => a.label.localeCompare(b.label)));

    const updates = {
      ...buildCategoryUpdates(bulkCategoryId, categoryById, ramosClient),
      usage_scope: 'EMPRESA',
      conversion_status: 'PRONTO',
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

  const applySavedMerchantRules = async () => {
    if (suggestedItems.length === 0) {
      toast.info('Nenhum padrão salvo encontrado para os itens visíveis.');
      return;
    }

    const groups = new Map<string, CreditCardInvoiceItem[]>();
    suggestedItems.forEach(item => {
      const rule = merchantRuleByKey.get(merchantKey(item));
      if (!rule?.categoryId) return;
      const current = groups.get(rule.categoryId) || [];
      current.push(item);
      groups.set(rule.categoryId, current);
    });

    try {
      await Promise.all(Array.from(groups.entries()).map(([categoryId, groupItems]) => bulkUpdate.mutateAsync({
        ids: groupItems.map(item => item.id),
        updates: {
          ...buildCategoryUpdates(categoryId, categoryById, ramosClient),
          usage_scope: 'EMPRESA',
          conversion_status: 'PRONTO',
        },
      })));
      setSelectedItems(new Set());
      toast.success(`${suggestedItems.length} compra(s) receberam padrões salvos.`);
    } catch (error: any) {
      toast.error('Erro ao aplicar padrões: ' + (error?.message || ''));
    }
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
      <tr key={item.id} className={selectedItems.has(item.id) ? 'bg-primary/5' : ''}>
        <td className="p-3"><Checkbox checked={selectedItems.has(item.id)} onCheckedChange={() => toggleItem(item.id)} /></td>
        <td className="whitespace-nowrap p-3">{item.transaction_date ? new Date(`${item.transaction_date}T00:00:00`).toLocaleDateString('pt-BR') : '-'}</td>
        <td className="p-3">
          <p className="font-medium">{item.description}</p>
          <p className="text-xs text-muted-foreground">{item.installment || merchantLabel(item)}</p>
        </td>
        <td className="p-3 text-xs">{item.card_name} {item.card_final_digits ? `• ${item.card_final_digits}` : ''}</td>
        <td className="p-3"><ScopeBadge scope={item.usage_scope} /></td>
        <td className="p-3">
          <Badge variant="secondary">{item.category_hint || 'Outros'}</Badge>
          {ruleCategory && (
            <p className="mt-1 text-[10px] font-medium text-primary">Padrão: {ruleCategory.name}</p>
          )}
        </td>
        <td className="p-3 text-xs">{item.transaction_categories?.name || <span className="text-muted-foreground">não vinculada</span>}</td>
        <td className="p-3 text-xs">{item.recurring_clients?.name || ramosClient?.name || <span className="text-muted-foreground">Ramos automática</span>}</td>
        <td className="p-3 text-xs">
          <p>{item.accounts?.name || item.transaction_categories?.default_account_id ? (item.accounts?.name || 'Pela categoria') : <span className="text-muted-foreground">sem conta</span>}</p>
          <p className="text-muted-foreground">{item.cost_centers?.name || item.transaction_categories?.cost_center_id ? (item.cost_centers?.name || 'Pela categoria') : 'sem centro'}</p>
        </td>
        <td className="p-3 text-right font-bold text-expense">{fmt(Number(item.amount) || 0)}</td>
        <td className="p-3">
          <div className="space-y-1">
            <ConversionBadge status={item.conversion_status} />
            {item.transaction_id && <p className="text-[10px] text-muted-foreground">Transação criada</p>}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
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

      {parsed && (
        <Card>
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

      <div className={cn('grid gap-4', invoiceSidebarCollapsed ? 'xl:grid-cols-[64px_1fr]' : 'xl:grid-cols-[340px_1fr]')}>
        <Card className={cn(invoiceSidebarCollapsed && 'overflow-hidden')}>
          {invoiceSidebarCollapsed ? (
            <CardContent className="flex h-full min-h-80 flex-col items-center gap-3 p-3">
              <Button
                size="icon"
                variant="outline"
                title="Mostrar faturas salvas"
                onClick={() => setInvoiceSidebarCollapsed(false)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="flex flex-1 items-center">
                <p className="-rotate-90 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {invoices.length} faturas
                </p>
              </div>
            </CardContent>
          ) : (
          <>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">Faturas salvas</CardTitle>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" title="Recolher lista de faturas" onClick={() => setInvoiceSidebarCollapsed(true)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={exportSelectedSavedInvoices} disabled={invoices.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {invoices.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Marque uma ou mais faturas para exportar o resumo. Use Gerenciar para abrir a planilha detalhada.
              </p>
            )}
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma fatura salva ainda.</p>
            ) : invoices.map(invoice => {
              const active = (selectedInvoiceId || activeInvoice?.id) === invoice.id;
              return (
                <div
                  key={invoice.id}
                  className={cn('w-full rounded-xl border p-3 text-left hover:bg-muted/50', active && 'border-primary bg-primary/5')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 gap-2">
                      <Checkbox
                        checked={selectedInvoiceIds.has(invoice.id)}
                        onCheckedChange={() => toggleSavedInvoice(invoice.id)}
                        className="mt-1"
                      />
                      <button
                        type="button"
                        onClick={() => openInvoiceManager(invoice)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate font-semibold">{displayInvoiceName(invoice)}</p>
                        <p className="text-xs text-muted-foreground">{months[invoice.competence_month - 1]}/{invoice.competence_year}</p>
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => beginEditInvoice(invoice)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeInvoice(invoice)} disabled={deleteInvoice.isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Badge variant="outline">{invoice.status}</Badge>
                    </div>
                  </div>
                  {editingInvoiceId === invoice.id ? (
                    <div className="mt-3 flex gap-2">
                      <Input value={editingInvoiceName} onChange={(event) => setEditingInvoiceName(event.target.value)} autoFocus />
                      <Button size="icon" onClick={saveInvoiceName} disabled={updateInvoice.isPending}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground truncate">{invoice.file_name || invoice.invoice_label || 'Fatura'}</p>
                    </div>
                  )}
                  <p className="mt-2 text-sm font-bold">{fmt(Number(invoice.total_amount) || 0)}</p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.total_transactions} lançamento(s) • {Array.isArray(invoice.selected_cards) ? invoice.selected_cards.length : 0} cartão(ões)
                  </p>
                  <Button className="mt-3 w-full" variant={managerOpen && active ? 'default' : 'outline'} onClick={() => openInvoiceManager(invoice)}>
                    Gerenciar fatura
                  </Button>
                </div>
              );
            })}
          </CardContent>
          </>
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
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <Mini label="Total" value={fmt(invoiceStats.total)} strong />
                  <Mini label="Empresa" value={String(invoiceStats.empresa)} />
                  <Mini label="Pessoal" value={String(invoiceStats.pessoal)} />
                  <Mini label="Prontos" value={String(invoiceStats.prontos)} strong />
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
                  A lista à esquerda serve para selecionar faturas e exportar resumos. Para revisar cartões separados,
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
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => toggleInvoiceCard(card.key)}
                    className={cn('rounded-xl border p-3 text-left transition hover:border-primary/50', selectedCardKeys.has(card.key) && 'border-primary bg-primary/5')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold">{card.label}</p>
                      <Checkbox checked={selectedCardKeys.has(card.key)} />
                    </div>
                    <p className="text-xs text-muted-foreground">{card.count} lançamento(s)</p>
                    <p className="mt-2 text-sm font-bold">{fmt(card.total)}</p>
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-2 rounded-2xl border bg-muted/20 p-2 md:grid-cols-2">
              <Button
                variant={workflowStep === 'manage' ? 'default' : 'ghost'}
                onClick={() => setWorkflowStep('manage')}
                className="justify-start"
              >
                <Wand2 className="mr-2 h-4 w-4" />
                Gerenciar e classificar
              </Button>
              <Button
                variant={workflowStep === 'preview' ? 'default' : 'ghost'}
                onClick={() => setWorkflowStep('preview')}
                className="justify-start"
              >
                <Eye className="mr-2 h-4 w-4" />
                Pré-lançamentos ({previewItems.length})
              </Button>
            </div>

            {workflowStep === 'manage' ? (
              <>
            <Card className="border-amber-200 bg-amber-50/60">
              <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    <ArrowRightCircle className="h-4 w-4 text-amber-700" />
                    Preparar Transações
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {readyItems.length} item(ns) empresariais prontos para virar despesa em aberto.
                    {selectedReadyItems.length > 0 ? ` ${selectedReadyItems.length} selecionado(s).` : ' Sem seleção, converte todos os prontos.'}
                  </p>
                </div>
                <Button onClick={convertSelectedItems} disabled={!activeInvoice || readyItems.length === 0 || convertItems.isPending}>
                  Converter para transações
                </Button>
              </CardContent>
            </Card>

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
                <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    {(categories as any[])
                      .filter(category => category.type === 'SAIDA')
                      .map(category => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div className="rounded-lg border bg-white px-3 py-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Regra automática</p>
                  <p>Cliente: {ramosClient?.name || 'Ramos Engenharia'}. Conta e centro vêm da categoria. {merchantRules.length} padrão(ões) salvo(s).</p>
                </div>
                <Button variant="outline" onClick={exportVisibleItems} disabled={!activeInvoice || visibleItems.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar visão atual
                </Button>
              </div>
            </div>

            <div className="overflow-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs">
                  <tr>
                    <th className="w-10 p-3">
                      <Checkbox checked={allVisibleSelected} onCheckedChange={toggleVisibleItems} />
                    </th>
                    <th className="p-3 text-left"><SortHeader label="Data" sortKey="date" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="p-3 text-left"><SortHeader label="Descrição" sortKey="description" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="p-3 text-left"><SortHeader label="Cartão" sortKey="card" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="p-3 text-left"><SortHeader label="Uso" sortKey="scope" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="p-3 text-left">Sugestão</th>
                    <th className="p-3 text-left"><SortHeader label="Categoria" sortKey="category" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="p-3 text-left"><SortHeader label="Cliente" sortKey="client" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="p-3 text-left">Conta / C. Custo</th>
                    <th className="p-3 text-right"><SortHeader label="Valor" sortKey="amount" activeKey={sortKey} direction={sortDirection} onSort={changeSort} align="right" /></th>
                    <th className="p-3 text-left"><SortHeader label="Conversão" sortKey="conversion" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itemsLoading ? (
                    <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
                  ) : visibleItems.length === 0 ? (
                    <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">Nenhum lançamento para exibir.</td></tr>
                  ) : groupByMerchant ? groupedVisibleItems.map(group => (
                    <Fragment key={group.key}>
                      <tr className="bg-emerald-50/70">
                        <td className="p-3">
                          <Checkbox
                            checked={group.items.every(item => selectedItems.has(item.id))}
                            onCheckedChange={() => toggleMerchantGroup(group.items)}
                          />
                        </td>
                        <td colSpan={7} className="p-3">
                          <p className="font-semibold">{group.label}</p>
                          <p className="text-xs text-muted-foreground">{group.items.length} lançamento(s) agrupado(s) por estabelecimento</p>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{selectedCardSummary}</td>
                        <td className="p-3 text-right font-bold text-expense">{fmt(group.total)}</td>
                        <td className="p-3 text-xs text-muted-foreground">Grupo</td>
                      </tr>
                      {group.items.map(renderInvoiceItemRow)}
                    </Fragment>
                  )) : visibleItems.map(renderInvoiceItemRow)}
                </tbody>
              </table>
            </div>
              </>
            ) : (
              <PreviewTransactionsPanel
                groups={previewGroups}
                readyItems={readyItems}
                selectedReadyItems={selectedReadyItems}
                selectedItems={selectedItems}
                onToggleItem={toggleItem}
                onConvert={convertSelectedItems}
                isConverting={convertItems.isPending}
              />
            )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
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
  readyItems,
  selectedReadyItems,
  selectedItems,
  onToggleItem,
  onConvert,
  isConverting,
}: {
  groups: Array<{ key: string; label: string; total: number; items: CreditCardInvoiceItem[] }>;
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

function exportSavedInvoiceRows(invoice: CreditCardInvoice, rows: CreditCardInvoiceItem[]) {
  exportRowsToExcel(
    rows.map(item => ({
      'Fatura': displayInvoiceName(invoice),
      'Competência': `${months[invoice.competence_month - 1]}/${invoice.competence_year}`,
      'Data': item.transaction_date ? new Date(`${item.transaction_date}T00:00:00`).toLocaleDateString('pt-BR') : '',
      'Descrição': item.description,
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
      'Status de Revisão': item.review_status,
      'Valor': Number(item.amount) || 0,
      'Observações': item.notes || '',
    })),
    slugFileName(displayInvoiceName(invoice)),
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

function ScopeBadge({ scope }: { scope: CreditCardInvoiceItem['usage_scope'] }) {
  const label = scope === 'EMPRESA' ? 'Empresa' : scope === 'PESSOAL' ? 'Pessoal' : 'Dúvida';
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
