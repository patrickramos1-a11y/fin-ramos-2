import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Building2, 
  Wallet, 
  Landmark, 
  Tags, 
  Target, 
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Loader2,
  Users,
  Search,
  ArrowUpDown,
  Filter,
  ShieldCheck,
} from 'lucide-react';
import { getEntityIcon, getEntityColor } from '@/utils/entityIcons';
import { getBankBrand } from '@/lib/financial/bank-brand';
import { useAuth } from '@/hooks/useAuth';
import { UserPermissionsView } from '@/components/settings/UserPermissionsView';
import { 
  useCompanies,
  useAccounts,
  useAccountCategories,
  useCostCenters,
  useTransactionCategories,
  usePaymentMethods,
  useCreateCompany,
  useUpdateCompany,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  useCreateAccountCategory,
  useUpdateAccountCategory,
  useDeleteAccountCategory,
  useCreateCostCenter,
  useUpdateCostCenter,
  useCreateTransactionCategory,
  useUpdateTransactionCategory,
  useDeleteTransactionCategory,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
  type FinancialCompany,
  type Account,
  type AccountCategory,
  type CostCenter,
  type TransactionCategory,
  type PaymentMethod,
  useBulkUpdateTransactionCategories,
  useBulkDeleteTransactionCategories,
  type CategorySubtype,
} from '@/hooks/useFinancialConfig';
import { useRecurringContracts, useContractPlans, useCreateContractPlan, useUpdateContractPlan, type ContractPlan } from '@/hooks/useRecurringContracts';
import { MinimumWageConfigModal } from '@/components/contracts/MinimumWageConfigModal';
import { useFiscalConfig, useUpdateFiscalConfig } from '@/hooks/useFiscalConfig';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// =============================================
// COMPANIES TAB
// =============================================

