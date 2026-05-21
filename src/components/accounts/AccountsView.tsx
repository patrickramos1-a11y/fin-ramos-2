import { useEffect, useMemo, useState } from 'react';
import { useAccounts, useAccountCategories, type Account } from '@/hooks/useFinancialConfig';
import { useAccountsSnapshot } from '@/hooks/useAccountsSnapshot';
import { AccountsHeader } from './AccountsHeader';
import { AccountCard } from './AccountCard';
import { AccountModal } from './AccountModal';
import { TransferModal } from './TransferModal';
import { AccountsEvolutionChart } from './AccountsEvolutionChart';
import { AccountsDistributionPanel } from './AccountsDistributionPanel';
import { AccountsToolbar, type SortKey, type GroupKey, type FilterKey } from './AccountsToolbar';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Wallet, CalendarClock, LayoutGrid } from 'lucide-react';
import { PlannedTransfersTab } from './PlannedTransfersTab';
import { getBankBrand } from '@/lib/financial/bank-brand';

const ACCOUNTS_LAYOUT_KEY = 'fin-ramos.accounts.layout.v1';

interface AccountsViewProps {
  onOpenDetail?: (accountId: string) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function AccountsView({ onOpenDetail }: AccountsViewProps = {}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('saldo_desc');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [group, setGroup] = useState<GroupKey>('none');
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [compact, setCompact] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const { data: accounts, isLoading } = useAccounts();
  const { data: accountCategories } = useAccountCategories();
  const { data: snapshots, isLoading: snapLoading } = useAccountsSnapshot(year, month);

  const activeAccounts = (accounts || []).filter((a) => a.active);
  const categoryOrder = useMemo(() => {
    const map = new Map<string, number>();
    (accountCategories || []).forEach((category) => map.set(category.id, category.display_order ?? 999));
    return map;
  }, [accountCategories]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ACCOUNTS_LAYOUT_KEY) || '{}');
      setManualOrder(Array.isArray(saved.manualOrder) ? saved.manualOrder : []);
      setHiddenIds(Array.isArray(saved.hiddenIds) ? saved.hiddenIds : []);
      setCompact(Boolean(saved.compact));
      if (saved.sort) setSort(saved.sort);
      if (saved.group) setGroup(saved.group);
    } catch {
      // Preferimos ignorar preferencias antigas corrompidas a travar a tela.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(ACCOUNTS_LAYOUT_KEY, JSON.stringify({ manualOrder, hiddenIds, compact, sort, group }));
  }, [compact, group, hiddenIds, manualOrder, sort]);

  const totalSaldo = activeAccounts.reduce(
    (s, a) => s + (snapshots?.[a.id]?.saldo_fim_mes ?? Number(a.current_balance) ?? 0),
    0,
  );
  const totalEntradas = activeAccounts.reduce((s, a) => s + (snapshots?.[a.id]?.entradas_mes ?? 0), 0);
  const totalSaidas = activeAccounts.reduce((s, a) => s + (snapshots?.[a.id]?.saidas_mes ?? 0), 0);

  const visible = useMemo(() => {
    let list = activeAccounts.filter((a) => showHidden || !hiddenIds.includes(a.id));
    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(s) ||
          (a.bank || '').toLowerCase().includes(s) ||
          (a.category?.name || '').toLowerCase().includes(s),
      );
    }
    list = list.filter((a) => {
      const snap = snapshots?.[a.id];
      const saldo = snap?.saldo_fim_mes ?? Number(a.current_balance) ?? 0;
      const mov = (snap?.entradas_mes ?? 0) + (snap?.saidas_mes ?? 0)
        + (snap?.transferencias_in ?? 0) + (snap?.transferencias_out ?? 0);
      switch (filter) {
        case 'positive': return saldo > 0.01;
        case 'negative': return saldo < -0.01;
        case 'zero': return Math.abs(saldo) < 0.01;
        case 'with_movement': return mov > 0;
        case 'no_movement': return mov === 0;
        default: return true;
      }
    });
    list = [...list].sort((a, b) => {
      const sa = snapshots?.[a.id]?.saldo_fim_mes ?? Number(a.current_balance) ?? 0;
      const sb = snapshots?.[b.id]?.saldo_fim_mes ?? Number(b.current_balance) ?? 0;
      const ma = (snapshots?.[a.id]?.entradas_mes ?? 0) + (snapshots?.[a.id]?.saidas_mes ?? 0);
      const mb = (snapshots?.[b.id]?.entradas_mes ?? 0) + (snapshots?.[b.id]?.saidas_mes ?? 0);
      if (sort === 'manual') {
        const ai = manualOrder.indexOf(a.id);
        const bi = manualOrder.indexOf(b.id);
        if (ai !== -1 || bi !== -1) {
          return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi);
        }
        return a.name.localeCompare(b.name);
      }
      switch (sort) {
        case 'saldo_asc': return sa - sb;
        case 'name': return a.name.localeCompare(b.name);
        case 'movimento': return mb - ma;
        case 'saldo_desc':
        default: return sb - sa;
      }
    });
    return list;
  }, [activeAccounts, hiddenIds, manualOrder, search, filter, sort, snapshots, showHidden]);

  const groups = useMemo(() => {
    if (group === 'none') return [{ key: '__all', label: '', items: visible }];
    const map = new Map<string, { label: string; order: number; color?: string | null; items: Account[] }>();
    visible.forEach((a) => {
      const key = a.category_id || 'sem-agrupador';
      const current = map.get(key) || {
        label: a.category?.name || 'Sem agrupador definido',
        order: a.category_id ? (categoryOrder.get(a.category_id) ?? 999) : 9999,
        color: a.category?.color,
        items: [],
      };
      current.items.push(a);
      map.set(key, current);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].order - b[1].order || a[1].label.localeCompare(b[1].label, 'pt-BR'))
      .map(([key, value]) => ({ key, ...value }));
  }, [categoryOrder, visible, group]);

  const ensureManualOrder = () => {
    setSort('manual');
    setGroup('none');
    setManualOrder((current) => {
      const activeIds = activeAccounts.map((a) => a.id);
      const known = current.filter((id) => activeIds.includes(id));
      const missing = activeIds.filter((id) => !known.includes(id));
      return [...known, ...missing];
    });
  };

  const moveAccount = (accountId: string, direction: -1 | 1) => {
    ensureManualOrder();
    setManualOrder((current) => {
      const activeIds = activeAccounts.map((a) => a.id);
      const order = [...current.filter((id) => activeIds.includes(id)), ...activeIds.filter((id) => !current.includes(id))];
      const index = order.indexOf(accountId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return order;
      [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
      return order;
    });
  };

  const toggleHiddenAccount = (accountId: string) => {
    setHiddenIds((current) => (
      current.includes(accountId)
        ? current.filter((id) => id !== accountId)
        : [...current, accountId]
    ));
  };

  const resetLayout = () => {
    setManualOrder([]);
    setHiddenIds([]);
    setCompact(false);
    setShowHidden(false);
    setSort('saldo_desc');
    setGroup('none');
  };

  const renderCard = (a: Account) => (
    <AccountCard
      key={a.id}
      account={a}
      snapshot={snapshots?.[a.id]}
      onClick={() => onOpenDetail?.(a.id)}
      onEdit={() => { setEditingAccount(a); setAccountModalOpen(true); }}
      compact={compact}
      manualMode={sort === 'manual' && group === 'none'}
      onMoveUp={() => moveAccount(a.id, -1)}
      onMoveDown={() => moveAccount(a.id, 1)}
      onToggleHidden={() => toggleHiddenAccount(a.id)}
      isHidden={hiddenIds.includes(a.id)}
    />
  );

  const gridCls = compact
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5';

  return (
    <div className="space-y-4">
      <AccountsHeader
        month={month}
        year={year}
        onMonthChange={setMonth}
        onYearChange={setYear}
        onNewAccount={() => { setEditingAccount(null); setAccountModalOpen(true); }}
        onTransfer={() => setTransferOpen(true)}
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5" /> Visão geral
          </TabsTrigger>
          <TabsTrigger value="planned" className="gap-1.5">
            <CalendarClock className="w-3.5 h-3.5" /> Planejadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Totais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Wallet className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Saldo total</p>
                  <p className="text-lg font-bold">{fmt(totalSaldo)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Entradas no período</p>
                <p className="text-lg font-bold text-primary">{fmt(totalEntradas)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Saídas no período</p>
                <p className="text-lg font-bold text-destructive">{fmt(totalSaidas)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Visão estratégica: evolução + distribuição */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <AccountsEvolutionChart year={year} month={month} />
            <AccountsDistributionPanel
              accounts={activeAccounts}
              snapshots={snapshots}
              isLoading={isLoading || snapLoading}
            />
          </div>

          {/* Toolbar */}
          <AccountsToolbar
            search={search} onSearch={setSearch}
            sort={sort} onSort={setSort}
            filter={filter} onFilter={setFilter}
            group={group} onGroup={setGroup}
            hiddenCount={hiddenIds.length}
            compact={compact}
            onCompactChange={setCompact}
            onShowHidden={() => setShowHidden((v) => !v)}
            onResetLayout={resetLayout}
            showHidden={showHidden}
          />

          {sort === 'manual' && group !== 'none' && (
            <Card>
              <CardContent className="p-3 text-xs text-muted-foreground">
                Para reordenar manualmente, use "Sem agrupamento". O agrupamento por banco/categoria organiza os blocos automaticamente.
              </CardContent>
            </Card>
          )}

          {/* Grid de contas */}
          {isLoading || snapLoading ? (
            <div className={gridCls}>
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36" />)}
            </div>
          ) : visible.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma conta corresponde aos filtros.
              </CardContent>
            </Card>
          ) : group === 'none' ? (
            <div className={gridCls}>
              {visible.map(renderCard)}
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => {
                const sub = g.items.reduce(
                  (s, a) => s + (snapshots?.[a.id]?.saldo_fim_mes ?? Number(a.current_balance) ?? 0),
                  0,
                );
                const brand = getBankBrand(g.label, g.color);
                const BrandIcon = brand.icon;
                return (
                  <div key={g.key} className="space-y-2">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: brand.bg }}
                        >
                          <BrandIcon className="h-4 w-4" style={{ color: brand.color }} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold uppercase tracking-wide truncate" style={{ color: brand.color }}>
                            {brand.name}
                          </h4>
                          <p className="text-[10px] text-muted-foreground">
                            {g.items.length} conta(s) neste agrupador
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold">{fmt(sub)}</span>
                    </div>
                    <div className={gridCls}>
                      {g.items.map(renderCard)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="planned" className="mt-4">
          <PlannedTransfersTab />
        </TabsContent>
      </Tabs>

      <AccountModal open={accountModalOpen} onClose={() => setAccountModalOpen(false)} account={editingAccount} />
      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} />
    </div>
  );
}
