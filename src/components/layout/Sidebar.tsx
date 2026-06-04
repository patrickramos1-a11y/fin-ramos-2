import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  LayoutDashboard, ArrowDownUp, Wallet, Users, Settings, FileSpreadsheet,
  BarChart3, ChevronLeft, ChevronRight, LogOut, Menu, RefreshCw,
  AlertCircle, ClipboardList, ChevronDown, ArrowDownCircle, ArrowUpCircle,
  FileText, Building2, ShieldCheck, PlusCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Logo } from '@/components/brand/Logo';
import { usePermissions } from '@/hooks/usePermissions';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  mobileOpen?: boolean;
  setMobileOpen?: (v: boolean) => void;
}

type SubMenuItem = { id: string; label: string; icon: React.ComponentType<{ className?: string }> };
type MenuItemType = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: 'new' | 'critical' | 'approval';
  subItems?: SubMenuItem[];
  adminOnly?: boolean;
};
type MenuSection = { id: string; label: string; items: MenuItemType[] };

function useApprovalCount() {
  return useQuery({
    queryKey: ['pending-approval-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'pendente' as any);
      if (error) return 0;
      return count || 0;
    },
    refetchInterval: 30000,
  });
}

const menuSections: MenuSection[] = [
  {
    id: 'principal',
    label: 'Principal',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'lancamento', label: 'Novo Lançamento', icon: PlusCircle },
      {
        id: 'transactions', label: 'Transações', icon: ArrowDownUp,
        subItems: [
          { id: 'transactions', label: 'Visão Geral', icon: ArrowDownUp },
          { id: 'entradas-recorrentes', label: 'Entradas Recorrentes', icon: RefreshCw },
          { id: 'entradas-avulsas', label: 'Entradas Avulsas', icon: ArrowDownCircle },
          { id: 'despesas-fixas', label: 'Despesas Fixas', icon: RefreshCw },
          { id: 'despesas-variaveis', label: 'Despesas Variáveis', icon: ArrowUpCircle },
        ],
      },
    ],
  },
  {
    id: 'gestao',
    label: 'Gestão',
    items: [
      { id: 'accounts', label: 'Contas', icon: Wallet },
      { id: 'open-payments', label: 'Em Aberto', icon: AlertCircle, badge: 'critical' },
      { id: 'approval', label: 'Aprovações', icon: ShieldCheck, badge: 'approval' },
      { id: 'recurring-contracts', label: 'Contratos', icon: RefreshCw },
      { id: 'reclassification', label: 'Reclassificação', icon: FileText },
    ],
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    items: [
      { id: 'reports', label: 'Análise & DRE', icon: BarChart3 },
    ],
  },
  {
    id: 'cadastros',
    label: 'Cadastros',
    items: [
      { id: 'clients', label: 'Clientes', icon: Users },
      { id: 'entities', label: 'Entidades', icon: Building2 },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    items: [
      { id: 'config', label: 'Configuração', icon: Settings },
      { id: 'import', label: 'Importar / Exportar', icon: FileSpreadsheet },
      { id: 'backlog', label: 'Backlog', icon: ClipboardList, badge: 'new', adminOnly: true },
    ],
  },
];

