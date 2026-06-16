import { useEffect, useState, useMemo } from 'react';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Filter,
  Settings2,
  Trash2,
  LayoutGrid,
  List,
  FileText,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  useRecurringContracts, 
  useRecurringInstallments, 
  useRecurringKPIs,
  useMarkInstallmentPaid,
  useCancelContract,
  useContractPlans,
  RecurringInstallment
} from '@/hooks/useRecurringContracts';
import { formatCurrency } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { MinimumWageConfigModal } from './MinimumWageConfigModal';
import { ConfirmModal } from '@/components/modals/ConfirmModal';
import { toast } from 'sonner';
import { ContractDocumentsView } from './ContractDocumentsView';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface RecurringContractsViewProps {
  activeSection?: string;
}

export function RecurringContractsView({ activeSection }: RecurringContractsViewProps) {
  const currentYear = new Date().getFullYear();
  const [contractMode, setContractMode] = useState<'financial' | 'documents'>(
    activeSection === 'documents' ? 'documents' : 'financial'
  );
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ contractId: string; clientName: string } | null>(null);
  const { kpis, isLoading: loadingKPIs } = useRecurringKPIs(selectedYear);
  const { data: contracts, isLoading: loadingContracts } = useRecurringContracts();
  const { data: plans } = useContractPlans();
  const { data: installments, isLoading: loadingInstallments } = useRecurringInstallments({
    year: selectedYear,
    month: selectedMonth || undefined,
    status: statusFilter || undefined,
  });
  const markPaidMutation = useMarkInstallmentPaid();
  const cancelContract = useCancelContract();

  const isLoading = loadingKPIs || loadingContracts || loadingInstallments;

  useEffect(() => {
    setContractMode(activeSection === 'documents' ? 'documents' : 'financial');
  }, [activeSection]);

  // Group contracts by plan
  const contractsByPlan = useMemo(() => {
    if (!contracts || !installments) return [];

    const planMap = new Map<string, {
      planName: string;
      planId: string;
      factor: number;
      clients: {
        clientName: string;
        contractId: string;
        clientId: string;
        factor: number;
        installments: RecurringInstallment[];
        totalExpected: number;
        totalPaid: number;
      }[];
      totalExpected: number;
      totalPaid: number;
      totalClients: number;
    }>();

    // Group installments by contract
    const instByContract = new Map<string, RecurringInstallment[]>();
    installments.forEach(inst => {
      const cid = inst.contract_id;
      if (!instByContract.has(cid)) instByContract.set(cid, []);
      instByContract.get(cid)!.push(inst);
    });

    contracts.forEach(contract => {
      const planName = contract.plan?.name || 'Sem Plano';
      const planId = contract.plan_id || 'no-plan';
      const factor = contract.custom_minimum_wage_factor || contract.plan?.minimum_wage_factor || 0;
      const contractInstallments = instByContract.get(contract.id) || [];
      
      if (!planMap.has(planId)) {
        planMap.set(planId, {
          planName,
          planId,
          factor,
          clients: [],
          totalExpected: 0,
          totalPaid: 0,
          totalClients: 0,
        });
      }

      const plan = planMap.get(planId)!;
      const totalExpected = contractInstallments.reduce((s, i) => s + Number(i.expected_value), 0);
      const totalPaid = contractInstallments.reduce((s, i) => s + (Number(i.paid_value) || 0), 0);

      plan.clients.push({
        clientName: contract.client?.name || 'N/A',
        contractId: contract.id,
        clientId: contract.client_id,
        factor,
        installments: contractInstallments,
        totalExpected,
        totalPaid,
      });
      plan.totalExpected += totalExpected;
      plan.totalPaid += totalPaid;
      plan.totalClients++;
    });

    return Array.from(planMap.values()).sort((a, b) => b.totalExpected - a.totalExpected);
  }, [contracts, installments]);

  const handleMarkPaid = async (installment: RecurringInstallment) => {
    try {
      await markPaidMutation.mutateAsync({
        installmentId: installment.id,
        paidValue: Number(installment.expected_value),
      });
      toast.success('Pagamento registrado com sucesso!');
    } catch (error) {
      toast.error('Erro ao registrar pagamento');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAGO':
        return <Badge variant="outline" className="bg-income/10 text-income border-income/20 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" /> Pago</Badge>;
      case 'ATRASADO':
        return <Badge variant="outline" className="bg-expense/10 text-expense border-expense/20 text-xs"><AlertCircle className="w-3 h-3 mr-1" /> Atrasado</Badge>;
      default:
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs"><Calendar className="w-3 h-3 mr-1" /> Em Aberto</Badge>;
    }
  };

  const modeTabs = (
    <div className="flex flex-wrap gap-2 rounded-2xl bg-muted/60 p-1 w-fit">
      <button
        onClick={() => setContractMode('financial')}
        className={cn(
          'px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2',
          contractMode === 'financial' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <RefreshCw className="w-4 h-4" />
        Financeiro recorrente
      </button>
      <button
        onClick={() => setContractMode('documents')}
        className={cn(
          'px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2',
          contractMode === 'documents' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <FileText className="w-4 h-4" />
        Documentos digitais
      </button>
    </div>
  );

  if (contractMode === 'documents') {
    return (
      <div className="space-y-6">
        {modeTabs}
        <ContractDocumentsView />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {modeTabs}
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {modeTabs}

      {/* Header Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="form-input w-32"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">
            SM: {formatCurrency(kpis.minimumWageValue)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('cards')}
              className={cn("p-2 transition-colors", viewMode === 'cards' ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn("p-2 transition-colors", viewMode === 'table' ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button 
            onClick={() => setShowConfigModal(true)}
            className="btn-secondary"
          >
            <Settings2 className="w-4 h-4" />
            Configurar SM
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card kpi-card-info">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-info-muted flex items-center justify-center">
              <Users className="w-6 h-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Clientes Ativos</p>
              <p className="text-2xl font-bold text-foreground">{kpis.totalClients}</p>
            </div>
          </div>
        </div>

        <div className="kpi-card kpi-card-income">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-income-muted flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-income" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total SM/mês</p>
              <p className="text-2xl font-bold text-foreground">{kpis.totalMinimumWagesMonthly.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(kpis.expectedValueMonthly)}/mês</p>
            </div>
          </div>
        </div>

        <div className="kpi-card kpi-card-income">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-income-muted flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-income" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Esperado Anual</p>
              <p className="text-2xl font-bold text-income">{formatCurrency(kpis.expectedValueYearly)}</p>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Status Financeiro</p>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-income">Pago</span>
                <span className="font-semibold">{formatCurrency(kpis.paidValue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-warning">Em Aberto</span>
                <span className="font-semibold">{formatCurrency(kpis.openValue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-expense">Atrasado</span>
                <span className="font-semibold">{formatCurrency(kpis.overdueValue)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overdue Alert */}
      {kpis.overdueClients.length > 0 && (
        <div className="bg-expense-muted border border-expense/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-expense" />
            <span className="font-semibold text-expense">Inadimplentes ({kpis.overdueClients.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {kpis.overdueClients.slice(0, 6).map((client, idx) => (
              <div key={idx} className="flex justify-between text-sm bg-card rounded-lg p-2">
                <span className="truncate">{client.clientName}</span>
                <span className="text-expense font-medium">{MONTHS[client.month - 1]} - {formatCurrency(client.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <button onClick={() => setSelectedMonth(null)} className={cn("filter-pill", !selectedMonth && "active")}>Todos</button>
        {MONTHS.map((month, idx) => (
          <button key={month} onClick={() => setSelectedMonth(idx + 1)} className={cn("filter-pill", selectedMonth === idx + 1 && "active")}>{month}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setStatusFilter(null)} className={cn("filter-pill", !statusFilter && "active")}>Todos</button>
        <button onClick={() => setStatusFilter('PAGO')} className={cn("filter-pill", statusFilter === 'PAGO' && "active")}><CheckCircle2 className="w-3 h-3" /> Pagos</button>
        <button onClick={() => setStatusFilter('EM_ABERTO')} className={cn("filter-pill", statusFilter === 'EM_ABERTO' && "active")}><Calendar className="w-3 h-3" /> Em Aberto</button>
        <button onClick={() => setStatusFilter('ATRASADO')} className={cn("filter-pill", statusFilter === 'ATRASADO' && "active")}><AlertCircle className="w-3 h-3" /> Atrasados</button>
      </div>

      {/* Cards by Plan View */}
      {viewMode === 'cards' ? (
        <div className="space-y-6">
          {contractsByPlan.map(plan => (
            <Card key={plan.planId} className="overflow-hidden">
              <CardHeader 
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedPlan(expandedPlan === plan.planId ? null : plan.planId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-sm px-3 py-1">
                      {plan.planName}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{plan.totalClients} cliente(s)</span>
                    <span className="text-sm text-muted-foreground">• Fator: {plan.factor.toFixed(2)} SM</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Faturamento no período</p>
                      <p className="text-lg font-bold text-income">{formatCurrency(plan.totalExpected)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Recebido</p>
                      <p className="text-lg font-bold text-foreground">{formatCurrency(plan.totalPaid)}</p>
                    </div>
                    {expandedPlan === plan.planId ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </CardHeader>
              {expandedPlan === plan.planId && (
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 text-xs font-medium">Cliente</th>
                          <th className="text-center p-3 text-xs font-medium">Fator SM</th>
                          <th className="text-center p-3 text-xs font-medium">Competência</th>
                          <th className="text-right p-3 text-xs font-medium">Valor Esperado</th>
                          <th className="text-center p-3 text-xs font-medium">Status</th>
                          <th className="text-right p-3 text-xs font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {plan.clients.map(client => 
                          client.installments.map((inst, idx) => (
                            <tr key={inst.id} className="hover:bg-muted/30">
                              <td className="p-3 font-medium text-sm">{idx === 0 ? client.clientName : ''}</td>
                              <td className="p-3 text-center text-sm">{client.factor.toFixed(2)}</td>
                              <td className="p-3 text-center text-sm">{MONTHS[inst.competence_month - 1]}/{inst.competence_year}</td>
                              <td className="p-3 text-right font-medium text-sm">{formatCurrency(Number(inst.expected_value))}</td>
                              <td className="p-3 text-center">{getStatusBadge(inst.status)}</td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {inst.status !== 'PAGO' && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleMarkPaid(inst)} disabled={markPaidMutation.isPending}>
                                      Marcar Pago
                                    </Button>
                                  )}
                                  {idx === 0 && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-muted-foreground hover:text-expense"
                                      onClick={(e) => { e.stopPropagation(); setCancelTarget({ contractId: client.contractId, clientName: client.clientName }); }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
          {contractsByPlan.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum contrato encontrado para os filtros selecionados.
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Table View (original style) */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium">Cliente</th>
                    <th className="text-left p-4 text-sm font-medium">Plano</th>
                    <th className="text-center p-4 text-sm font-medium">Fator SM</th>
                    <th className="text-right p-4 text-sm font-medium">Valor Mensal</th>
                    <th className="text-center p-4 text-sm font-medium">Competência</th>
                    <th className="text-center p-4 text-sm font-medium">Status</th>
                    <th className="text-right p-4 text-sm font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contractsByPlan.flatMap(plan =>
                    plan.clients.flatMap(client =>
                      client.installments.map((inst) => (
                        <tr key={inst.id} className="hover:bg-muted/30">
                          <td className="p-4 font-medium text-sm">{client.clientName}</td>
                          <td className="p-4">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                              {plan.planName}
                            </Badge>
                          </td>
                          <td className="p-4 text-center text-sm">{client.factor.toFixed(2)}</td>
                          <td className="p-4 text-right font-medium text-sm">{formatCurrency(Number(inst.expected_value))}</td>
                          <td className="p-4 text-center text-sm">{MONTHS[inst.competence_month - 1]}/{inst.competence_year}</td>
                          <td className="p-4 text-center">{getStatusBadge(inst.status)}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {inst.status !== 'PAGO' && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleMarkPaid(inst)} disabled={markPaidMutation.isPending}>
                                  Marcar Pago
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-expense"
                                onClick={() => setCancelTarget({ contractId: client.contractId, clientName: client.clientName })}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Summary Cards */}
      {contractsByPlan.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contractsByPlan.map(plan => (
            <Card key={`summary-${plan.planId}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-primary/10 text-primary border-primary/20">{plan.planName}</Badge>
                  <span className="text-xs text-muted-foreground">{plan.totalClients} cliente(s)</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Faturamento</span>
                    <span className="font-bold text-income">{formatCurrency(plan.totalExpected)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Recebido</span>
                    <span className="font-bold">{formatCurrency(plan.totalPaid)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-income rounded-full h-2 transition-all" 
                      style={{ width: `${plan.totalExpected > 0 ? Math.min((plan.totalPaid / plan.totalExpected) * 100, 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    {plan.totalExpected > 0 ? ((plan.totalPaid / plan.totalExpected) * 100).toFixed(0) : 0}% recebido
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Config Modal */}
      <MinimumWageConfigModal
        open={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />

      {/* Cancel Contract Confirm */}
      <ConfirmModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (cancelTarget) {
            await cancelContract.mutateAsync({ contractId: cancelTarget.contractId, deleteTransactions: true });
            setCancelTarget(null);
          }
        }}
        title="Cancelar Contrato"
        message={`Deseja cancelar o contrato de "${cancelTarget?.clientName}"? Todas as parcelas em aberto e suas transações serão removidas. Parcelas já pagas serão mantidas.`}
        confirmText="Sim, cancelar contrato"
        type="danger"
      />
    </div>
  );
}
