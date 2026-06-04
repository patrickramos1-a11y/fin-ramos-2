import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  SlidersHorizontal,
  Banknote,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Account } from '@/hooks/useFinancialConfig';
import type { AccountSnapshot } from '@/hooks/useAccountsSnapshot';
import { useAccountDetail } from '@/hooks/useAccountDetail';
import { AccountAdjustmentModal } from './AccountAdjustmentModal';
import { TransferModal } from './TransferModal';
import { MonthYearNavigator } from '@/components/ui/month-year-navigator';
import { AccountAnnualChart } from './AccountAnnualChart';
import { AccountBalanceEvolutionChart } from './AccountBalanceEvolutionChart';

interface Props {
  account: Account;
  snapshot?: AccountSnapshot;
  year: number;
  month: number;
  onYearChange: (y: number) => void;
  onMonthChange: (m: number) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (s: string | null) => {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y.slice(-2)}`;
};

function KPI({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  subtitle,
  format = 'currency',
}: {
  label: string;
  value: number;
  icon?: any;
  tone?: 'neutral' | 'in' | 'out' | 'transfer';
  subtitle?: string;
  format?: 'currency' | 'number';
}) {
  const color =
    tone === 'in'
      ? 'text-primary'
      : tone === 'out'
        ? 'text-destructive'
        : tone === 'transfer'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-foreground';
  return (
    <div className="rounded-lg border border-border p-3 bg-card">
      <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground tracking-wide">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <p className={cn('text-base font-bold mt-1', color)}>
        {format === 'number' ? value : fmt(value)}
      </p>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

export function AccountDetailView({
  account,
  snapshot,
  year,
  month,
  onYearChange,
  onMonthChange,
}: Props) {
  const { data, isLoading } = useAccountDetail(account.id, year, month, 'competencia');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const now = new Date();

  const saldoFim = snapshot?.saldo_fim_mes ?? Number(account.current_balance) ?? 0;
  const saldoIni = snapshot?.saldo_inicio_mes ?? saldoFim;
  const variacao = snapshot?.variacao ?? 0;
  const entradasCaixa = snapshot?.entradas_mes ?? 0;
  const saidasCaixa = snapshot?.saidas_mes ?? 0;
  const trIn = snapshot?.transferencias_in ?? 0;
  const trOut = snapshot?.transferencias_out ?? 0;
  const competencia = (data?.all || []).reduce(
    (acc, t) => {
      const value = Number(t.valor) || 0;
      acc.itens += 1;
      if (t.tipo_movimento === 'ENTRADA') acc.entradas += value;
      else acc.saidas += value;
      return acc;
    },
    { entradas: 0, saidas: 0, itens: 0 },
  );
  const resultadoCompetencia = competencia.entradas - competencia.saidas;

  const color = account.category?.color || 'hsl(var(--primary))';
  const Trend = variacao > 0 ? TrendingUp : variacao < 0 ? TrendingDown : Wallet;
  const isCurrentPeriod = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: `${color}20` }}
          >
            <Banknote className="w-6 h-6" style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold truncate">{account.name}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">{account.bank || account.category?.name || '—'}</span>
              {account.category?.name && (
                <Badge
                  variant="outline"
                  className="text-[10px] h-4"
                  style={{ borderColor: color, color }}
                >
                  {account.category.name}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase text-muted-foreground">
              {isCurrentPeriod ? 'Saldo atual' : 'Saldo final do mês'}
            </p>
            <p className={cn('text-2xl font-bold', saldoFim >= 0 ? 'text-foreground' : 'text-destructive')}>
              {fmt(saldoFim)}
            </p>
            <div
              className={cn(
                'flex items-center justify-end gap-1 text-xs',
                variacao > 0 ? 'text-primary' : variacao < 0 ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              <Trend className="w-3 h-3" />
              {variacao >= 0 ? '+' : ''}
              {fmt(variacao)} no mês
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <MonthYearNavigator
            year={year}
            month={month}
            onYearChange={onYearChange}
            onMonthChange={onMonthChange}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="default" className="gap-2" onClick={() => setTransferOpen(true)}>
              <ArrowLeftRight className="w-3.5 h-3.5" /> Transferir
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setAdjustOpen(true)}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Ajustar saldo
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KPI label="Itens da competência" value={competencia.itens} icon={Wallet} format="number" />
        <KPI label="Receitas da competência" value={competencia.entradas} tone="in" icon={ArrowDownLeft} />
        <KPI label="Despesas da competência" value={competencia.saidas} tone="out" icon={ArrowUpRight} />
        <KPI
          label="Resultado da competência"
          value={resultadoCompetencia}
          icon={Wallet}
          tone={resultadoCompetencia >= 0 ? 'in' : 'out'}
          subtitle="Mesmo critério da página Transações"
        />
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Saldo bancário/caixa:</span>{' '}
        {fmt(saldoIni)} + {fmt(entradasCaixa)} + {fmt(trIn)} − {fmt(saidasCaixa)} − {fmt(trOut)} ={' '}
        <strong className="text-foreground">{fmt(saldoFim)}</strong>. Este fechamento usa pagamentos e
        transferências reais; os cards acima usam competência.
      </div>

      {/* Tabs */}
      <Tabs defaultValue="visao" className="mt-2">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="movimentos">Movimentos</TabsTrigger>
          <TabsTrigger value="transferencias">Transferências</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="anual">Análise anual</TabsTrigger>
        </TabsList>

        {/* VISÃO GERAL */}
        <TabsContent value="visao" className="mt-3 space-y-4">
          <div className="rounded-lg border border-border p-3">
            <h3 className="text-sm font-semibold mb-2">Evolução do saldo · {year}</h3>
            <AccountBalanceEvolutionChart accountId={account.id} year={year} />
            <p className="text-[10px] text-muted-foreground mt-1">
              Estimativa relativa ao saldo inicial da conta + movimentações pagas e transferências do ano.
            </p>
          </div>
          <div className="rounded-lg border border-border p-3 space-y-2">
            <h3 className="text-sm font-semibold">Top categorias do período</h3>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : data?.byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem dados.</p>
            ) : (
              data?.byCategory.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.color }} />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span
                    className={cn('font-semibold', c.total >= 0 ? 'text-primary' : 'text-destructive')}
                  >
                    {c.total >= 0 ? '+' : '−'} {fmt(Math.abs(c.total))}
                  </span>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* MOVIMENTOS */}
        <TabsContent value="movimentos" className="mt-3 space-y-1">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : data?.all.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Sem movimentos na competência.
            </p>
          ) : (
            data?.all.map((t) => {
              const v = t.valor;
              const isIn = t.tipo_movimento === 'ENTRADA';
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 py-2 px-2 hover:bg-muted/50 rounded-lg border-b border-border/50"
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                      isIn ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive',
                    )}
                  >
                    {isIn ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{t.descricao || '—'}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Venc. {fmtDate(t.data_vencimento)} · {t.category_name || 'Sem categoria'}
                    </p>
                  </div>
                  <p
                    className={cn(
                      'text-sm font-bold flex-shrink-0',
                      isIn ? 'text-primary' : 'text-destructive',
                    )}
                  >
                    {isIn ? '+' : '−'} {fmt(v)}
                  </p>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* TRANSFERÊNCIAS */}
        <TabsContent value="transferencias" className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <KPI label="Recebidas no mês" value={trIn} tone="in" icon={ArrowDownLeft} />
            <KPI label="Enviadas no mês" value={trOut} tone="out" icon={ArrowUpRight} />
          </div>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : data?.transfers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma transferência no período.
            </p>
          ) : (
            data?.transfers.map((t) => {
              const isIn = t.direction === 'IN';
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 py-2 px-2 border-b border-border/50"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted text-foreground flex-shrink-0">
                    <ArrowLeftRight className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {isIn ? 'De ' : 'Para '} {t.counterparty_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {fmtDate(t.transfer_date)}
                      {t.notes ? ` · ${t.notes}` : ''}
                    </p>
                  </div>
                  <p className={cn('text-sm font-bold', isIn ? 'text-primary' : 'text-destructive')}>
                    {isIn ? '+' : '−'} {fmt(t.amount)}
                  </p>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* CATEGORIAS */}
        <TabsContent value="categorias" className="mt-3 space-y-2">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : data?.byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem dados no período.</p>
          ) : (
            data?.byCategory.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: c.color }} />
                <span className="flex-1 truncate">{c.name}</span>
                <span
                  className={cn('font-semibold', c.total >= 0 ? 'text-primary' : 'text-destructive')}
                >
                  {c.total >= 0 ? '+' : '−'} {fmt(Math.abs(c.total))}
                </span>
              </div>
            ))
          )}
        </TabsContent>

        {/* ANUAL */}
        <TabsContent value="anual" className="mt-3">
          <AccountAnnualChart accountId={account.id} year={year} />
        </TabsContent>
      </Tabs>

      <AccountAdjustmentModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        account={account}
        currentBalance={saldoFim}
      />
      <TransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        defaultFromAccountId={account.id}
      />
    </div>
  );
}
