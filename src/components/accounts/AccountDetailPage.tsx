import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  AlertTriangle,
  SlidersHorizontal,
  Banknote,
  TrendingDown,
  TrendingUp,
  Wallet,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccounts } from '@/hooks/useFinancialConfig';
import { useAccountsSnapshot } from '@/hooks/useAccountsSnapshot';
import { useAccountDetail } from '@/hooks/useAccountDetail';
import { AccountAdjustmentModal } from './AccountAdjustmentModal';
import { TransferModal } from './TransferModal';
import { MonthYearNavigator } from '@/components/ui/month-year-navigator';

import { AccountBalanceEvolutionChart } from './AccountBalanceEvolutionChart';
import { AccountCategoryStackedChart } from './AccountCategoryStackedChart';
import { AccountCategoryAnalysis } from './AccountCategoryAnalysis';
import { AccountInsights } from './AccountInsights';
import { AccountMovementsTable } from './AccountMovementsTable';
import { AccountAnnualAnalysis } from './AccountAnnualAnalysis';
import { AccountSwitcher } from './AccountSwitcher';

interface Props {
  accountId: string;
  onBack: () => void;
  onSelectAccount?: (id: string) => void;
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

export function AccountDetailPage({ accountId, onBack, onSelectAccount }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const { data: accounts } = useAccounts();
  const account = accounts?.find((a) => a.id === accountId);
  const { data: snapshots } = useAccountsSnapshot(year, month);
  const snapshot = snapshots?.[accountId];
  const { data, isLoading } = useAccountDetail(accountId, year, month, 'competencia');

  if (!account) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ChevronLeft className="w-4 h-4" /> Voltar para Contas
        </Button>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const saldoFim = snapshot?.saldo_fim_mes ?? Number(account.current_balance) ?? 0;
  const saldoIni = snapshot?.saldo_inicio_mes ?? saldoFim;
  const variacao = snapshot?.variacao ?? 0;
  const entradasCaixa = snapshot?.entradas_mes ?? 0;
  const saidasCaixa = snapshot?.saidas_mes ?? 0;
  const trIn = snapshot?.transferencias_in ?? 0;
  const trOut = snapshot?.transferencias_out ?? 0;
  const entradasPeriodo = entradasCaixa + trIn;

  // Validação contábil: saldoIni + entradas + trIn − saídas − trOut === saldoFim
  const expectedFim = saldoIni + entradasPeriodo - saidasCaixa - trOut;
  const diff = expectedFim - saldoFim;
  const consistent = Math.abs(diff) < 0.01;

  const color = account.category?.color || 'hsl(var(--primary))';
  const Trend = variacao > 0 ? TrendingUp : variacao < 0 ? TrendingDown : Wallet;
  const isCurrentPeriod = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="space-y-4">
      {/* Breadcrumb + back + switcher */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2 h-7">
            <ChevronLeft className="w-4 h-4" /> Voltar para Contas
          </Button>
          <span className="text-muted-foreground/50">/</span>
          <span>Contas</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground font-medium truncate">{account.name}</span>
        </div>
        {accounts && accounts.filter((a) => a.active).length > 1 && onSelectAccount && (
          <AccountSwitcher
            accounts={accounts.filter((a) => a.active)}
            currentId={accountId}
            onChange={onSelectAccount}
          />
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}20` }}
          >
            <Banknote className="w-7 h-7" style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold truncate">{account.name}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="truncate">{account.bank || '—'}</span>
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
            onYearChange={setYear}
            onMonthChange={setMonth}
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

      {/* Fechamento de caixa */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <KPI label="Saldo anterior" value={saldoIni} icon={Wallet} />
        <KPI
          label="Entradas do período"
          value={entradasPeriodo}
          tone="in"
          icon={ArrowDownLeft}
          subtitle={`${fmt(entradasCaixa)} receitas + ${fmt(trIn)} transf.`}
        />
        <KPI label="Despesas do período" value={saidasCaixa} tone="out" icon={ArrowUpRight} />
        <KPI label="Transf. enviadas" value={trOut} tone="transfer" icon={ArrowLeftRight} />
        <KPI
          label="Saldo final"
          value={saldoFim}
          icon={Wallet}
          subtitle={`${variacao >= 0 ? '+' : ''}${fmt(variacao)} variação`}
        />
      </div>

      {/* Saldo bancário / caixa */}
      <div
        className={cn(
          'rounded-lg border p-2.5 text-xs flex items-center gap-2 flex-wrap',
          consistent
            ? 'border-primary/30 bg-primary/5 text-primary'
            : 'border-destructive/40 bg-destructive/5 text-destructive',
        )}
      >
        {consistent ? (
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        )}
        <span className="font-medium">Saldo bancário/caixa:</span>
        <span className="font-mono">
          {fmt(saldoIni)} + {fmt(entradasPeriodo)} − {fmt(saidasCaixa)} − {fmt(trOut)} ={' '}
          <strong>{fmt(expectedFim)}</strong>
        </span>
        <span>·</span>
        <span>
          Saldo final registrado: <strong>{fmt(saldoFim)}</strong>
        </span>
        {!consistent && (
          <span className="ml-auto">
            Diferença: <strong>{fmt(diff)}</strong>
          </span>
        )}
        <span className="basis-full text-muted-foreground">
          Entradas do período = receitas pagas + transferências recebidas. A aba Movimentos segue por competência para bater com Transações.
        </span>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="visao" className="mt-2">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
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
            <AccountBalanceEvolutionChart accountId={accountId} year={year} />
            <p className="text-[10px] text-muted-foreground mt-1">
              Saldo do início do ano + movimentações pagas e transferências, mês a mês.
            </p>
          </div>

          <div className="rounded-lg border border-border p-3">
            <AccountCategoryStackedChart accountId={accountId} year={year} />
          </div>

          <AccountInsights accountId={accountId} year={year} />
        </TabsContent>

        {/* MOVIMENTOS */}
        <TabsContent value="movimentos" className="mt-3">
          <AccountMovementsTable accountId={accountId} year={year} month={month} mode="competencia" />
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
        <TabsContent value="categorias" className="mt-3 space-y-3">
          <div className="rounded-lg border border-border p-3">
            <h3 className="text-sm font-semibold mb-2">Análise por categoria · {year}</h3>
            <AccountCategoryAnalysis accountId={accountId} year={year} />
          </div>
        </TabsContent>

        {/* ANUAL */}
        <TabsContent value="anual" className="mt-3">
          <AccountAnnualAnalysis accountId={accountId} year={year} />
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
        defaultFromAccountId={accountId}
      />
    </div>
  );
}
