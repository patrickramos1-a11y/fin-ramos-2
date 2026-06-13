import { useEffect, useMemo, useState } from 'react';
import { Upload, CreditCard, FileSpreadsheet, CheckCircle2, Trash2, Search, Tags } from 'lucide-react';
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
  useCreditCardInvoiceItems,
  useCreditCardInvoices,
  useSaveCreditCardInvoice,
} from '@/hooks/useCreditCardInvoices';
import { useTransactionCategories } from '@/hooks/useFinancialConfig';
import { cn } from '@/lib/utils';

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const fmt = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function CreditCardInvoicesView() {
  const now = new Date();
  const [parsed, setParsed] = useState<ParsedCreditCardStatement | null>(null);
  const [fileName, setFileName] = useState('');
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState('');

  const { data: invoices = [] } = useCreditCardInvoices();
  const { data: items = [], isLoading: itemsLoading } = useCreditCardInvoiceItems(selectedInvoiceId);

  useEffect(() => {
    if (!selectedInvoiceId && invoices.length > 0) {
      setSelectedInvoiceId(invoices[0].id);
    }
  }, [invoices, selectedInvoiceId]);
  const { data: categories = [] } = useTransactionCategories();
  const saveInvoice = useSaveCreditCardInvoice();
  const bulkUpdate = useBulkUpdateCreditCardItems();

  const selectedParsedCards = useMemo<CreditCardStatementCard[]>(
    () => parsed ? parsed.cards.filter(card => selectedCards.has(card.id)) : [],
    [parsed, selectedCards],
  );

  const totalSelected = selectedParsedCards.reduce((sum, card) => sum + card.total, 0);
  const totalTx = selectedParsedCards.reduce((sum, card) => sum + card.transactions.length, 0);

  const activeInvoice = invoices.find(invoice => invoice.id === selectedInvoiceId) || invoices[0] || null;

  const filteredItems = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return items;
    return items.filter(item =>
      item.description.toLowerCase().includes(text) ||
      item.card_name.toLowerCase().includes(text) ||
      item.category_hint?.toLowerCase().includes(text) ||
      item.transaction_categories?.name?.toLowerCase().includes(text)
    );
  }, [items, search]);

  const handleFile = async (file: File) => {
    try {
      const result = await parseCreditCardStatementFile(file);
      if (result.cards.length === 0) {
        toast.error('Nenhum cartão encontrado no arquivo.');
        return;
      }
      setParsed(result);
      setFileName(file.name);
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
    });
    setSelectedInvoiceId(invoice.id);
    setParsed(null);
    setFileName('');
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

  const applyBulkCategory = () => {
    if (!bulkCategoryId || selectedItems.size === 0) return;
    bulkUpdate.mutate({
      ids: Array.from(selectedItems),
      updates: { transaction_category_id: bulkCategoryId },
    }, {
      onSuccess: () => {
        setSelectedItems(new Set());
        setBulkCategoryId('');
      },
    });
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
            <div className="mt-4 rounded-xl bg-muted/60 p-3 text-sm">
              <p className="text-muted-foreground">Arquivo</p>
              <p className="truncate font-medium">{fileName || 'Nenhum arquivo selecionado'}</p>
            </div>
            <Button className="mt-4 w-full" onClick={saveCurrentInvoice} disabled={!parsed || selectedParsedCards.length === 0 || saveInvoice.isPending}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Salvar fatura para conferência
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

      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Faturas salvas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma fatura salva ainda.</p>
            ) : invoices.map(invoice => {
              const active = (selectedInvoiceId || activeInvoice?.id) === invoice.id;
              return (
                <button
                  key={invoice.id}
                  type="button"
                  onClick={() => {
                    setSelectedInvoiceId(invoice.id);
                    setSelectedItems(new Set());
                  }}
                  className={cn('w-full rounded-xl border p-3 text-left hover:bg-muted/50', active && 'border-primary bg-primary/5')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{months[invoice.competence_month - 1]}/{invoice.competence_year}</p>
                      <p className="text-xs text-muted-foreground truncate">{invoice.file_name || invoice.invoice_label || 'Fatura'}</p>
                    </div>
                    <Badge variant="outline">{invoice.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-bold">{fmt(Number(invoice.total_amount) || 0)}</p>
                  <p className="text-xs text-muted-foreground">{invoice.total_transactions} lançamento(s)</p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Tags className="h-5 w-5" />
              Planilha unificada da fatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar descrição, cartão, sugestão ou categoria..." className="pl-9" />
              </div>
              <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
                <SelectTrigger className="lg:w-72"><SelectValue placeholder="Categoria para selecionados" /></SelectTrigger>
                <SelectContent>
                  {(categories as any[])
                    .filter(category => category.type === 'SAIDA')
                    .map(category => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button onClick={applyBulkCategory} disabled={selectedItems.size === 0 || !bulkCategoryId || bulkUpdate.isPending}>
                Aplicar ({selectedItems.size})
              </Button>
            </div>

            <div className="overflow-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs">
                  <tr>
                    <th className="w-10 p-3"></th>
                    <th className="p-3 text-left">Data</th>
                    <th className="p-3 text-left">Descrição</th>
                    <th className="p-3 text-left">Cartão</th>
                    <th className="p-3 text-left">Sugestão</th>
                    <th className="p-3 text-left">Categoria</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {itemsLoading ? (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
                  ) : filteredItems.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhum lançamento para exibir.</td></tr>
                  ) : filteredItems.map(item => (
                    <tr key={item.id} className={selectedItems.has(item.id) ? 'bg-primary/5' : ''}>
                      <td className="p-3"><Checkbox checked={selectedItems.has(item.id)} onCheckedChange={() => toggleItem(item.id)} /></td>
                      <td className="whitespace-nowrap p-3">{item.transaction_date ? new Date(`${item.transaction_date}T00:00:00`).toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="p-3">
                        <p className="font-medium">{item.description}</p>
                        <p className="text-xs text-muted-foreground">{item.installment || item.scope}</p>
                      </td>
                      <td className="p-3 text-xs">{item.card_name} {item.card_final_digits ? `• ${item.card_final_digits}` : ''}</td>
                      <td className="p-3"><Badge variant="secondary">{item.category_hint || 'Outros'}</Badge></td>
                      <td className="p-3 text-xs">{item.transaction_categories?.name || <span className="text-muted-foreground">não vinculada</span>}</td>
                      <td className="p-3 text-right font-bold text-expense">{fmt(Number(item.amount) || 0)}</td>
                      <td className="p-3"><Badge variant={item.review_status === 'REVISADO' ? 'default' : 'outline'}>{item.review_status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
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
