import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import {
  type Account,
  useAccountCategories,
  useCategoriesByAccount,
  useCreateAccount,
  useLinkCategoriesToAccount,
  useTransactionCategories,
  useUpdateAccount,
} from '@/hooks/useFinancialConfig';
import { cn } from '@/lib/utils';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  account?: Account | null;
}

export function AccountModal({ open, onClose, account }: AccountModalProps) {
  const isEdit = !!account;
  const { data: accountCategories } = useAccountCategories();
  const { data: allCategories } = useTransactionCategories();
  const { data: linkedCategories } = useCategoriesByAccount(account?.id);
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const linkCategories = useLinkCategoriesToAccount();

  const [form, setForm] = useState({
    name: '',
    bank: 'Inter',
    category_id: '',
    initial_balance: 0,
    active: true,
  });
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    if (account) {
      setForm({
        name: account.name,
        bank: account.bank ?? 'Inter',
        category_id: account.category_id ?? '',
        initial_balance: Number(account.initial_balance ?? 0),
        active: account.active,
      });
    } else {
      setForm({ name: '', bank: 'Inter', category_id: '', initial_balance: 0, active: true });
      setSelectedCategoryIds(new Set());
    }
    setSearch('');
  }, [account, open]);

  useEffect(() => {
    if (linkedCategories) {
      setSelectedCategoryIds(new Set(linkedCategories.map(c => c.id)));
    }
  }, [linkedCategories]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allCategories ?? [])
      .filter(c => c.active)
      .filter(c => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCategories, search]);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    try {
      let savedId = account?.id;
      if (isEdit && account) {
        await updateAccount.mutateAsync({
          id: account.id,
          name: form.name.trim(),
          bank: form.bank || null,
          category_id: form.category_id || null,
          initial_balance: form.initial_balance,
          active: form.active,
        });
      } else {
        const created = await createAccount.mutateAsync({
          name: form.name.trim(),
          bank: form.bank || undefined,
          category_id: form.category_id || null,
          initial_balance: form.initial_balance,
          active: form.active,
        });
        savedId = created.id;
      }

      if (savedId) {
        await linkCategories.mutateAsync({ accountId: savedId, categoryIds: Array.from(selectedCategoryIds) });
      }
      onClose();
    } catch {
      // toasts já são exibidos pelos hooks
    }
  };

  const isPending = createAccount.isPending || updateAccount.isPending || linkCategories.isPending;
  const linkedCount = selectedCategoryIds.size;
  const entradasLinked = filteredCategories.filter(c => selectedCategoryIds.has(c.id) && c.type === 'ENTRADA').length;
  const saidasLinked = filteredCategories.filter(c => selectedCategoryIds.has(c.id) && c.type === 'SAIDA').length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
          <DialogDescription>
            Defina os dados da conta e quais categorias de transação a usam por padrão.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-hidden flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Conta Inter PJ" required />
            </div>
            <div className="space-y-1.5">
              <Label>Banco</Label>
              <Input value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="Inter" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria de Conta</Label>
              <Select value={form.category_id || 'none'} onValueChange={(v) => setForm({ ...form, category_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {accountCategories?.filter(c => c.active).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Saldo Inicial (R$)</Label>
              <CurrencyInput
                value={form.initial_balance}
                onValueChange={(value) => setForm({ ...form, initial_balance: value ?? 0 })}
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label className="cursor-pointer">Conta ativa</Label>
            </div>
          </div>

          <div className="border-t pt-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm">Categorias de transação vinculadas</Label>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  <ArrowDownToLine className="w-3 h-3 mr-1 text-income" /> {entradasLinked}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  <ArrowUpFromLine className="w-3 h-3 mr-1 text-expense" /> {saidasLinked}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">{linkedCount} total</Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              As categorias marcadas usarão esta conta automaticamente nos novos lançamentos.
            </p>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar categoria..."
                className="pl-8 h-8 text-sm"
              />
            </div>
            <ScrollArea className="flex-1 border rounded-md">
              <div className="p-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1">
                {filteredCategories.map(cat => {
                  const checked = selectedCategoryIds.has(cat.id);
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={cn(
                        'flex items-center gap-2 text-left px-2 py-1.5 rounded text-xs transition-colors',
                        checked ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px]',
                          checked ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40',
                        )}
                      >
                        {checked ? '✓' : ''}
                      </span>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || 'hsl(var(--muted-foreground))' }} />
                      <span className="truncate flex-1">{cat.name}</span>
                      <Badge variant="outline" className={cn('text-[9px] px-1', cat.type === 'ENTRADA' ? 'text-income border-income/40' : 'text-expense border-expense/40')}>
                        {cat.type === 'ENTRADA' ? 'IN' : 'OUT'}
                      </Badge>
                    </button>
                  );
                })}
                {filteredCategories.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-6 col-span-2">Nenhuma categoria encontrada.</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name.trim()}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? 'Salvar alterações' : 'Criar conta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