function SidebarContent({ 
  activeTab, onTabChange, collapsed, setCollapsed, isMobile = false 
}: { 
  activeTab: string; onTabChange: (tab: string) => void;
  collapsed: boolean; setCollapsed: (v: boolean) => void; isMobile?: boolean 
}) {
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['transactions']);
  const { profile, role, signOut, isAdmin } = useAuth();
  const { can } = usePermissions();
  const { data: pendingCount } = useApprovalCount();

  const toggleExpanded = (id: string) => {
    setExpandedMenus(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const handleMenuClick = (item: MenuItemType) => {
    if (item.subItems && !collapsed) {
      toggleExpanded(item.id);
    } else {
      onTabChange(item.id);
    }
  };

  const visibleSections = menuSections
    .map(s => ({
      ...s,
      items: s.items
        .filter(it => !it.adminOnly || isAdmin)
        .filter(it => can(it.id))
        .map(it => it.subItems
          ? { ...it, subItems: it.subItems.filter(si => can(si.id)) }
          : it
        ),
    }))
    .filter(s => s.items.length > 0);

  const renderItem = (item: MenuItemType) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id || (item.subItems && item.subItems.some(s => s.id === activeTab));
    const isExpanded = expandedMenus.includes(item.id);
    const hasSubItems = item.subItems && item.subItems.length > 0;

    return (
      <div key={item.id}>
        <button
          onClick={() => handleMenuClick(item)}
          className={cn(
            "nav-item w-full relative",
            isActive && !hasSubItems && "active",
            hasSubItems && isActive && "bg-sidebar-accent/50"
          )}
          title={collapsed && !isMobile ? item.label : undefined}
        >
          <Icon className="w-5 h-5 flex-shrink-0" />
          {(!collapsed || isMobile) && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge === 'critical' && (
                <span className="w-2 h-2 bg-expense rounded-full animate-pulse" />
              )}
              {item.badge === 'approval' && pendingCount && pendingCount > 0 ? (
                <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center">
                  {pendingCount}
                </span>
              ) : null}
              {item.badge === 'new' && (
                <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">Novo</span>
              )}
              {hasSubItems && (
                <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
              )}
            </>
          )}
          {collapsed && !isMobile && item.badge === 'approval' && pendingCount && pendingCount > 0 ? (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
              {pendingCount}
            </span>
          ) : null}
          {collapsed && !isMobile && item.badge === 'critical' && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-expense rounded-full animate-pulse" />
          )}
        </button>

        {hasSubItems && isExpanded && (!collapsed || isMobile) && (
          <div className="ml-4 mt-1 space-y-1 border-l-2 border-sidebar-border pl-3">
            {item.subItems!.map((subItem) => {
              const SubIcon = subItem.icon;
              const isSubActive = activeTab === subItem.id;
              return (
                <button
                  key={subItem.id}
                  onClick={() => onTabChange(subItem.id)}
                  className={cn("nav-item w-full text-sm py-2", isSubActive && "active")}
                >
                  <SubIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{subItem.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 lg:p-5 border-b border-sidebar-border">
        <div className="w-11 h-11 rounded-2xl bg-white/95 flex items-center justify-center flex-shrink-0 shadow-brand p-1">
          <Logo variant="symbol" className="w-full h-full object-contain" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="overflow-hidden">
            <h1 className="text-sidebar-foreground font-display font-bold text-base leading-tight tracking-tight">Ramos Engenharia</h1>
            <p className="text-sidebar-foreground/55 text-[11px] uppercase tracking-[0.14em]">Financeiro</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 lg:p-4 overflow-y-auto custom-scrollbar">
        {visibleSections.map((section, idx) => (
          <div key={section.id} className={cn(idx > 0 && "mt-4")}>
            {(!collapsed || isMobile) && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40">
                {section.label}
              </p>
            )}
            {collapsed && !isMobile && idx > 0 && (
              <div className="mx-3 mb-2 h-px bg-sidebar-border/60" />
            )}
            <div className="space-y-1">
              {section.items.map(renderItem)}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse button (desktop only) */}
      {!isMobile && (
        <div className="p-4 border-t border-sidebar-border">
          <button onClick={() => setCollapsed(!collapsed)} className="nav-item w-full justify-center">
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <><ChevronLeft className="w-5 h-5" /><span>Recolher</span></>}
          </button>
        </div>
      )}

      {/* User section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className={cn("flex items-center gap-3", collapsed && !isMobile && "justify-center")}>
          <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
            <span className="text-sidebar-foreground text-sm font-medium">
              {profile?.display_name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sidebar-foreground text-sm font-medium truncate">
                {profile?.display_name || 'Usuário'}
              </p>
              <p className="text-sidebar-foreground/60 text-xs truncate capitalize">
                {role === 'admin' ? '🔑 Administrador' : '💰 Financeiro'}
              </p>
            </div>
          )}
          {(!collapsed || isMobile) && (
            <button 
              onClick={signOut}
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ activeTab, onTabChange, mobileOpen, setMobileOpen }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isControlled = mobileOpen !== undefined && setMobileOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? mobileOpen : internalOpen;
  const setOpen = isControlled ? setMobileOpen : setInternalOpen;

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border h-14 flex items-center px-3 gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="p-2 hover:bg-muted rounded-lg"><Menu className="w-5 h-5" /></button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 bg-sidebar">
            <SidebarContent 
              activeTab={activeTab} 
              onTabChange={(tab) => { onTabChange(tab); setOpen(false); }}
              collapsed={false} setCollapsed={setCollapsed} isMobile
            />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white shadow-soft flex items-center justify-center flex-shrink-0 p-0.5 border border-border/40">
            <Logo variant="symbol" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="font-display font-bold text-foreground text-sm truncate">Ramos Engenharia</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Financeiro</span>
          </div>
        </div>
      </div>

      <aside className={cn(
        "hidden lg:flex fixed left-0 top-0 h-screen bg-sidebar flex-col border-r border-sidebar-border transition-all duration-300 z-50",
        collapsed ? "w-20" : "w-64"
      )}>
        <SidebarContent activeTab={activeTab} onTabChange={onTabChange} collapsed={collapsed} setCollapsed={setCollapsed} />
      </aside>
    </>
  );
}
