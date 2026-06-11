import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Loader2,
  Clock,
  Search,
  Users,
  ChevronRight,
  History,
  Wallet,
} from 'lucide-react';
import { addDays, format, parseISO } from 'date-fns';
import {
  useOpenPayments,
  useOpenPaymentStats,
  useMarkAsPaid,
  useUpdateDueDate,
  type OpenPayment,
  type OpenPaymentFilters,
} from '@/hooks/useOpenPayments';
import { useAccounts } from '@/hooks/useFinancialConfig';
import { KPICard } from '@/components/dashboard/KPICard';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(value);

const bucketLabels: Record<OpenPayment['due_bucket'], string> = {
  overdue: 'Vencido',
  today: 'Vence hoje',
  next_7: '7 dias',
  next_30: '30 dias',
  future: 'Futuro',
};

function getCounterparty(payment: OpenPayment) {
  return payment.cliente?.name || payment.entity?.name || payment.account?.name || 'Sem cliente/fornecedor';
}

function dueText(payment: OpenPayment) {
  if (payment.due_bucket === 'overdue') return `${payment.days_overdue} dia(s) atrasado`;
  if (payment.due_bucket === 'today') return 'vence hoje';
  return `vence em ${payment.days_until_due} dia(s)`;
}

interface PaymentActionsState {
  selectedPayment: OpenPayment | null;
  paymentDialogOpen: boolean;
  dueDateDialogOpen: boolean;
  paymentForm: {
    paidValue: number;
    paymentDate: string;
    accountId: string;
  };
  newDueDate: string;
}

function usePaymentActions() {
  const markAsPaid = useMarkAsPaid();
  const updateDueDate = useUpdateDueDate();
  const [state, setState] = useState<PaymentActionsState>({
    selectedPayment: null,
    paymentDialogOpen: false,
    dueDateDialogOpen: false,
    paymentForm: {
      paidValue: 0,
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      accountId: '',
    },
    newDueDate: '',
  });

  const openPaymentDialog = (payment: OpenPayment) => {
    setState(prev => ({
      ...prev,
      selectedPayment: payment,
      paymentDialogOpen: true,
      paymentForm: {
        paidValue: payment.valor,
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        accountId: payment.account_id || '',
      },
    }));
  };

  const openDueDateDialog = (payment: OpenPayment) => {
    setState(prev => ({
      ...prev,
      selectedPayment: payment,
      dueDateDialogOpen: true,
      newDueDate: payment.data_vencimento,
    }));
  };

  const closePaymentDialog = () => setState(prev => ({ ...prev, paymentDialogOpen: false, selectedPayment: null }));
  const closeDueDateDialog = () => setState(prev => ({ ...prev, dueDateDialogOpen: false, selectedPayment: null }));

  const confirmPayment = () => {
    if (!state.selectedPayment) return;
    markAsPaid.mutate({
      transactionId: state.selectedPayment.id,
      paidValue: state.paymentForm.paidValue,
      paymentDate: state.paymentForm.paymentDate,
      accountId: state.paymentForm.accountId || undefined,
    }, { onSuccess: closePaymentDialog });
  };

  const confirmDueDateUpdate = () => {
    if (!state.selectedPayment) return;
    updateDueDate.mutate({
      transactionId: state.selectedPayment.id,
      newDueDate: state.newDueDate,
    }, { onSuccess: closeDueDateDialog });
  };

  return {
    state,
    setState,
    markAsPaid,
    updateDueDate,
    openPaymentDialog,
    openDueDateDialog,
    closePaymentDialog,
    closeDueDateDialog,
    confirmPayment,
    confirmDueDateUpdate,
  };
}

interface PaymentRowProps {
  payment: OpenPayment;
  onMarkPaid: (payment: OpenPayment) => void;
  onUpdateDueDate: (payment: OpenPayment) => void;
}