function CompaniesTab() {
  const { data: companies, isLoading } = useCompanies();
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const [editingCompany, setEditingCompany] = useState<FinancialCompany | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', cnpj: '', active: true });

  const handleSubmit = () => {
    if (editingCompany) {
      updateCompany.mutate({ id: editingCompany.id, ...formData }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setEditingCompany(null);
        }
      });
    } else {
      createCompany.mutate(formData, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setFormData({ name: '', cnpj: '', active: true });
        }
      });
    }
  };

  const openEdit = (company: FinancialCompany) => {
    setEditingCompany(company);
    setFormData({ name: company.name, cnpj: company.cnpj || '', active: company.active });
    setIsDialogOpen(true);
  };

  const openNew = () => {
    setEditingCompany(null);
    setFormData({ name: '', cnpj: '', active: true });
    setIsDialogOpen(true);
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">Gerencie as empresas/fontes financeiras do sistema.</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nova Empresa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCompany ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
              <DialogDescription>Preencha os dados da empresa.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome da empresa"
                />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input 
                  value={formData.cnpj} 
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.active} 
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label>Ativa</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!formData.name}>
                {editingCompany ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies?.map((company) => {
            const Icon = getEntityIcon(company.name);
            const color = getEntityColor(company.name);
            return (
            <TableRow key={company.id}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <span className="font-medium" style={{ color }}>{company.name}</span>
                </div>
              </TableCell>
              <TableCell>{company.cnpj || '-'}</TableCell>
              <TableCell>
                <Badge variant={company.active ? 'default' : 'secondary'}>
                  {company.active ? 'Ativa' : 'Inativa'}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => openEdit(company)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
            );
          })}
          {companies?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                Nenhuma empresa cadastrada
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// =============================================
// ACCOUNTS TAB
// =============================================

function AccountsTab() {
  const { data: accounts, isLoading } = useAccounts();
  const { data: accountCategories } = useAccountCategories();
  const { data: transactionCategories } = useTransactionCategories();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const updateTransactionCategory = useUpdateTransactionCategory();
  const createTransactionCategory = useCreateTransactionCategory();
  const { data: costCenters } = useCostCenters();
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [linkDialogAccountId, setLinkDialogAccountId] = useState<string | null>(null);
  const [newCatDialogAccountId, setNewCatDialogAccountId] = useState<string | null>(null);
  const [newCatForm, setNewCatForm] = useState({
    name: '',
    cost_center_id: '',
    type: 'SAIDA' as 'ENTRADA' | 'SAIDA',
    subtype: '' as string,
    color: '#6366f1',
  });
  const [formData, setFormData] = useState({
    name: '',
    bank: '',
    category_id: '',
    initial_balance: 0,
    active: true
  });

  const toggleExpand = (id: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getCategoriesForAccount = (accountId: string) => {
    return transactionCategories?.filter(c => c.default_account_id === accountId) || [];
  };

  const getUnlinkedCategories = () => {
    return transactionCategories?.filter(c => !c.default_account_id && c.active) || [];
  };

  const handleLinkCategory = (categoryId: string, accountId: string) => {
    updateTransactionCategory.mutate({ id: categoryId, default_account_id: accountId } as any);
  };

  const handleUnlinkCategory = (categoryId: string) => {
    updateTransactionCategory.mutate({ id: categoryId, default_account_id: null } as any);
  };

  const handleCreateAndLink = (accountId: string) => {
    if (!newCatForm.name || !newCatForm.cost_center_id) return;
    const subtypeMap: Record<string, string> = {
      'ENTRADA-RECORRENTE': 'RECORRENTE',
      'ENTRADA-AVULSA': 'AVULSA',
      'SAIDA-FIXA': 'FIXA',
      'SAIDA-VARIAVEL': 'VARIAVEL',
    };
    const key = `${newCatForm.type}-${newCatForm.subtype}`;
    createTransactionCategory.mutate({
      name: newCatForm.name,
      cost_center_id: newCatForm.cost_center_id,
      type: newCatForm.type,
      subtype: (subtypeMap[key] || newCatForm.subtype) as any,
      default_account_id: accountId,
      color: newCatForm.color,
      active: true,
    }, {
      onSuccess: () => {
        setNewCatDialogAccountId(null);
        setNewCatForm({ name: '', cost_center_id: '', type: 'SAIDA', subtype: '', color: '#6366f1' });
      }
    });
  };

  const SUBTYPE_LABELS: Record<string, string> = {
    RECORRENTE: 'Entrada Recorrente',
    AVULSA: 'Entrada Avulsa',
    FIXA: 'Despesa Fixa',
    VARIAVEL: 'Despesa Variável',
  };

  const handleSubmit = () => {
    const payload = {
      ...formData,
      category_id: formData.category_id || null,
    };

    if (editingAccount) {
      updateAccount.mutate({ id: editingAccount.id, ...payload }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setEditingAccount(null);
        }
      });
    } else {
      createAccount.mutate({ ...payload, current_balance: formData.initial_balance }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setFormData({ name: '', bank: '', category_id: '', initial_balance: 0, active: true });
        }
      });
    }
  };

  const openEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      bank: account.bank || '',
      category_id: account.category_id || '',
      initial_balance: account.initial_balance,
      active: account.active
    });
    setIsDialogOpen(true);
  };

  const openNew = () => {
    setEditingAccount(null);
    setFormData({ name: '', bank: '', category_id: '', initial_balance: 0, active: true });
    setIsDialogOpen(true);
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">Contas bancárias e carteiras — expanda para ver categorias vinculadas.</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nova Conta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome da conta"
                />
              </div>
              <div className="space-y-2">
                <Label>Banco</Label>
                <Input 
                  value={formData.bank} 
                  onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                  placeholder="Nome do banco"
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountCategories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Saldo Inicial</Label>
                <Input 
                  type="number"
                  value={formData.initial_balance} 
                  onChange={(e) => setFormData({ ...formData, initial_balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.active} 
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label>Ativa</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!formData.name}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Link existing category dialog */}
      <Dialog open={!!linkDialogAccountId} onOpenChange={(open) => !open && setLinkDialogAccountId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Categoria Existente</DialogTitle>
            <DialogDescription>Selecione categorias sem vínculo para adicionar a esta conta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto py-2">
            {getUnlinkedCategories().length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Todas as categorias já estão vinculadas.</p>
            ) : (
              getUnlinkedCategories().map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#6366f1' }} />
                    <span className="text-sm font-medium">{cat.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {SUBTYPE_LABELS[cat.subtype || ''] || cat.type}
                    </Badge>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => {
                    if (linkDialogAccountId) handleLinkCategory(cat.id, linkDialogAccountId);
                  }}>
                    <Plus className="w-3 h-3 mr-1" />Vincular
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create new category for account dialog */}
      <Dialog open={!!newCatDialogAccountId} onOpenChange={(open) => !open && setNewCatDialogAccountId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Categoria para esta Conta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={newCatForm.name} onChange={e => setNewCatForm({ ...newCatForm, name: e.target.value })} placeholder="Nome da categoria" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={newCatForm.type} onValueChange={v => setNewCatForm({ ...newCatForm, type: v as any, subtype: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">Entrada</SelectItem>
                  <SelectItem value="SAIDA">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subtipo</Label>
              <Select value={newCatForm.subtype} onValueChange={v => setNewCatForm({ ...newCatForm, subtype: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {newCatForm.type === 'ENTRADA' ? (
                    <>
                      <SelectItem value="RECORRENTE">Recorrente</SelectItem>
                      <SelectItem value="AVULSA">Avulsa</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="FIXA">Fixa</SelectItem>
                      <SelectItem value="VARIAVEL">Variável</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <Select value={newCatForm.cost_center_id} onValueChange={v => setNewCatForm({ ...newCatForm, cost_center_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {costCenters?.map(cc => (
                    <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <Input type="color" value={newCatForm.color} onChange={e => setNewCatForm({ ...newCatForm, color: e.target.value })} className="h-10 w-20" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCatDialogAccountId(null)}>Cancelar</Button>
            <Button onClick={() => newCatDialogAccountId && handleCreateAndLink(newCatDialogAccountId)} disabled={!newCatForm.name || !newCatForm.cost_center_id}>
              Criar e Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account cards */}
      <div className="space-y-3">
        {accounts?.map((account) => {
          const linkedCategories = getCategoriesForAccount(account.id);
          const isExpanded = expandedAccounts.has(account.id);
          return (
            <div key={account.id} className="border border-border/50 rounded-xl overflow-hidden">
              {/* Account header */}
              {(() => {
                const AccIcon = getEntityIcon(account.name);
                const accColor = getEntityColor(account.name);
                return (
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpand(account.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accColor}18` }}>
                    <AccIcon className="w-5 h-5" style={{ color: accColor }} />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: accColor }}>{account.name}</p>
                    <p className="text-sm text-muted-foreground">{account.bank || 'Sem banco'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono">
                    {formatCurrency(account.current_balance)}
                  </Badge>
                  <Badge className="text-xs">
                    {linkedCategories.length} categoria{linkedCategories.length !== 1 ? 's' : ''}
                  </Badge>
                  <Badge variant={account.active ? 'default' : 'secondary'}>
                    {account.active ? 'Ativa' : 'Inativa'}
                  </Badge>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(account)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteAccount.mutate(account.id)} className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
                );
              })()}

              {/* Expanded categories */}
              {isExpanded && (
                <div className="border-t border-border/50 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">Categorias vinculadas a esta conta</p>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => setLinkDialogAccountId(account.id)}>
                        <Plus className="w-3 h-3 mr-1" />Vincular Existente
                      </Button>
                      <Button size="sm" onClick={() => setNewCatDialogAccountId(account.id)}>
                        <Plus className="w-3 h-3 mr-1" />Nova Categoria
                      </Button>
                    </div>
                  </div>
                  {linkedCategories.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-2">Nenhuma categoria vinculada a esta conta.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {linkedCategories.map(cat => {
                        const CatIcon = getEntityIcon(cat.name);
                        return (
                        <div key={cat.id} className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border/30">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${cat.color || '#6366f1'}18` }}>
                              <CatIcon className="w-3.5 h-3.5" style={{ color: cat.color || '#6366f1' }} />
                            </div>
                            <span className="text-sm font-medium truncate" style={{ color: cat.color || '#6366f1' }}>{cat.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className="text-[10px] px-1.5">
                              {SUBTYPE_LABELS[cat.subtype || ''] || cat.type}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleUnlinkCategory(cat.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {accounts?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhuma conta cadastrada</p>
        )}
      </div>
    </div>
  );
}

// =============================================
// ACCOUNT CATEGORIES TAB
// =============================================

function AccountCategoriesTab() {
  const { data: categories, isLoading } = useAccountCategories();
  const createCategory = useCreateAccountCategory();
  const updateCategory = useUpdateAccountCategory();
  const deleteCategory = useDeleteAccountCategory();
  const [editingCategory, setEditingCategory] = useState<AccountCategory | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', color: '#6366f1', display_order: 0, active: true });

  const handleSubmit = () => {
    const payload = {
      ...formData,
    };

    if (editingCategory) {
      updateCategory.mutate({ id: editingCategory.id, ...payload }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setEditingCategory(null);
        }
      });
    } else {
      createCategory.mutate(payload, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setFormData({ name: '', color: '#6366f1', display_order: 0, active: true });
        }
      });
    }
  };

  const openEdit = (category: AccountCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      color: category.color || '#6366f1',
      display_order: category.display_order,
      active: category.active
    });
    setIsDialogOpen(true);
  };

  const openNew = () => {
    setEditingCategory(null);
    setFormData({ name: '', color: '#6366f1', display_order: (categories?.length || 0) + 1, active: true });
    setIsDialogOpen(true);
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">Agrupadores para organizar as contas (ex: Bancária, Caixa, Investimentos).</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo Agrupador</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Editar Agrupador' : 'Novo Agrupador'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome do agrupador/banco</Label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Banco Inter, XP Investimento, Binance"
                />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input 
                  type="color"
                  value={formData.color} 
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-10 w-20"
                />
              </div>
              <div className="space-y-2">
                <Label>Ordem de Exibição</Label>
                <Input 
                  type="number"
                  value={formData.display_order} 
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.active} 
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label>Ativa</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!formData.name}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Ordem</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories?.map((category) => {
            const brand = getBankBrand(category.name, category.color);
            const CatIcon = brand.icon;
            const catColor = brand.color;
            return (
            <TableRow key={category.id}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: brand.bg }}>
                    <CatIcon className="w-4 h-4" style={{ color: catColor }} />
                  </div>
                  <div>
                    <span className="font-medium" style={{ color: catColor }}>{brand.name}</span>
                    <p className="text-[10px] text-muted-foreground">{category.name}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>{category.display_order}</TableCell>
              <TableCell>
                <Badge variant={category.active ? 'default' : 'secondary'}>
                  {category.active ? 'Ativa' : 'Inativa'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(category)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => deleteCategory.mutate(category.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// =============================================
// COST CENTERS TAB
// =============================================

function CostCentersTab() {
  const { data: costCenters, isLoading } = useCostCenters();
  const createCostCenter = useCreateCostCenter();
  const updateCostCenter = useUpdateCostCenter();
  const [editingCostCenter, setEditingCostCenter] = useState<CostCenter | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    dre_group: '',
    dre_label: '',
    dre_order: 0,
    is_expense: true,
    active: true
  });

  const dreGroups = [
    { value: 'RECEITA', label: 'Receita' },
    { value: 'DEDUCAO', label: 'Dedução' },
    { value: 'CUSTO', label: 'Custo' },
    { value: 'DESPESA_OP', label: 'Despesa Operacional' },
    { value: 'IMPOSTO', label: 'Imposto' },
    { value: 'OUTRAS_REC', label: 'Outras Receitas' },
    { value: 'OUTRAS_DESP', label: 'Outras Despesas' },
    { value: 'PROVISAO', label: 'Provisão' },
    { value: 'INVESTIMENTO', label: 'Investimento' },
    { value: 'DISTRIBUICAO', label: 'Distribuição' },
  ];

  const handleSubmit = () => {
    const payload = {
      ...formData,
    };

    if (editingCostCenter) {
      updateCostCenter.mutate({ id: editingCostCenter.id, ...payload }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setEditingCostCenter(null);
        }
      });
    } else {
      createCostCenter.mutate(payload, {
        onSuccess: () => {
          setIsDialogOpen(false);
        }
      });
    }
  };

  const openEdit = (cc: CostCenter) => {
    setEditingCostCenter(cc);
    setFormData({
      name: cc.name,
      code: cc.code || '',
      dre_group: cc.dre_group,
      dre_label: cc.dre_label,
      dre_order: cc.dre_order,
      is_expense: cc.is_expense,
      active: cc.active
    });
    setIsDialogOpen(true);
  };

  const openNew = () => {
    setEditingCostCenter(null);
    setFormData({
      name: '',
      code: '',
      dre_group: '',
      dre_label: '',
      dre_order: (costCenters?.length || 0) + 1,
      is_expense: true,
      active: true
    });
    setIsDialogOpen(true);
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">Centros de custo que definem a estrutura do DRE (15 grupos).</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo Centro de Custo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCostCenter ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input 
                    value={formData.code} 
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Grupo DRE</Label>
                <Select value={formData.dre_group} onValueChange={(v) => setFormData({ ...formData, dre_group: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    {dreGroups.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Label no DRE</Label>
                <Input 
                  value={formData.dre_label} 
                  onChange={(e) => setFormData({ ...formData, dre_label: e.target.value })}
                  placeholder="Ex: (-) Despesas administrativas"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ordem no DRE</Label>
                  <Input 
                    type="number"
                    value={formData.dre_order} 
                    onChange={(e) => setFormData({ ...formData, dre_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch 
                    checked={formData.is_expense} 
                    onCheckedChange={(checked) => setFormData({ ...formData, is_expense: checked })}
                  />
                  <Label>É despesa (deduz)</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!formData.name || !formData.dre_group}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ordem</TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Grupo DRE</TableHead>
            <TableHead>Label DRE</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="w-[80px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {costCenters?.map((cc) => {
            const CcIcon = getEntityIcon(cc.name);
            const ccColor = getEntityColor(cc.name, cc.code);
            return (
            <TableRow key={cc.id}>
              <TableCell>{cc.dre_order}</TableCell>
              <TableCell><Badge variant="outline">{cc.code}</Badge></TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${ccColor}18` }}>
                    <CcIcon className="w-3.5 h-3.5" style={{ color: ccColor }} />
                  </div>
                  <span className="font-medium" style={{ color: ccColor }}>{cc.name}</span>
                </div>
              </TableCell>
              <TableCell>{cc.dre_group}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{cc.dre_label}</TableCell>
              <TableCell>
                <Badge variant={cc.is_expense ? 'destructive' : 'default'}>
                  {cc.is_expense ? 'Despesa' : 'Receita'}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => openEdit(cc)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// =============================================
// TRANSACTION CATEGORIES TAB (Redesigned - Category as Core)
// =============================================

const SUBTYPE_LABELS: Record<string, string> = {
  RECORRENTE: 'Entrada Recorrente',
  AVULSA: 'Entrada Avulsa',
  FIXA: 'Despesa Fixa',
  VARIAVEL: 'Despesa Variável',
};

const SUBTYPE_COLORS: Record<string, string> = {
  RECORRENTE: 'bg-emerald-700 text-white',
  AVULSA: 'bg-emerald-400 text-white',
  FIXA: 'bg-red-700 text-white',
  VARIAVEL: 'bg-red-400 text-white',
};

const COLOR_POOL = [
  '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#e11d48', '#a855f7', '#22c55e', '#eab308',
  '#0ea5e9', '#d946ef', '#64748b', '#f43f5e', '#059669',
  '#7c3aed', '#db2777', '#0891b2', '#ca8a04', '#16a34a',
  '#9333ea', '#c026d3', '#0284c7', '#dc2626', '#2563eb',
];

function getRandomUniqueColor(usedColors: string[]): string {
  const available = COLOR_POOL.filter(c => !usedColors.includes(c));
  if (available.length > 0) return available[Math.floor(Math.random() * available.length)];
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 50%)`;
}

type SortField = 'name' | 'type' | 'subtype' | 'account' | 'cost_center';
type SortDir = 'asc' | 'desc';

function TransactionCategoriesTab() {
  const { data: categories, isLoading } = useTransactionCategories();
  const { data: costCenters } = useCostCenters();
  const { data: accounts } = useAccounts();
  const createCategory = useCreateTransactionCategory();
  const updateCategory = useUpdateTransactionCategory();
  const deleteCategory = useDeleteTransactionCategory();
  const bulkUpdate = useBulkUpdateTransactionCategories();
  const bulkDelete = useBulkDeleteTransactionCategories();

  const [editingCategory, setEditingCategory] = useState<TransactionCategory | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkField, setBulkField] = useState<'subtype' | 'account' | 'cost_center' | 'active'>('subtype');
  const [bulkValue, setBulkValue] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSubtype, setFilterSubtype] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterCostCenter, setFilterCostCenter] = useState<string>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [formData, setFormData] = useState({
    name: '', cost_center_id: '', type: 'SAIDA' as 'ENTRADA' | 'SAIDA',
    subtype: '' as CategorySubtype | '', default_account_id: '', color: '#6366f1', active: true
  });

  const getExpenseType = (subtype: string) => {
    if (subtype === 'FIXA') return 'FIXA';
    if (subtype === 'VARIAVEL') return 'VARIAVEL';
    return null;
  };

  // Filtered + sorted categories
  const filteredCategories = (categories || [])
    .filter(c => {
      if (searchTerm && !c.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterType !== 'all' && c.type !== filterType) return false;
      if (filterSubtype !== 'all' && c.subtype !== filterSubtype) return false;
      if (filterAccount !== 'all' && c.default_account_id !== filterAccount) return false;
      if (filterCostCenter !== 'all' && c.cost_center_id !== filterCostCenter) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'type': cmp = a.type.localeCompare(b.type); break;
        case 'subtype': cmp = (a.subtype || '').localeCompare(b.subtype || ''); break;
        case 'account': cmp = ((a as any).default_account?.name || '').localeCompare((b as any).default_account?.name || ''); break;
        case 'cost_center': cmp = (a.cost_center?.name || '').localeCompare(b.cost_center?.name || ''); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-primary' : 'text-muted-foreground/40'}`} />
      </div>
    </TableHead>
  );

  const handleSubmit = () => {
    const payload: any = {
      name: formData.name, cost_center_id: formData.cost_center_id, type: formData.type,
      subtype: formData.subtype || null,
      expense_type: formData.type === 'SAIDA' ? getExpenseType(formData.subtype) : null,
      default_account_id: formData.default_account_id || null, color: formData.color, active: formData.active,
    };
    if (editingCategory) {
      updateCategory.mutate({ id: editingCategory.id, ...payload } as any, { onSuccess: () => { setIsDialogOpen(false); setEditingCategory(null); } });
    } else {
      createCategory.mutate(payload as any, { onSuccess: () => setIsDialogOpen(false) });
    }
  };

  const openEdit = (cat: TransactionCategory) => {
    setEditingCategory(cat);
    setFormData({ name: cat.name, cost_center_id: cat.cost_center_id, type: cat.type, subtype: (cat.subtype || '') as CategorySubtype | '', default_account_id: cat.default_account_id || '', color: cat.color || '#6366f1', active: cat.active });
    setIsDialogOpen(true);
  };

  const openNew = () => {
    setEditingCategory(null);
    const usedColors = categories?.map(c => c.color || '').filter(Boolean) || [];
    setFormData({ name: '', cost_center_id: '', type: 'SAIDA', subtype: '', default_account_id: '', color: getRandomUniqueColor(usedColors), active: true });
    setIsDialogOpen(true);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleAllFiltered = () => {
    if (filteredCategories.every(c => selectedIds.has(c.id))) {
      const next = new Set(selectedIds);
      filteredCategories.forEach(c => next.delete(c.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filteredCategories.forEach(c => next.add(c.id));
      setSelectedIds(next);
    }
  };

  const handleBulkAction = () => {
    const ids = Array.from(selectedIds);
    let updates: any = {};
    if (bulkField === 'subtype') updates.subtype = bulkValue;
    if (bulkField === 'account') updates.default_account_id = bulkValue;
    if (bulkField === 'cost_center') updates.cost_center_id = bulkValue;
    if (bulkField === 'active') updates.active = bulkValue === 'true';
    bulkUpdate.mutate({ ids, updates }, { onSuccess: () => { setBulkDialogOpen(false); setSelectedIds(new Set()); setBulkValue(''); } });
  };

  const handleBulkDelete = () => {
    bulkDelete.mutate(Array.from(selectedIds), { onSuccess: () => { setConfirmDeleteOpen(false); setSelectedIds(new Set()); } });
  };

  const subtypeOptions = formData.type === 'ENTRADA'
    ? [{ value: 'RECORRENTE', label: 'Recorrente' }, { value: 'AVULSA', label: 'Avulsa' }]
    : [{ value: 'FIXA', label: 'Fixa' }, { value: 'VARIAVEL', label: 'Variável' }];

  // Unique accounts used by categories for filter
  const usedAccountIds = [...new Set(categories?.map(c => c.default_account_id).filter(Boolean) || [])];
  const usedCostCenterIds = [...new Set(categories?.map(c => c.cost_center_id).filter(Boolean) || [])];

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-muted-foreground text-sm">
          A Categoria é o núcleo do sistema. {categories?.length || 0} categorias ativas.
        </p>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
                <Trash2 className="w-4 h-4 mr-1" />Excluir {selectedIds.size}
              </Button>
              <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">Editar {selectedIds.size} selecionadas</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edição em Massa</DialogTitle>
                    <DialogDescription>Alterar {selectedIds.size} categorias selecionadas.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Campo a alterar</Label>
                      <Select value={bulkField} onValueChange={(v: any) => { setBulkField(v); setBulkValue(''); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="subtype">Subtipo</SelectItem>
                          <SelectItem value="account">Conta Vinculada</SelectItem>
                          <SelectItem value="cost_center">Centro de Custo</SelectItem>
                          <SelectItem value="active">Status</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Novo valor</Label>
                      {bulkField === 'subtype' && (
                        <Select value={bulkValue} onValueChange={setBulkValue}>
                          <SelectTrigger><SelectValue placeholder="Selecionar subtipo" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="RECORRENTE">Recorrente</SelectItem>
                            <SelectItem value="AVULSA">Avulsa</SelectItem>
                            <SelectItem value="FIXA">Fixa</SelectItem>
                            <SelectItem value="VARIAVEL">Variável</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {bulkField === 'account' && (
                        <Select value={bulkValue} onValueChange={setBulkValue}>
                          <SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                          <SelectContent>
                            {accounts?.filter(a => a.active).map(a => (
                              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {bulkField === 'cost_center' && (
                        <Select value={bulkValue} onValueChange={setBulkValue}>
                          <SelectTrigger><SelectValue placeholder="Selecionar centro de custo" /></SelectTrigger>
                          <SelectContent>
                            {costCenters?.map(cc => (
                              <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {bulkField === 'active' && (
                        <Select value={bulkValue} onValueChange={setBulkValue}>
                          <SelectTrigger><SelectValue placeholder="Selecionar status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Ativa</SelectItem>
                            <SelectItem value="false">Inativa</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleBulkAction} disabled={!bulkValue || bulkUpdate.isPending}>
                      {bulkUpdate.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Aplicar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nova Categoria</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
                <DialogDescription>A categoria define automaticamente conta e centro de custo nos lançamentos.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Acompanhamento Ambiental, Aluguel..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo *</Label>
                    <Select value={formData.type} onValueChange={(v: 'ENTRADA' | 'SAIDA') => setFormData({ ...formData, type: v, subtype: '' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ENTRADA">Entrada</SelectItem>
                        <SelectItem value="SAIDA">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subtipo *</Label>
                    <Select value={formData.subtype} onValueChange={(v: CategorySubtype) => setFormData({ ...formData, subtype: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {subtypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Conta Vinculada *</Label>
                  <Select value={formData.default_account_id} onValueChange={(v) => setFormData({ ...formData, default_account_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                    <SelectContent>
                      {accounts?.filter(a => a.active).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Centro de Custo *</Label>
                  <Select value={formData.cost_center_id} onValueChange={(v) => setFormData({ ...formData, cost_center_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar centro de custo" /></SelectTrigger>
                    <SelectContent>
                      {costCenters?.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.name} ({cc.dre_label})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <Input type="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="h-10 w-20" />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={formData.active} onCheckedChange={(checked) => setFormData({ ...formData, active: checked })} />
                    <Label>Ativa</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={!formData.name || !formData.cost_center_id || !formData.subtype}>
                  {editingCategory ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Confirm bulk delete */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir {selectedIds.size} categorias? Esta ação não pode ser desfeita.
              Categorias com transações vinculadas podem falhar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDelete.isPending}>
              {bulkDelete.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Excluir {selectedIds.size} categorias
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar categoria..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-9" />
            </div>
            <Select value={filterType} onValueChange={v => { setFilterType(v); setFilterSubtype('all'); }}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="ENTRADA">Entrada</SelectItem>
                <SelectItem value="SAIDA">Despesa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSubtype} onValueChange={setFilterSubtype}>
              <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Subtipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos subtipos</SelectItem>
                <SelectItem value="RECORRENTE">Recorrente</SelectItem>
                <SelectItem value="AVULSA">Avulsa</SelectItem>
                <SelectItem value="FIXA">Fixa</SelectItem>
                <SelectItem value="VARIAVEL">Variável</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAccount} onValueChange={setFilterAccount}>
              <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Conta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas contas</SelectItem>
                {accounts?.filter(a => usedAccountIds.includes(a.id)).map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCostCenter} onValueChange={setFilterCostCenter}>
              <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Centro de Custo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos centros</SelectItem>
                {costCenters?.filter(cc => usedCostCenterIds.includes(cc.id)).map(cc => (
                  <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="w-4 h-4" />
        {filteredCategories.length} de {categories?.length || 0} categorias
        {selectedIds.size > 0 && <Badge variant="secondary">{selectedIds.size} selecionadas</Badge>}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filteredCategories.length > 0 && filteredCategories.every(c => selectedIds.has(c.id))}
                    onCheckedChange={toggleAllFiltered}
                  />
                </TableHead>
                <TableHead className="w-10">Cor</TableHead>
                <SortHeader field="name">Nome</SortHeader>
                <SortHeader field="subtype">Subtipo</SortHeader>
                <SortHeader field="account">Conta</SortHeader>
                <SortHeader field="cost_center">Centro de Custo</SortHeader>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.map((cat) => {
                const CatIcon = getEntityIcon(cat.name);
                const catColor = cat.color || '#6366f1';
                return (
                <TableRow key={cat.id} className={`${!cat.active ? 'opacity-50' : ''} ${selectedIds.has(cat.id) ? 'bg-primary/5' : ''}`}>
                  <TableCell>
                    <Checkbox checked={selectedIds.has(cat.id)} onCheckedChange={() => toggleSelect(cat.id)} />
                  </TableCell>
                  <TableCell>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${catColor}18` }}>
                      <CatIcon className="w-3.5 h-3.5" style={{ color: catColor }} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-sm" style={{ color: catColor }}>{cat.name}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={SUBTYPE_COLORS[cat.subtype || ''] || 'bg-muted text-muted-foreground'} variant="secondary">
                      {SUBTYPE_LABELS[cat.subtype || ''] || 'Sem subtipo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                    {(cat as any).default_account?.name || <span className="italic">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                    {cat.cost_center?.name || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={cat.active ? 'default' : 'secondary'}>
                      {cat.active ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteCategory.mutate(cat.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
              {filteredCategories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhuma categoria encontrada com os filtros aplicados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// =============================================
// PAYMENT METHODS TAB
// =============================================

function PaymentMethodsTab() {
  const { data: methods, isLoading } = usePaymentMethods();
  const createMethod = useCreatePaymentMethod();
  const updateMethod = useUpdatePaymentMethod();
  const deleteMethod = useDeletePaymentMethod();
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', active: true });

  const handleSubmit = () => {
    const payload = {
      ...formData,
      company_id: '00000000-0000-0000-0000-000000000001',
    };

    if (editingMethod) {
      updateMethod.mutate({ id: editingMethod.id, ...payload }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setEditingMethod(null);
        }
      });
    } else {
      createMethod.mutate(payload, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setFormData({ name: '', active: true });
        }
      });
    }
  };

  const openEdit = (method: PaymentMethod) => {
    setEditingMethod(method);
    setFormData({ name: method.name, active: method.active });
    setIsDialogOpen(true);
  };

  const openNew = () => {
    setEditingMethod(null);
    setFormData({ name: '', active: true });
    setIsDialogOpen(true);
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">Formas de pagamento aceitas pela empresa.</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nova Forma</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMethod ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: PIX, Boleto, Cartão..."
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.active} 
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label>Ativa</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!formData.name}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {methods?.map((method) => {
          const MIcon = getEntityIcon(method.name);
          const mColor = getEntityColor(method.name);
          return (
          <Card key={method.id} className={!method.active ? 'opacity-50' : ''}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${mColor}18` }}>
                  <MIcon className="w-4 h-4" style={{ color: mColor }} />
                </div>
                <span className="font-medium" style={{ color: mColor }}>{method.name}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(method)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => deleteMethod.mutate(method.id)}
                  className="text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>
    </div>
  );
}

// =============================================
// MINIMUM WAGE TAB
// =============================================

function MinimumWageTab() {
  const { data: contracts } = useRecurringContracts();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">Configuração do salário mínimo por ano para cálculo de contratos recorrentes.</p>
        <Button onClick={() => setIsModalOpen(true)}>
          <DollarSign className="w-4 h-4 mr-2" />
          Configurar Salário Mínimo
        </Button>
      </div>

      <Card className="border-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Badge variant="default">Atual</Badge>
            2025
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">
            {formatCurrency(1518)}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {contracts?.length || 0} contratos ativos
          </p>
        </CardContent>
      </Card>

      <MinimumWageConfigModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

// =============================================
// CONTRACT PLANS TAB
// =============================================

function ContractPlansTab() {
  const { data: plans, isLoading } = useContractPlans();
  const createPlan = useCreateContractPlan();
  const updatePlan = useUpdateContractPlan();
  const [editingPlan, setEditingPlan] = useState<ContractPlan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', minimum_wage_factor: 1, description: '', active: true });

  const handleSubmit = () => {
    if (editingPlan) {
      updatePlan.mutate({ id: editingPlan.id, ...formData }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setEditingPlan(null);
        }
      });
    } else {
      createPlan.mutate(formData, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setFormData({ name: '', minimum_wage_factor: 1, description: '', active: true });
        }
      });
    }
  };

  const openEdit = (plan: ContractPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      minimum_wage_factor: plan.minimum_wage_factor,
      description: plan.description || '',
      active: plan.active,
    });
    setIsDialogOpen(true);
  };

  const openNew = () => {
    setEditingPlan(null);
    setFormData({ name: '', minimum_wage_factor: 1, description: '', active: true });
    setIsDialogOpen(true);
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">Planos de contrato com fator de salário mínimo para vincular aos contratos recorrentes.</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo Plano</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
              <DialogDescription>Defina o nome e o fator de salário mínimo do plano.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome do Plano *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Básico, VIP, Premium, Master"
                />
              </div>
              <div className="space-y-2">
                <Label>Fator de Salário Mínimo *</Label>
                <Input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={formData.minimum_wage_factor}
                  onChange={(e) => setFormData({ ...formData, minimum_wage_factor: parseFloat(e.target.value) || 0 })}
                  placeholder="Ex: 0.75, 1.5, 2, 3"
                />
                <p className="text-xs text-muted-foreground">
                  Quantos salários mínimos este plano representa (ex: 1.5 = 1,5 SM)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional do plano"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label>Ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={!formData.name || formData.minimum_wage_factor <= 0}>
                {editingPlan ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plano</TableHead>
            <TableHead>Fator SM</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans?.map((plan) => {
            const PlanIcon = getEntityIcon(plan.name);
            const planColor = getEntityColor(plan.name);
            return (
            <TableRow key={plan.id}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${planColor}18` }}>
                    <PlanIcon className="w-4 h-4" style={{ color: planColor }} />
                  </div>
                  <span className="font-medium" style={{ color: planColor }}>{plan.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono">
                  {plan.minimum_wage_factor} SM
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{plan.description || '-'}</TableCell>
              <TableCell>
                <Badge variant={plan.active ? 'default' : 'secondary'}>
                  {plan.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => openEdit(plan)}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
            );
          })}
          {plans?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                Nenhum plano cadastrado. Crie planos como Básico, VIP, Premium e Master.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// =============================================
// FISCAL CONFIG TAB
// =============================================

function FiscalConfigTab() {
  const { data: configs, isLoading } = useFiscalConfig();
  const updateConfig = useUpdateFiscalConfig();
  
  const nfPercentual = configs?.find(c => c.key === 'nf_percentual_padrao')?.value || '0.09';
  const nfEditavel = configs?.find(c => c.key === 'nf_permitir_edicao_manual')?.value !== 'false';
  
  const [percentual, setPercentual] = useState('');
  const [editavel, setEditavel] = useState(true);
  const [initialized, setInitialized] = useState(false);

  if (!initialized && configs) {
    setPercentual((parseFloat(nfPercentual) * 100).toString());
    setEditavel(nfEditavel);
    setInitialized(true);
  }

  const handleSave = () => {
    const pctValue = parseFloat(percentual) / 100;
    if (isNaN(pctValue) || pctValue < 0 || pctValue > 1) return;
    
    updateConfig.mutate({ key: 'nf_percentual_padrao', value: pctValue.toString() });
    updateConfig.mutate({ key: 'nf_permitir_edicao_manual', value: editavel.toString() });
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parâmetros de Nota Fiscal</CardTitle>
          <CardDescription>Configure o percentual padrão de imposto para Notas Fiscais e permissões de edição.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Percentual Padrão NF (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={percentual}
                onChange={(e) => setPercentual(e.target.value)}
                placeholder="9"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Aplicado automaticamente quando o documento selecionado for Nota Fiscal.
              </p>
            </div>
            <div className="space-y-3">
              <Label>Permitir Edição Manual</Label>
              <div className="flex items-center gap-2">
                <Switch checked={editavel} onCheckedChange={setEditavel} />
                <span className="text-sm text-muted-foreground">
                  {editavel ? 'Sim — usuários podem ajustar o %' : 'Não — percentual fixo'}
                </span>
              </div>
            </div>
          </div>
          <Button onClick={handleSave} disabled={updateConfig.isPending}>
            {updateConfig.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Salvar Configuração Fiscal
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regras de Validação para Entradas</CardTitle>
          <CardDescription>Campos obrigatórios ao criar lançamentos de entrada.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { field: 'Cliente', desc: 'Obrigatório', active: true },
              { field: 'Responsável / Entidade', desc: 'Obrigatório', active: true },
              { field: 'Origem da Receita', desc: 'Serviço, Venda, Reembolso...', active: true },
              { field: 'Documento de Recebimento', desc: 'NF, Recibo, Nota de Débito', active: true },
              { field: 'Categoria', desc: 'Obrigatório', active: true },
              { field: 'Observações', desc: 'Opcional', active: false },
            ].map(rule => (
              <div key={rule.field} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20">
                <div className={`w-2 h-2 rounded-full ${rule.active ? 'bg-income' : 'bg-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-medium">{rule.field}</p>
                  <p className="text-[10px] text-muted-foreground">{rule.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================
// MAIN COMPONENT
// =============================================

export function FinancialConfigView() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Configuração Financeira</CardTitle>
          <CardDescription>
            Gerencie todos os elementos estruturais do sistema financeiro em um só lugar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigTabs />
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigTabs() {
  const { isAdmin } = useAuth();
  return (
          <Tabs defaultValue="companies" className="w-full">
            <TabsList className={`grid w-full grid-cols-4 ${isAdmin ? 'lg:grid-cols-10' : 'lg:grid-cols-9'} mb-6`}>
              <TabsTrigger value="companies" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span className="hidden lg:inline">Empresas</span>
              </TabsTrigger>
              <TabsTrigger value="accounts" className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                <span className="hidden lg:inline">Contas</span>
              </TabsTrigger>
              <TabsTrigger value="account-categories" className="flex items-center gap-2">
                <Landmark className="w-4 h-4" />
                <span className="hidden lg:inline">Agrupadores</span>
              </TabsTrigger>
              <TabsTrigger value="cost-centers" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span className="hidden lg:inline">Centros de Custo</span>
              </TabsTrigger>
              <TabsTrigger value="transaction-categories" className="flex items-center gap-2">
                <Tags className="w-4 h-4" />
                <span className="hidden lg:inline">Categorias</span>
              </TabsTrigger>
              <TabsTrigger value="payment-methods" className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span className="hidden lg:inline">Pagamentos</span>
              </TabsTrigger>
              <TabsTrigger value="contract-plans" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden lg:inline">Planos</span>
              </TabsTrigger>
              <TabsTrigger value="minimum-wage" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span className="hidden lg:inline">Salário Mínimo</span>
              </TabsTrigger>
              <TabsTrigger value="fiscal" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span className="hidden lg:inline">Fiscal</span>
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="permissions" className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden lg:inline">Permissões</span>
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="companies"><CompaniesTab /></TabsContent>
            <TabsContent value="accounts"><AccountsTab /></TabsContent>
            <TabsContent value="account-categories"><AccountCategoriesTab /></TabsContent>
            <TabsContent value="cost-centers"><CostCentersTab /></TabsContent>
            <TabsContent value="transaction-categories"><TransactionCategoriesTab /></TabsContent>
            <TabsContent value="payment-methods"><PaymentMethodsTab /></TabsContent>
            <TabsContent value="contract-plans"><ContractPlansTab /></TabsContent>
            <TabsContent value="minimum-wage"><MinimumWageTab /></TabsContent>
            <TabsContent value="fiscal"><FiscalConfigTab /></TabsContent>
            {isAdmin && (
              <TabsContent value="permissions"><UserPermissionsView /></TabsContent>
            )}
          </Tabs>
  );
}
