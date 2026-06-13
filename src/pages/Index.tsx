import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Login from '@/pages/Login';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { AccountsView } from '@/components/accounts/AccountsView';
import { AccountDetailPage } from '@/components/accounts/AccountDetailPage';
import { TransactionsHub } from '@/components/transactions/TransactionsHub';
import { EntradasRecorrentesPage } from '@/components/transactions/EntradasRecorrentesPage';
import { EntradasAvulsasPage } from '@/components/transactions/EntradasAvulsasPage';
import { DespesasFixasPage } from '@/components/transactions/DespesasFixasPage';
import { DespesasVariaveisPage } from '@/components/transactions/DespesasVariaveisPage';
import { LancamentoPage } from '@/components/transactions/LancamentoPage';
import { ClientsView } from '@/components/clients/ClientsView';
import { EntitiesView } from '@/components/entities/EntitiesView';
import { ImportExportView } from '@/components/import/ImportExportView';
import { ReportsView } from '@/components/reports/ReportsView';
import { RecurringContractsView } from '@/components/contracts/RecurringContractsView';
import { FinancialConfigView } from '@/components/config/FinancialConfigView';
import { OpenPaymentsView } from '@/components/open-payments/OpenPaymentsView';
import { BacklogView } from '@/components/backlog/BacklogView';
import { ReclassificationView } from '@/components/reclassification/ReclassificationView';
import { ApprovalView } from '@/components/approval/ApprovalView';
import { CreditCardInvoicesView } from '@/components/cards/CreditCardInvoicesView';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { PageTransition } from '@/components/feedback/PageTransition';
import { usePermissions } from '@/hooks/usePermissions';
import { NoAccess } from '@/components/feedback/NoAccess';
import { resolveModuleKey, MODULES } from '@/lib/modules';

const tabConfig: Record<string, { title: string; subtitle?: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Visão geral financeira' },
  accounts: { title: 'Contas', subtitle: 'Gestão de contas e saldos' },
  transactions: { title: 'Transações', subtitle: 'Lançamentos e movimentações' },
  'entradas-recorrentes': { title: 'Entradas Recorrentes', subtitle: 'Receita de contratos mensais' },
  'entradas-avulsas': { title: 'Entradas Avulsas', subtitle: 'Receitas pontuais e serviços' },
  'despesas-fixas': { title: 'Despesas Fixas', subtitle: 'Custos recorrentes mensais' },
  'despesas-variaveis': { title: 'Despesas Variáveis', subtitle: 'Gastos pontuais e variáveis' },
  lancamento: { title: 'Lançamento', subtitle: 'Criar e revisar últimos lançamentos' },
  'open-payments': { title: 'Em Aberto', subtitle: 'Controle de inadimplência' },
  'credit-cards': { title: 'Cartão', subtitle: 'Importação e conferência de faturas' },
  'recurring-contracts': { title: 'Contratos', subtitle: 'Gestão por salário mínimo' },
  reports: { title: 'Relatórios', subtitle: 'Análises e DRE' },
  clients: { title: 'Clientes', subtitle: 'Gerencie sua carteira' },
  entities: { title: 'Entidades', subtitle: 'Pessoas, fornecedores e grupos' },
  approval: { title: 'Aprovações', subtitle: 'Fluxo de aprovação financeira' },
  backlog: { title: 'Backlog', subtitle: 'Melhorias do produto' },
  config: { title: 'Configuração', subtitle: 'Estrutura financeira' },
  import: { title: 'Importar', subtitle: 'Dados em lote' },
  reclassification: { title: 'Reclassificação', subtitle: 'Correção em lote de categorias' },
};

const Index = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);

  const handleTabChange = (tab: string) => {
    setDetailAccountId(null);
    setActiveTab(tab);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    if (activeTab === 'accounts' && detailAccountId) {
      return (
        <AccountDetailPage
          accountId={detailAccountId}
          onBack={() => setDetailAccountId(null)}
          onSelectAccount={setDetailAccountId}
        />
      );
    }
    return <GatedContent activeTab={activeTab} setDetailAccountId={setDetailAccountId} />;
  };

  const { title, subtitle } = tabConfig[activeTab] || tabConfig.dashboard;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />
      
      <main className={cn(
        "transition-all duration-300",
        "pt-14 lg:pt-0",
        "pb-16 lg:pb-0",
        "lg:ml-64"
      )}>
        <Header title={title} subtitle={subtitle} />
        
        <div className="p-3 lg:p-8">
          <PageTransition routeKey={`${activeTab}:${detailAccountId ?? ''}`}>
            {renderContent()}
          </PageTransition>
        </div>
      </main>

      <MobileBottomNav 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
        onMenuOpen={() => setMobileMenuOpen(true)}
      />
    </div>
  );
};

function GatedContent({ activeTab, setDetailAccountId }: { activeTab: string; setDetailAccountId: (id: string | null) => void }) {
  const { can } = usePermissions();
  if (!can(activeTab)) {
    const mod = MODULES.find(m => m.key === resolveModuleKey(activeTab));
    return <NoAccess moduleLabel={mod?.label} />;
  }
  switch (activeTab) {
    case 'dashboard': return <Dashboard />;
    case 'accounts': return <AccountsView onOpenDetail={setDetailAccountId} />;
    case 'transactions': return <TransactionsHub />;
    case 'entradas-recorrentes': return <EntradasRecorrentesPage />;
    case 'entradas-avulsas': return <EntradasAvulsasPage />;
    case 'despesas-fixas': return <DespesasFixasPage />;
    case 'despesas-variaveis': return <DespesasVariaveisPage />;
    case 'lancamento': return <LancamentoPage />;
    case 'open-payments': return <OpenPaymentsView />;
    case 'credit-cards': return <CreditCardInvoicesView />;
    case 'recurring-contracts': return <RecurringContractsView />;
    case 'reports': return <ReportsView />;
    case 'clients': return <ClientsView />;
    case 'entities': return <EntitiesView />;
    case 'approval': return <ApprovalView />;
    case 'backlog': return <BacklogView />;
    case 'config': return <FinancialConfigView />;
    case 'import': return <ImportExportView />;
    case 'reclassification': return <ReclassificationView />;
    default: return <Dashboard />;
  }
}

export default Index;
