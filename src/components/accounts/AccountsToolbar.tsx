import { Search, ArrowUpDown, Filter, Layers, EyeOff, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SortKey = 'manual' | 'saldo_desc' | 'saldo_asc' | 'name' | 'movimento';
export type GroupKey = 'none' | 'bank' | 'category';
export type FilterKey = 'all' | 'positive' | 'negative' | 'zero' | 'with_movement' | 'no_movement';

interface Props {
  search: string;
  onSearch: (v: string) => void;
  sort: SortKey;
  onSort: (v: SortKey) => void;
  filter: FilterKey;
  onFilter: (v: FilterKey) => void;
  group: GroupKey;
  onGroup: (v: GroupKey) => void;
  hiddenCount?: number;
  compact: boolean;
  onCompactChange: (v: boolean) => void;
  onShowHidden: () => void;
  onResetLayout: () => void;
  showHidden?: boolean;
}

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'positive', label: 'Positivas' },
  { value: 'negative', label: 'Negativas' },
  { value: 'zero', label: 'Zeradas' },
  { value: 'with_movement', label: 'Com movimento' },
  { value: 'no_movement', label: 'Sem movimento' },
];

export function AccountsToolbar({
  search,
  onSearch,
  sort,
  onSort,
  filter,
  onFilter,
  group,
  onGroup,
  hiddenCount = 0,
  compact,
  onCompactChange,
  onShowHidden,
  onResetLayout,
  showHidden = false,
}: Props) {
  return (
    <div className="flex flex-col gap-2 bg-card border border-border rounded-lg p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar conta, banco ou categoria..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={sort} onValueChange={(v) => onSort(v as SortKey)}>
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <ArrowUpDown className="w-3 h-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Minha ordem</SelectItem>
            <SelectItem value="saldo_desc">Saldo: maior para menor</SelectItem>
            <SelectItem value="saldo_asc">Saldo: menor para maior</SelectItem>
            <SelectItem value="name">Nome (A-Z)</SelectItem>
            <SelectItem value="movimento">Maior movimentacao</SelectItem>
          </SelectContent>
        </Select>
        <Select value={group} onValueChange={(v) => onGroup(v as GroupKey)}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <Layers className="w-3 h-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem agrupamento</SelectItem>
            <SelectItem value="bank">Por banco</SelectItem>
            <SelectItem value="category">Por categoria</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={compact ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          onClick={() => onCompactChange(!compact)}
        >
          {compact ? 'Expandir cards' : 'Minimizar cards'}
        </Button>
        {hiddenCount > 0 && (
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onShowHidden}>
            <EyeOff className="w-3 h-3 mr-1" />
            {showHidden ? 'Ocultar ocultas' : `Ver ocultas (${hiddenCount})`}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onResetLayout}>
          <RotateCcw className="w-3 h-3 mr-1" />
          Resetar
        </Button>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="w-3 h-3 text-muted-foreground" />
        {FILTERS.map((f) => (
          <Badge
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            onClick={() => onFilter(f.value)}
            className={cn(
              'cursor-pointer text-[10px] h-5 px-2 hover:bg-primary/10',
              filter === f.value && 'bg-primary text-primary-foreground hover:bg-primary',
            )}
          >
            {f.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