function PaymentRow({ payment, onMarkPaid, onUpdateDueDate }: PaymentRowProps) {
  const isIncome = payment.tipo_movimento === 'ENTRADA';
  const isOverdue = payment.due_bucket === 'overdue';

  return (
    <TableRow className={cn(isOverdue && 'bg-destructive/5')}>
      <TableCell>
        {isIncome ? (
          <ArrowDownCircle className="w-5 h-5 text-income" />
        ) : (
          <ArrowUpCircle className="w-5 h-5 text-expense" />
        )}
      </TableCell>
      <TableCell className="min-w-[240px]">
        <p className="font-medium">{payment.descricao || 'Sem descrição'}</p>
        <p className="text-xs text-muted-foreground">
          {getCounterparty(payment)} • {payment.category?.name || 'Sem categoria'}
        </p>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{payment.origem || payment.natureza}</Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <p>{format(parseISO(payment.data_vencimento), 'dd/MM/yyyy')}</p>
        <p className={cn('text-xs', isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
          {dueText(payment)}
        </p>
      </TableCell>
      <TableCell className="text-right font-mono font-semibold">
        <span className={isIncome ? 'text-income' : 'text-expense'}>{formatCurrency(payment.valor)}</span>
      </TableCell>
      <TableCell>
        <Badge variant={isOverdue ? 'destructive' : payment.due_bucket === 'today' ? 'default' : 'outline'}>
          {bucketLabels[payment.due_bucket]}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => onMarkPaid(payment)}>
            <CheckCircle className="w-4 h-4 mr-1" />
            Quitar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onUpdateDueDate(payment)} title="Alterar vencimento">
            <Calendar className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface PaymentDialogsProps {
  actions: ReturnType<typeof usePaymentActions>;
}

function PaymentDialogs({ actions }: PaymentDialogsProps) {
  const { data: accounts } = useAccounts();
  const { state, setState } = actions;
  const selectedPayment = state.selectedPayment;

  return (
    <>
      <Dialog open={state.paymentDialogOpen} onOpenChange={(open) => !open && actions.closePaymentDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              {selectedPayment?.descricao} • Valor original: {formatCurrency(selectedPayment?.valor || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Valor pago</Label>
              <Input
                type="number"
                value={state.paymentForm.paidValue}
                onChange={(e) => setState(prev => ({
                  ...prev,
                  paymentForm: { ...prev.paymentForm, paidValue: parseFloat(e.target.value) || 0 },
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Data do pagamento</Label>
              <Input
                type="date"
                value={state.paymentForm.paymentDate}
                onChange={(e) => setState(prev => ({
                  ...prev,
                  paymentForm: { ...prev.paymentForm, paymentDate: e.target.value },
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select
                value={state.paymentForm.accountId}
                onValueChange={(v) => setState(prev => ({
                  ...prev,
                  paymentForm: { ...prev.paymentForm, accountId: v },
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.filter(a => a.active).map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({formatCurrency(account.current_balance)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={actions.closePaymentDialog}>Cancelar</Button>
            <Button onClick={actions.confirmPayment} disabled={actions.markAsPaid.isPending}>
              {actions.markAsPaid.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={state.dueDateDialogOpen} onOpenChange={(open) => !open && actions.closeDueDateDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar vencimento</DialogTitle>
            <DialogDescription>{selectedPayment?.descricao}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Nova data de vencimento</Label>
            <Input
              type="date"
              value={state.newDueDate}
              onChange={(e) => setState(prev => ({ ...prev, newDueDate: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={actions.closeDueDateDialog}>Cancelar</Button>
            <Button onClick={actions.confirmDueDateUpdate} disabled={actions.updateDueDate.isPending}>
              {actions.updateDueDate.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Alterar data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ClientGroup {
  key: string;
  name: string;
  total: number;
  overdue: number;
  receivable: number;
  payable: number;
  count: number;
  nextDue: OpenPayment | null;
  lastPaid: OpenPayment | null;
  items: OpenPayment[];
}

function buildGroups(openPayments: OpenPayment[], paidHistory: OpenPayment[]) {
  const paidByCounterparty = new Map<string, OpenPayment[]>();
  paidHistory.forEach(payment => {
    const key = payment.cliente_id || payment.entity?.name || payment.account?.name || '__none__';
    if (!paidByCounterparty.has(key)) paidByCounterparty.set(key, []);
    paidByCounterparty.get(key)!.push(payment);
  });

  const groups = new Map<string, ClientGroup>();
  openPayments.forEach(payment => {
    const key = payment.cliente_id || payment.entity?.name || payment.account?.name || '__none__';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: getCounterparty(payment),
        total: 0,
        overdue: 0,
        receivable: 0,
        payable: 0,
        count: 0,
        nextDue: null,
        lastPaid: null,
        items: [],
      });
    }
    const group = groups.get(key)!;
    group.total += Number(payment.valor) || 0;
    group.count += 1;
    group.items.push(payment);
    if (payment.tipo_movimento === 'ENTRADA') group.receivable += Number(payment.valor) || 0;
    else group.payable += Number(payment.valor) || 0;
    if (payment.due_bucket === 'overdue') group.overdue += Number(payment.valor) || 0;
    if (!group.nextDue || payment.data_vencimento < group.nextDue.data_vencimento) group.nextDue = payment;
  });

  groups.forEach(group => {
    const history = paidByCounterparty.get(group.key) || [];
    group.lastPaid = history.sort((a, b) => (b.data_pagamento || '').localeCompare(a.data_pagamento || ''))[0] || null;
    group.items.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  });

  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
}

interface PaymentTableProps {
  payments: OpenPayment[];
  isLoading: boolean;
  actions: ReturnType<typeof usePaymentActions>;
}

function PaymentTable({ payments, isLoading, actions }: PaymentTableProps) {
  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (!payments.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum lançamento encontrado para este filtro.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]">Tipo</TableHead>
          <TableHead>Descrição / cliente</TableHead>
          <TableHead>Origem</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[150px]">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map(payment => (
          <PaymentRow
            key={payment.id}
            payment={payment}
            onMarkPaid={actions.openPaymentDialog}
            onUpdateDueDate={actions.openDueDateDialog}
          />
        ))}
      </TableBody>
    </Table>
  );
}

export function OpenPaymentsView() {
  const [activeTab, setActiveTab] = useState<'all' | 'receivable' | 'payable' | 'overdue' | 'next_7' | 'next_30'>('all');
  const [search, setSearch] = useState('');
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const { data: stats } = useOpenPaymentStats();
  const actions = usePaymentActions();

  const filters: OpenPaymentFilters = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (activeTab === 'receivable') return { type: 'ENTRADA', status: 'all' };
    if (activeTab === 'payable') return { type: 'SAIDA', status: 'all' };
    if (activeTab === 'overdue') return { type: 'all', status: 'all', bucket: 'overdue' };
    if (activeTab === 'next_7') return { type: 'all', status: 'all', startDate: today, endDate: format(addDays(new Date(), 7), 'yyyy-MM-dd') };
    if (activeTab === 'next_30') return { type: 'all', status: 'all', startDate: today, endDate: format(addDays(new Date(), 30), 'yyyy-MM-dd') };
    return { type: 'all', status: 'all' };
  }, [activeTab]);

  const { data: payments = [], isLoading } = useOpenPayments(filters);
  const { data: paidHistory = [] } = useOpenPayments({ type: 'all', status: 'PAGO' as any });

  const visiblePayments = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return payments;
    return payments.filter(payment =>
      payment.descricao?.toLowerCase().includes(s) ||
      getCounterparty(payment).toLowerCase().includes(s) ||
      payment.category?.name?.toLowerCase().includes(s) ||
      payment.account?.name?.toLowerCase().includes(s)
    );
  }, [payments, search]);

  const groups = useMemo(() => buildGroups(visiblePayments, paidHistory), [visiblePayments, paidHistory]);
  const selectedGroup = groups.find(group => group.key === selectedGroupKey) || groups[0] || null;
  const tablePayments = selectedGroup ? selectedGroup.items : visiblePayments;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <KPICard
          title="A Receber"
          value={stats?.totalReceivable || 0}
          icon={ArrowDownCircle}
          type="income"
          subtitle={`${stats?.countReceivable || 0} parcelas abertas`}
        />
        <KPICard
          title="A Pagar"
          value={stats?.totalPayable || 0}
          icon={ArrowUpCircle}
          type="expense"
          subtitle={`${stats?.countPayable || 0} parcelas abertas`}
        />
        <KPICard
          title="Vencidos"
          value={stats?.totalOverdue || 0}
          icon={AlertTriangle}
          type="warning"
          subtitle={`${stats?.countOverdue || 0} pendência(s)`}
        />
        <KPICard
          title="Próximos 7 dias"
          value={stats?.totalNext7 || 0}
          icon={Clock}
          type="info"
          subtitle={`${stats?.countNext7 || 0} vencimento(s)`}
        />
        <KPICard
          title="Próximos 30 dias"
          value={(stats?.totalNext7 || 0) + (stats?.totalNext30 || 0)}
          icon={Calendar}
          type="default"
          subtitle={`${(stats?.countNext7 || 0) + (stats?.countNext30 || 0)} parcelas`}
        />
      </div>

      <Card className="overflow-hidden border-primary/20">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-slate-50">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5 text-primary" />
                Gestão por cliente / fornecedor
              </CardTitle>
              <CardDescription>
                Acompanhe quem tem parcelas abertas, vencidas, próximas a vencer e o último pagamento registrado.
              </CardDescription>
            </div>
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente, fornecedor, categoria ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(360px,0.9fr)_1.1fr] gap-4">
            <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
              {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : groups.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">Nenhum grupo em aberto.</div>
              ) : groups.map(group => {
                const selected = selectedGroup?.key === group.key;
                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setSelectedGroupKey(group.key)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition hover:border-primary/40 hover:bg-primary/5',
                      selected && 'border-primary bg-primary/10'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{group.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.count} parcela(s) • próximo: {group.nextDue ? format(parseISO(group.nextDue.data_vencimento), 'dd/MM/yyyy') : '-'}
                        </p>
                      </div>
                      <ChevronRight className={cn('w-4 h-4 mt-1 text-muted-foreground transition', selected && 'text-primary')} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Aberto</p>
                        <p className="font-bold">{formatCurrency(group.total)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Vencido</p>
                        <p className={cn('font-bold', group.overdue > 0 && 'text-destructive')}>{formatCurrency(group.overdue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Últ. pag.</p>
                        <p className="font-bold truncate">
                          {group.lastPaid?.data_pagamento ? format(parseISO(group.lastPaid.data_pagamento), 'dd/MM/yy') : '-'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border bg-card">
              <div className="border-b p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Detalhe gerencial</p>
                    <h3 className="text-xl font-bold">{selectedGroup?.name || 'Selecione um grupo'}</h3>
                  </div>
                  {selectedGroup && (
                    <Badge variant={selectedGroup.overdue > 0 ? 'destructive' : 'outline'}>
                      {selectedGroup.overdue > 0 ? 'Com atraso' : 'Em dia'}
                    </Badge>
                  )}
                </div>
                {selectedGroup && (
                  <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Total aberto</p>
                      <p className="font-bold">{formatCurrency(selectedGroup.total)}</p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="text-xs text-muted-foreground">Vencido</p>
                      <p className="font-bold text-destructive">{formatCurrency(selectedGroup.overdue)}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-3">
                      <p className="text-xs text-muted-foreground">A receber</p>
                      <p className="font-bold text-income">{formatCurrency(selectedGroup.receivable)}</p>
                    </div>
                    <div className="rounded-lg bg-orange-50 p-3">
                      <p className="text-xs text-muted-foreground">A pagar</p>
                      <p className="font-bold text-expense">{formatCurrency(selectedGroup.payable)}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="max-h-[390px] overflow-auto">
                <PaymentTable payments={selectedGroup?.items || []} isLoading={isLoading} actions={actions} />
              </div>
              {selectedGroup?.lastPaid && (
                <div className="border-t bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Último pagamento: {selectedGroup.lastPaid.descricao || 'Sem descrição'} em{' '}
                  {selectedGroup.lastPaid.data_pagamento ? format(parseISO(selectedGroup.lastPaid.data_pagamento), 'dd/MM/yyyy') : '-'}.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Planilha operacional
          </CardTitle>
          <CardDescription>
            Use para busca fina, quitação e alteração de vencimento. A visão acima organiza a gestão por cliente/fornecedor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 mb-4 h-auto">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="receivable">A receber</TabsTrigger>
              <TabsTrigger value="payable">A pagar</TabsTrigger>
              <TabsTrigger value="overdue">Vencidos</TabsTrigger>
              <TabsTrigger value="next_7">7 dias</TabsTrigger>
              <TabsTrigger value="next_30">30 dias</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab} className="mt-0">
              <PaymentTable payments={tablePayments} isLoading={isLoading} actions={actions} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <PaymentDialogs actions={actions} />
    </div>
  );
}
