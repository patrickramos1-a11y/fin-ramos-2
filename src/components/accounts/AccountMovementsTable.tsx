import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownLeft, ArrowUpRight, Download, Search, ArrowUpDown, ArrowRightLeft, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAccountDetail, type AccountTx, type DetailPeriodMode } from '@/hooks/useAccountDetail';
import { ConvertToTransferModal } from './ConvertToTransferModal';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (s: string | null) => {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y.slice(-2)}`;
};

type SortKey = 'date' | 'value' | 'category';
type StatusFilter = 'all' | 'PAGO' | 'EM_ABERTO';
type TypeFilter = 'all' | 'ENTRADA' | 'SAIDA';

interface Props {
  accountId: string;
  year: number;
  month: number;
  mode?: DetailPeriodMode;
}

export function AccountMovementsTable({ accountId, year, month, mode = 'caixa' }: Props) {
  const { data, isLoading } = useAccountDetail(accountId, year, month, mode);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [convertTx, setConvertTx] = useState<AccountTx | null>(null);

  const all = useMemo<AccountTx[]>(
    () => [...(data?.paid || []), ...(data?.open || [])],
    [data],
  );

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    all.forEach((t) => {
      if (t.transaction_category_id)
        map.set(t.transaction_category_id, t.category_name || 'Sem categoria');
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [all]);

  const filtered = useMemo(() => {
    let rows = all;
    if (type !== 'all') rows = rows.filter((t) => t.tipo_movimento === type);
    if (status !== 'all') rows = rows.filter((t) => t.status === status);
    if (category !== 'all') rows = rows.filter((t) => t.transaction_category_id === category);
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (t) =>
          (t.descricao || '').toLowerCase().includes(s) ||
          (t.category_name || '').toLowerCase().includes(s),
      );
    }
    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') {
        cmp = (a.data_pagamento || a.data_vencimento).localeCompare(
          b.data_pagamento || b.data_vencimento,
        );
      } else if (sortKey === 'value') {
        cmp = (a.valor_pago ?? a.valor) - (b.valor_pago ?? b.valor);
      } else {
        cmp = (a.category_name || '').localeCompare(b.category_name || '');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [all, type, status, category, search, sortKey, sortDir]);

  const totals = useMemo(() => {
    let inSum = 0,
      outSum = 0;
    filtered.forEach((t) => {
      const v = (t.valor_pago ?? t.valor) || 0;
      if (t.tipo_movimento === 'ENTRADA') inSum += v;
      else outSum += v;
    });
    return { in: inSum, out: outSum, net: inSum - outSum, count: filtered.length };
  }, [filtered]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const exportCSV = () => {
    const header = [
      mode === 'caixa' ? 'Data de pagamento' : 'Data',
      'Descrição',
      'Categoria',
      'Tipo',
      'Status',
      'Valor',
    ];
    const rows = filtered.map((t) => [
      fmtDate(t.data_pagamento || t.data_vencimento),
      (t.descricao || '').replace(/"/g, '""'),
      t.category_name || 'Sem categoria',
      t.tipo_movimento,
      t.status,
      String(t.valor_pago ?? t.valor),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movimentos-${year}-${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {mode === 'caixa' ? 'Regime de caixa' : 'Regime de competência'}:
        </span>{' '}
        {mode === 'caixa'
          ? 'mostra somente lançamentos pagos pela data de pagamento, alinhado aos cards de saldo acima.'
          : 'mostra lançamentos pela competência do mês, mesmo que tenham sido pagos em outro período.'}
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar descrição ou categoria…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={type} onValueChange={(v) => setType(v as TypeFilter)}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="ENTRADA">Entradas</SelectItem>
            <SelectItem value="SAIDA">Saídas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="PAGO">Pagos</SelectItem>
            <SelectItem value="EM_ABERTO">Em aberto</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportCSV}>
          <Download className="w-3.5 h-3.5" /> CSV
        </Button>
      </div>

      {/* KPIs of filter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border border-border p-2.5">
          <p className="text-[10px] uppercase text-muted-foreground">Itens</p>
          <p className="text-sm font-bold">{totals.count}</p>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <p className="text-[10px] uppercase text-muted-foreground">Entradas</p>
          <p className="text-sm font-bold text-primary">{fmt(totals.in)}</p>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <p className="text-[10px] uppercase text-muted-foreground">Saídas</p>
          <p className="text-sm font-bold text-destructive">{fmt(totals.out)}</p>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <p className="text-[10px] uppercase text-muted-foreground">Saldo</p>
          <p
            className={cn(
              'text-sm font-bold',
              totals.net >= 0 ? 'text-primary' : 'text-destructive',
            )}
          >
            {fmt(totals.net)}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum movimento corresponde aos filtros.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">
                  <button
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort('date')}
                  >
                    {mode === 'caixa' ? 'Pagamento' : 'Data'} <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>
                  <button
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort('category')}
                  >
                    Categoria <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
                <TableHead className="text-right w-[120px]">
                  <button
                    className="flex items-center gap-1 hover:text-foreground ml-auto"
                    onClick={() => toggleSort('value')}
                  >
                    Valor <ArrowUpDown className="w-3 h-3" />
                  </button>
                </TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const isIn = t.tipo_movimento === 'ENTRADA';
                const v = t.valor_pago ?? t.valor;
                return (
                  <TableRow key={t.id} className="text-xs">
                    <TableCell className="text-muted-foreground">
                      {fmtDate(t.data_pagamento || t.data_vencimento)}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {isIn ? (
                          <ArrowDownLeft className="w-3 h-3 text-primary flex-shrink-0" />
                        ) : (
                          <ArrowUpRight className="w-3 h-3 text-destructive flex-shrink-0" />
                        )}
                        <span className="truncate">{t.descricao || '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground truncate">
                      {t.category_name || 'Sem categoria'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] h-4',
                          t.status === 'PAGO'
                            ? 'border-primary/40 text-primary'
                            : 'border-amber-500/40 text-amber-600 dark:text-amber-400',
                        )}
                      >
                        {t.status === 'PAGO' ? 'Pago' : 'Aberto'}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-bold',
                        isIn ? 'text-primary' : 'text-destructive',
                      )}
                    >
                      {isIn ? '+' : '−'} {fmt(v)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={t.tipo_movimento !== 'SAIDA'}
                            onClick={() => setConvertTx(t)}
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 mr-2" />
                            Converter em transferência
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <ConvertToTransferModal
        open={!!convertTx}
        onClose={() => setConvertTx(null)}
        fromAccountId={accountId}
        transaction={convertTx}
      />
    </div>
  );
}
