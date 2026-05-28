import { useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  TrendingUp,
  AlertTriangle,
  FileText,
  Edit,
  MoreHorizontal,
  Loader2,
  ReceiptText,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { ClientModal, ClientRecord } from '@/components/modals/ClientModal';
import { toast } from 'sonner';
import { EmptyState } from '@/components/feedback/EmptyState';

type ContractFiscalRule = 'SEMPRE' | 'NUNCA';

export function ClientsView() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['recurring_clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_clients')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as ClientRecord[];
    },
  });

  const { data: txAgg = {} } = useQuery({
    queryKey: ['clients_tx_agg'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('cliente_id, valor, valor_pago, status, tipo_movimento')
        .eq('tipo_movimento', 'ENTRADA');
      if (error) throw error;
      const map: Record<string, { revenue: number; pending: number; overdue: number; count: number }> = {};
      for (const t of data || []) {
        const cid = (t as any).cliente_id as string | null;
        if (!cid) continue;
        if (!map[cid]) map[cid] = { revenue: 0, pending: 0, overdue: 0, count: 0 };
        map[cid].count++;
        const val = Number((t as any).valor_pago ?? (t as any).valor ?? 0);
        if ((t as any).status === 'PAGO') map[cid].revenue += val;
        else map[cid].pending += val;
        if ((t as any).status === 'ATRASADO') map[cid].overdue += val;
      }
      return map;
    },
  });

  const { data: contractsByClient = {} } = useQuery({
    queryKey: ['clients_contracts_fiscal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_contracts')
        .select(`
          id,
          client_id,
          active,
          exigir_emissao_nf,
          start_date,
          plan:contract_plans(name, minimum_wage_factor)
        `)
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const map: Record<string, any[]> = {};
      for (const contract of data || []) {
        const clientId = (contract as any).client_id;
        if (!map[clientId]) map[clientId] = [];
        map[clientId].push(contract);
      }
      return map;
    },
  });

  const updateContractFiscal = useMutation({
    mutationFn: async ({
      contractId,
      rule,
      scope,
    }: {
      contractId: string;
      rule: ContractFiscalRule;
      scope: 'future' | 'all';
    }) => {
      const documentValue = rule === 'SEMPRE' ? 'NOTA_FISCAL' : 'SEM_DOCUMENTO';
      const { error: contractError } = await supabase
        .from('recurring_contracts')
        .update({ exigir_emissao_nf: rule })
        .eq('id', contractId);
      if (contractError) throw contractError;

      const installmentsQuery = supabase
        .from('recurring_installments')
        .select('id')
        .eq('contract_id', contractId);
      const { data: installments, error: installmentsError } = scope === 'future'
        ? await installmentsQuery.neq('status', 'PAGO')
        : await installmentsQuery;
      if (installmentsError) throw installmentsError;

      const installmentIds = (installments || []).map((i) => i.id);
      if (installmentIds.length > 0) {
        const { error: txError } = await supabase
          .from('transactions')
          .update({
            documento_recebimento: documentValue,
            documento_tipo: rule === 'SEMPRE' ? 'NF' : 'SEM_DOCUMENTO',
          })
          .in('installment_id', installmentIds);
        if (txError) throw txError;
      }

      return { count: installmentIds.length };
    },
    onSuccess: ({ count }) => {
      qc.invalidateQueries({ queryKey: ['clients_contracts_fiscal'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      toast.success(`Regra fiscal atualizada em ${count} lançamento(s).`);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar regra fiscal: ${error.message}`);
    },
  });

  const enriched = useMemo(
    () =>
      clients.map((c) => ({
        ...c,
        stats: txAgg[c.id!] || { revenue: 0, pending: 0, overdue: 0, count: 0 },
        contracts: contractsByClient[c.id!] || [],
      })),
    [clients, txAgg, contractsByClient]
  );

  const filteredClients = enriched.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const withPending = enriched.filter((c) => c.stats.pending > 0).length;

  const openNewClient = () => {
    setEditingClient(null);
    setShowModal(true);
  };

  const openEditClient = (client: ClientRecord) => {
    setEditingClient(client);
    setShowModal(true);
  };

  const handleViewContracts = (client: ClientRecord) => {
    toast.info(`Visualizando contratos de ${client.name}`);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="kpi-card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Clientes</p>
              <p className="text-2xl font-bold text-foreground">{clients.length}</p>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-income/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-income" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ativos</p>
              <p className="text-2xl font-bold text-income">
                {clients.filter((c) => c.active !== false).length}
              </p>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-expense/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-expense" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Com Pendências</p>
              <p className="text-2xl font-bold text-expense">{withPending}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-10"
          />
        </div>
        <button className="btn-primary" onClick={openNewClient}>
          <Plus className="w-4 h-4" />
          Novo Cliente
        </button>
      </div>

      {/* Loading / Empty / Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando clientes...
        </div>
      ) : filteredClients.length === 0 ? (
        <EmptyState
          title={search ? 'Nenhum cliente encontrado' : 'Sem clientes cadastrados'}
          description={search ? 'Tente outro termo de busca.' : 'Crie o primeiro cliente para começar.'}
          icon={Users}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <div
              key={client.id}
              className="bg-card rounded-xl border border-border/50 p-5 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-primary">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{client.name}</h3>
                    {client.document && (
                      <span className="text-xs text-muted-foreground">{client.document}</span>
                    )}
                  </div>
                </div>
                <button
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  onClick={() => openEditClient(client)}
                >
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Receita Total
                  </span>
                  <span className="font-semibold text-income">
                    {formatCurrency(client.stats.revenue)}
                  </span>
                </div>

                {client.stats.pending > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Em Aberto
                    </span>
                    <span className="font-semibold text-warning">
                      {formatCurrency(client.stats.pending)}
                    </span>
                  </div>
                )}

                {client.stats.overdue > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-expense" />
                      Atrasado
                    </span>
                    <span className="font-semibold text-expense">
                      {formatCurrency(client.stats.overdue)}
                    </span>
                  </div>
                )}
              </div>

              {client.contracts.length > 0 && (
                <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <ReceiptText className="w-3.5 h-3.5" />
                    Contratos ativos
                  </div>
                  {client.contracts.map((contract: any) => {
                    const fiscalRule: ContractFiscalRule =
                      contract.exigir_emissao_nf === 'SEMPRE' ? 'SEMPRE' : 'NUNCA';
                    return (
                      <div key={contract.id} className="rounded-md border bg-background p-2 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {contract.plan?.name || 'Contrato personalizado'}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Início {new Date(contract.start_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <select
                            className="form-input h-8 w-36 text-xs"
                            value={fiscalRule}
                            disabled={updateContractFiscal.isPending}
                            onChange={(event) => {
                              const rule = event.target.value as ContractFiscalRule;
                              const scope = window.confirm('Aplicar também aos lançamentos já pagos/passados?')
                                ? 'all'
                                : 'future';
                              updateContractFiscal.mutate({ contractId: contract.id, rule, scope });
                            }}
                          >
                            <option value="SEMPRE">Com NF</option>
                            <option value="NUNCA">Sem NF</option>
                          </select>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Ao alterar, confirme OK para todos os lançamentos; Cancelar aplica só aos futuros/em aberto.
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
                <button className="btn-ghost flex-1 text-sm" onClick={() => handleViewContracts(client)}>
                  <FileText className="w-4 h-4" />
                  Contratos
                </button>
                <button
                  className="btn-secondary flex-1 text-sm"
                  onClick={() => openEditClient(client)}
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ClientModal
        open={showModal}
        onClose={() => setShowModal(false)}
        client={editingClient}
      />
    </div>
  );
}
