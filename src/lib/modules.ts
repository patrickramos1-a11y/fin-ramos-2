// Catálogo único de módulos do sistema (chaves alinhadas ao activeTab em Index.tsx).
// Fonte da verdade para sidebar, bottom-nav e tela de permissões.

export type ModuleKey =
  | 'dashboard'
  | 'lancamento'
  | 'transactions'
  | 'accounts'
  | 'open-payments'
  | 'credit-cards'
  | 'approval'
  | 'recurring-contracts'
  | 'reclassification'
  | 'reports'
  | 'clients'
  | 'entities'
  | 'config'
  | 'import'
  | 'backlog';

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  section: 'Principal' | 'Gestão' | 'Relatórios' | 'Cadastros' | 'Sistema';
  /** Default para usuários "financeiro" quando não há permissões cadastradas. */
  defaultFinanceiro: boolean;
  description?: string;
}

export const MODULES: ModuleDef[] = [
  { key: 'dashboard', label: 'Dashboard', section: 'Principal', defaultFinanceiro: true },
  { key: 'lancamento', label: 'Novo Lançamento', section: 'Principal', defaultFinanceiro: true },
  { key: 'transactions', label: 'Transações', section: 'Principal', defaultFinanceiro: true, description: 'Inclui sub-páginas (recorrentes, avulsas, fixas, variáveis)' },

  { key: 'accounts', label: 'Contas', section: 'Gestão', defaultFinanceiro: true },
  { key: 'open-payments', label: 'Em Aberto', section: 'Gestão', defaultFinanceiro: true },
  { key: 'credit-cards', label: 'Cartão', section: 'Gestão', defaultFinanceiro: true, description: 'Importação e conferência de faturas de cartão' },
  { key: 'approval', label: 'Aprovações', section: 'Gestão', defaultFinanceiro: true },
  { key: 'recurring-contracts', label: 'Contratos Recorrentes', section: 'Gestão', defaultFinanceiro: true },
  { key: 'reclassification', label: 'Reclassificação', section: 'Gestão', defaultFinanceiro: false },

  { key: 'reports', label: 'Análise & DRE', section: 'Relatórios', defaultFinanceiro: true },

  { key: 'clients', label: 'Clientes', section: 'Cadastros', defaultFinanceiro: true },
  { key: 'entities', label: 'Entidades', section: 'Cadastros', defaultFinanceiro: true },

  { key: 'config', label: 'Configuração', section: 'Sistema', defaultFinanceiro: false },
  { key: 'import', label: 'Importar / Exportar', section: 'Sistema', defaultFinanceiro: false },
  { key: 'backlog', label: 'Backlog', section: 'Sistema', defaultFinanceiro: false },
];

export const MODULES_BY_SECTION = MODULES.reduce<Record<string, ModuleDef[]>>((acc, m) => {
  (acc[m.section] = acc[m.section] || []).push(m);
  return acc;
}, {});

/** Mapeia sub-páginas para seu módulo "pai" (todas herdam de transactions). */
const SUB_TO_PARENT: Record<string, ModuleKey> = {
  'entradas-recorrentes': 'transactions',
  'entradas-avulsas': 'transactions',
  'despesas-fixas': 'transactions',
  'despesas-variaveis': 'transactions',
  'contract-documents': 'recurring-contracts',
};

export function resolveModuleKey(tab: string): ModuleKey {
  return (SUB_TO_PARENT[tab] ?? tab) as ModuleKey;
}
