import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, Search, ArrowDownCircle, ArrowUpCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeForSearch } from './CategorySearchInput';

interface CategoryLite {
  id: string;
  name: string;
  type: 'ENTRADA' | 'SAIDA';
  subtype?: string | null;
  color?: string | null;
  default_account_id?: string | null;
  cost_center_id?: string | null;
  cost_center?: { name?: string | null } | null;
  active?: boolean;
}

interface Props {
  categories: CategoryLite[];
  accounts?: Array<{ id: string; name: string }>;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

const SUBTYPE_HEADERS: Record<string, { label: string; icon: any; color: string }> = {
  'ENTRADA-RECORRENTE': { label: 'Entradas Recorrentes', icon: RefreshCw, color: 'text-income' },
  'ENTRADA-AVULSA':    { label: 'Entradas Avulsas',     icon: ArrowDownCircle, color: 'text-income' },
  'SAIDA-FIXA':        { label: 'Despesas Fixas',       icon: RefreshCw, color: 'text-expense' },
  'SAIDA-VARIAVEL':    { label: 'Despesas Variáveis',   icon: ArrowUpCircle, color: 'text-expense' },
};

export function CategoryCombobox({ categories, accounts, value, onChange, placeholder = 'Buscar categoria...', className }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'TODAS' | 'FIXA' | 'RECORRENTE' | 'VARIAVEL' | 'AVULSA'>('TODAS');

  const accountById = useMemo(() => {
    const m = new Map<string, string>();
    (accounts || []).forEach(a => m.set(a.id, a.name));
    return m;
  }, [accounts]);

  const grouped = useMemo(() => {
    const q = normalizeForSearch(search);
    const filtered = categories
      .filter(c => c.active !== false)
      .filter(c => typeFilter === 'TODAS' || c.subtype === typeFilter)
      .filter(c => !q || normalizeForSearch(c.name).includes(q));
    const groups: Record<string, CategoryLite[]> = {
      'ENTRADA-RECORRENTE': [], 'ENTRADA-AVULSA': [],
      'SAIDA-FIXA': [], 'SAIDA-VARIAVEL': [],
    };
    for (const c of filtered) {
      const key = `${c.type}-${c.subtype || 'AVULSA'}`;
      if (groups[key]) groups[key].push(c);
    }
    return groups;
  }, [categories, search, typeFilter]);

  const selected = categories.find(c => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn('w-full justify-between h-10 font-normal', !selected && 'text-muted-foreground', className)}
        >
          {selected ? (
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selected.color || '#6366f1' }} />
              <span className="truncate font-medium text-foreground">{selected.name}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2"><Search className="w-4 h-4" /> {placeholder}</span>
          )}
          <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[320px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar categoria..." value={search} onValueChange={setSearch} />
          <div className="flex gap-1.5 overflow-x-auto border-b p-2">
            {[
              ['TODAS', 'Todas'],
              ['FIXA', 'Fixa'],
              ['RECORRENTE', 'Recorrente'],
              ['VARIAVEL', 'Variável'],
              ['AVULSA', 'Avulsa'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTypeFilter(key as typeof typeFilter)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  typeFilter === key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <CommandList className="max-h-[360px]">
            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
            {Object.entries(grouped).map(([key, items]) => {
              if (!items.length) return null;
              const h = SUBTYPE_HEADERS[key];
              const Icon = h.icon;
              return (
                <CommandGroup
                  key={key}
                  heading={
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                      <Icon className={cn('w-3 h-3', h.color)} /> {h.label}
                    </span>
                  }
                >
                  {items.map(c => {
                    const accName = c.default_account_id ? accountById.get(c.default_account_id) : null;
                    const ccName = c.cost_center?.name;
                    return (
                      <CommandItem
                        key={c.id}
                        value={c.id}
                        onSelect={() => { onChange(c.id); setOpen(false); setSearch(''); }}
                        className="flex items-start gap-2 py-2"
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: c.color || '#6366f1' }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {accName || 'Sem conta padrão'}
                            {ccName && ` · ${ccName}`}
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
