// ============= BULK EDIT PANEL (compartilhado) =============
// Componente reutilizável para edição em massa de transações.
// Usado pelas páginas de Transações (Visão Geral, Recorrentes, Avulsas, Fixas, Variáveis).
//
// Recursos principais:
//  • Restrição de campos por contexto (ex: recorrentes não permitem alterar valor/vencimento)
//  • Pré-visualização de impacto antes de aplicar
//  • Toggle "Sobrescrever existentes" (default OFF — só preenche nulos)
//  • Update em chunks de 500 IDs (evita timeout do PostgREST e dos triggers)
//  • Barra de progresso durante execução
//  • Pré-preenchimento via commonValue() quando todos os selecionados compartilham o mesmo valor

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyInput, parseBRLToNumber } from '@/components/ui/currency-input';
import { Loader2, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getEntityIcon } from '@/utils/entityIcons';
import { CategorySearchInput, normalizeForSearch } from './CategorySearchInput';
import { cn } from '@/lib/utils';

// ----- Helpers compartilhados (espelhando ApprovalView) -----
function ensureDarkColor(hex?: string | null): string {
  if (!hex || !hex.startsWith('#')) return '#6366f1';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance > 0.6) {
    const f = 0.5;
    const dr = Math.round(r * f), dg = Math.round(g * f), db = Math.round(b * f);
    return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
  }
  return hex;
}

const VISUAL_PALETTE = [
  '#0d9488', '#7c3aed', '#db2777', '#ea580c', '#0284c7', '#65a30d',
  '#9333ea', '#0891b2', '#c2410c', '#15803d', '#be185d', '#4338ca',
];
function colorFromName(name?: string | null): string {
  if (!name) return VISUAL_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return VISUAL_PALETTE[hash % VISUAL_PALETTE.length];
}

function commonValue<T extends string | null | undefined>(items: T[]): T | null {
  if (items.length === 0) return null;
  const first = items[0];
  return items.every(v => v === first) ? first : null;
}

// ----- Tipos -----
export type BulkContext = 'GERAL' | 'ENTRADAS_RECORRENTES' | 'ENTRADAS_AVULSAS' | 'DESPESAS_FIXAS' | 'DESPESAS_VARIAVEIS';

// Espelho mínimo dos campos usados — funciona para PendingTransaction (ApprovalView)
// e para TransactionWithClient (TransactionsList). Apenas os IDs são obrigatórios.
export interface BulkSelectableTransaction {
  id: string;
  tipo_movimento?: string | null;
  cliente_id?: string | null;
  entity_id?: string | null;
  responsavel_id?: string | null;
  account_id?: string | null;
  transaction_category_id?: string | null;
  cost_center_id?: string | null;
  status?: string | null;
  origem?: string | null;
  competencia_ano?: number | null;
  documento_recebimento?: string | null;
}

interface BulkEditPanelProps {
  open: boolean;
  onClose: () => void;
  selectedTransactions: BulkSelectableTransaction[];
  context?: BulkContext;
  /** Chamado depois que o update em massa terminou com sucesso */
  onSuccess?: () => void;
}

// ----- Restrições de campos por contexto -----
// `true` = campo liberado para edição em massa nesse contexto
interface ContextFields {
  cliente: boolean;
  entity: boolean;
  categoria: boolean;
  conta: boolean;
  centroCusto: boolean;
  status: boolean;
  valor: boolean;
  vencimento: boolean;
  descricao: boolean;
  notes: boolean;
  documentoRecebimento: boolean;
}

function getContextFields(ctx: BulkContext): { fields: ContextFields; warnings: string[] } {
  const warnings: string[] = [];
  switch (ctx) {
    case 'ENTRADAS_RECORRENTES':
      warnings.push('Cliente, Valor e Vencimento são definidos pelo contrato/plano e não podem ser alterados em massa aqui.');
      return {
        fields: {
          cliente: false, entity: true,
          categoria: true, conta: true, centroCusto: true, status: true,
          valor: false, vencimento: false, descricao: false, notes: true,
          documentoRecebimento: true,
        },
        warnings,
      };
    case 'DESPESAS_FIXAS':
      warnings.push('Valor e Vencimento são definidos pelo cadastro da despesa fixa e não podem ser alterados em massa aqui.');
      return {
        fields: {
          cliente: false, entity: true,
          categoria: true, conta: true, centroCusto: true, status: true,
          valor: false, vencimento: false, descricao: false, notes: true,
          documentoRecebimento: true,
        },
        warnings,
      };
    case 'ENTRADAS_AVULSAS':
    case 'DESPESAS_VARIAVEIS':
    case 'GERAL':
    default:
      return {
        fields: {
          cliente: true, entity: true,
          categoria: true, conta: true, centroCusto: true, status: true,
          valor: true, vencimento: true, descricao: false, notes: true,
          documentoRecebimento: true,
        },
        warnings,
      };
  }
}

// Opções padronizadas de Documento de Recebimento (NF)
const DOC_RECEB_OPTIONS = [
  { value: 'NOTA_FISCAL', label: 'Nota Fiscal (NF)' },
  { value: 'RECIBO', label: 'Recibo' },
  { value: 'NOTA_DE_DEBITO', label: 'Nota de Débito' },
  { value: 'SEM_DOCUMENTO', label: 'Sem documento' },
];

// Mapeia campo da UI → coluna do banco (para o filtro `is(<col>, null)` quando "sobrescrever" está OFF)
const FIELD_TO_COLUMN: Record<string, string> = {
  cliente_id: 'cliente_id',
  entity_id: 'entity_id',
  transaction_category_id: 'transaction_category_id',
  account_id: 'account_id',
  cost_center_id: 'cost_center_id',
  status: 'status',
  valor: 'valor',
  data_vencimento: 'data_vencimento',
  notes: 'notes',
  documento_recebimento: 'documento_recebimento',
};

const CHUNK_SIZE = 500;

export function BulkEditPanel({
  open, onClose, selectedTransactions, context = 'GERAL', onSuccess,
}: BulkEditPanelProps) {
  const queryClient = useQueryClient();
  const { fields: allowedFields, warnings: contextWarnings } = useMemo(() => getContextFields(context), [context]);

  // Estado dos campos editáveis
  const [bulkClienteId, setBulkClienteId] = useState('');
  const [bulkEntityId, setBulkEntityId] = useState('');
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [bulkAccountId, setBulkAccountId] = useState('');
  const [bulkCostCenterId, setBulkCostCenterId] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkValor, setBulkValor] = useState('');
  const [bulkDataVencimento, setBulkDataVencimento] = useState('');
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkCategorySearch, setBulkCategorySearch] = useState('');
  const [bulkDocumentoRecebimento, setBulkDocumentoRecebimento] = useState('');

  // Toggle de segurança: default OFF = só preenche onde está nulo
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  // Preview e progresso
  const [showPreview, setShowPreview] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // ----- Lookups -----
  const { data: categoriesList } = useQuery({
    queryKey: ['bulkpanel_categories_full'],
    queryFn: async () => {
      const { data } = await supabase
        .from('transaction_categories')
        .select('id, name, type, subtype, color, default_account_id, cost_center_id, active')
        .order('name');
      return data || [];
    },
    enabled: open,
  });
  const { data: accountsList } = useQuery({
    queryKey: ['bulkpanel_accounts_full'],
    queryFn: async () => {
      const { data } = await supabase.from('accounts').select('id, name, bank, active').order('name');
      return data || [];
    },
    enabled: open,
  });
  const { data: costCentersList } = useQuery({
    queryKey: ['bulkpanel_cost_centers'],
    queryFn: async () => {
      const { data } = await supabase.from('cost_centers').select('id, name, active').order('name');
      return data || [];
    },
    enabled: open,
  });
  const { data: clientsList } = useQuery({
    queryKey: ['bulkpanel_clients'],
    queryFn: async () => {
      const { data } = await supabase.from('recurring_clients').select('id, name').eq('active', true).order('name');
      return data || [];
    },
    enabled: open,
  });
  const { data: entitiesList } = useQuery({
    queryKey: ['bulkpanel_entities'],
    queryFn: async () => {
      const { data } = await supabase.from('financial_entities').select('id, name, type').eq('active', true).order('name');
      return data || [];
    },
    enabled: open,
  });

  // ----- Pré-preenchimento ao abrir -----
  useEffect(() => {
    if (!open) return;
    if (selectedTransactions.length === 0) return;
    setBulkClienteId(commonValue(selectedTransactions.map(t => t.cliente_id ?? null)) || '');
    setBulkEntityId(commonValue(selectedTransactions.map(t => t.entity_id ?? null)) || '');
    setBulkCategoryId(commonValue(selectedTransactions.map(t => t.transaction_category_id ?? null)) || '');
    setBulkAccountId(commonValue(selectedTransactions.map(t => t.account_id ?? null)) || '');
    setBulkCostCenterId(commonValue(selectedTransactions.map(t => t.cost_center_id ?? null)) || '');
    setBulkStatus(commonValue(selectedTransactions.map(t => t.status ?? null)) || '');
    setBulkDocumentoRecebimento(commonValue(selectedTransactions.map(t => t.documento_recebimento ?? null)) || '');
    setBulkValor('');
    setBulkDataVencimento('');
    setBulkNotes('');
    setBulkCategorySearch('');
    setShowPreview(false);
    setProgress(null);
    setOverwriteExisting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resetFields = () => {
    setBulkClienteId(''); setBulkEntityId('');
    setBulkCategoryId(''); setBulkAccountId(''); setBulkCostCenterId('');
    setBulkStatus(''); setBulkValor(''); setBulkDataVencimento('');
    setBulkNotes(''); setBulkCategorySearch(''); setBulkDocumentoRecebimento('');
  };

  // ----- Categorias agrupadas por conta + busca por substring -----
  const groupedCategories = useMemo(() => {
    const accMap = new Map(((accountsList || []) as any[]).map(a => [a.id, a]));
    const groups = new Map<string, { accountName: string; categories: any[] }>();
    const q = normalizeForSearch(bulkCategorySearch.trim());
    let source = ((categoriesList || []) as any[]);
    // Filtra por tipo se todos os selecionados forem do mesmo tipo
    const commonTipo = commonValue(selectedTransactions.map(t => t.tipo_movimento ?? null));
    if (commonTipo) source = source.filter(c => c.type === commonTipo || c.id === bulkCategoryId);
    if (q) source = source.filter(c => normalizeForSearch(c.name).includes(q));
    for (const cat of source) {
      const accId = cat.default_account_id || '__none__';
      const accName = accId === '__none__' ? 'Sem conta vinculada' : (accMap.get(accId)?.name || 'Conta desconhecida');
      if (!groups.has(accId)) groups.set(accId, { accountName: accName, categories: [] });
      groups.get(accId)!.categories.push(cat);
    }
    return Array.from(groups.values())
      .map(g => ({ ...g, categories: g.categories.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.accountName.localeCompare(b.accountName));
  }, [categoriesList, accountsList, bulkCategorySearch, bulkCategoryId, selectedTransactions]);

  // ----- Coleta de updates (apenas campos preenchidos e permitidos no contexto) -----
  function buildUpdatesPayload(): { updates: Record<string, any>; error?: string } {
    const updates: Record<string, any> = {};
    if (allowedFields.cliente && bulkClienteId) updates.cliente_id = bulkClienteId;
    if (allowedFields.entity && bulkEntityId) updates.entity_id = bulkEntityId;
    if (allowedFields.categoria && bulkCategoryId) updates.transaction_category_id = bulkCategoryId;
    if (allowedFields.conta && bulkAccountId) updates.account_id = bulkAccountId;
    if (allowedFields.centroCusto && bulkCostCenterId) updates.cost_center_id = bulkCostCenterId;
    if (allowedFields.status && bulkStatus) updates.status = bulkStatus;
    if (allowedFields.vencimento && bulkDataVencimento) updates.data_vencimento = bulkDataVencimento;
    if (allowedFields.notes && bulkNotes.trim()) updates.notes = bulkNotes.trim();
    if (allowedFields.documentoRecebimento && bulkDocumentoRecebimento) updates.documento_recebimento = bulkDocumentoRecebimento;
    if (allowedFields.valor && bulkValor.trim()) {
      const v = parseBRLToNumber(bulkValor);
      if (v === null || isNaN(v) || v < 0) return { updates, error: 'Valor inválido' };
      updates.valor = v;
    }
    return { updates };
  }

  // ----- Resumo de impacto (mostrado antes de aplicar) -----
  const impactSummary = useMemo(() => {
    const { updates } = buildUpdatesPayload();
    const fieldNames = Object.keys(updates);
    if (fieldNames.length === 0) return null;

    // Para cada campo, conta quantas linhas já têm valor preenchido (seriam sobrescritas)
    const overwriteCounts: Record<string, number> = {};
    for (const f of fieldNames) {
      const col = FIELD_TO_COLUMN[f];
      if (!col) continue;
      overwriteCounts[f] = selectedTransactions.filter(t => {
        const v = (t as any)[col];
        return v !== null && v !== undefined && v !== '';
      }).length;
    }

    // Origens afetadas
    const origens: Record<string, number> = {};
    selectedTransactions.forEach(t => {
      const o = t.origem || 'INDEFINIDA';
      origens[o] = (origens[o] || 0) + 1;
    });

    // Anos afetados
    const anos: Record<number, number> = {};
    selectedTransactions.forEach(t => {
      if (t.competencia_ano) anos[t.competencia_ano] = (anos[t.competencia_ano] || 0) + 1;
    });

    return { fieldNames, overwriteCounts, origens, anos, total: selectedTransactions.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkClienteId, bulkEntityId, bulkCategoryId, bulkAccountId,
      bulkCostCenterId, bulkStatus, bulkValor, bulkDataVencimento, bulkNotes,
      bulkDocumentoRecebimento, selectedTransactions, allowedFields]);

  // ----- Mutação chunked -----
  const bulkMutation = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Record<string, any> }) => {
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE));

      let done = 0;
      setProgress({ done: 0, total: ids.length });

      // Estratégia: se overwrite OFF e há múltiplos campos, fazemos um UPDATE por campo,
      // adicionando `is(<col>, null)` ao WHERE — assim cada campo só preenche onde estava nulo.
      // Se overwrite ON, fazemos um único UPDATE com todos os campos por chunk.
      if (overwriteExisting || Object.keys(updates).length === 1) {
        for (const chunk of chunks) {
          const { error } = await supabase
            .from('transactions')
            .update(updates)
            .in('id', chunk)
            .select('id');
          if (error) throw error;
          done += chunk.length;
          setProgress({ done, total: ids.length });
        }
      } else {
        // Múltiplos campos + overwrite OFF → um UPDATE por campo (cada um filtrado por null)
        const fieldUpdates = Object.entries(updates);
        const totalOps = chunks.length * fieldUpdates.length;
        let opsDone = 0;
        for (const chunk of chunks) {
          for (const [field, value] of fieldUpdates) {
            const col = FIELD_TO_COLUMN[field] || field;
            const { error } = await supabase
              .from('transactions')
              .update({ [field]: value })
              .in('id', chunk)
              .is(col, null)
              .select('id');
            if (error) throw error;
            opsDone += 1;
            setProgress({ done: Math.round((opsDone / totalOps) * ids.length), total: ids.length });
          }
        }
      }
    },
    onSuccess: async (_, { ids }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['approval-transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['open-payments'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions_chart_v2'] }),
      ]);
      await queryClient.refetchQueries({ queryKey: ['transactions'], type: 'active' });
      toast.success(`${ids.length} lançamento(s) atualizado(s) com sucesso!`);
      setProgress(null);
      onSuccess?.();
      onClose();
    },
    onError: (e: any) => {
      setProgress(null);
      toast.error('Erro ao atualizar: ' + (e?.message || ''));
    },
  });

  const handleApply = () => {
    const { updates, error } = buildUpdatesPayload();
    if (error) { toast.error(error); return; }
    if (Object.keys(updates).length === 0) {
      toast.error('Selecione pelo menos um campo para alterar');
      return;
    }
    if (selectedTransactions.length === 0) {
      toast.error('Nenhum lançamento selecionado');
      return;
    }
    bulkMutation.mutate({ ids: selectedTransactions.map(t => t.id), updates });
  };

  const isPending = bulkMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isPending) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Editar {selectedTransactions.length} lançamento(s) em massa</span>
            <Button size="sm" variant="ghost" onClick={resetFields} className="h-7 text-xs" disabled={isPending}>
              <RotateCcw className="w-3 h-3 mr-1" /> Limpar campos
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Avisos do contexto */}
        {contextWarnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs space-y-1">
            <p className="font-medium text-amber-900 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Proteções deste contexto
            </p>
            {contextWarnings.map((w, i) => (
              <p key={i} className="text-amber-800">• {w}</p>
            ))}
          </div>
        )}

        {/* Toggle: sobrescrever existentes */}
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 bg-muted/20">
          <div className="space-y-0.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              {overwriteExisting && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
              Sobrescrever valores existentes
            </Label>
            <p className="text-[11px] text-muted-foreground">
              {overwriteExisting
                ? 'Todos os lançamentos serão atualizados, mesmo os que já têm o campo preenchido.'
                : 'Modo seguro: só preenche os campos que estão vazios (recomendado para backfill).'}
            </p>
          </div>
          <Switch checked={overwriteExisting} onCheckedChange={setOverwriteExisting} disabled={isPending} />
        </div>

        {/* Campos */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allowedFields.conta && (
              <BulkSelectField label="Conta" value={bulkAccountId} onChange={setBulkAccountId} disabled={isPending}>
                {((accountsList || []) as any[]).map(a => {
                  const Icon = getEntityIcon(a.name);
                  const color = colorFromName(a.name);
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 shrink-0" style={{ color }} />
                        <span style={{ color }} className="font-medium">{a.name}</span>
                        {a.bank && <span className="text-[10px] text-muted-foreground">({a.bank})</span>}
                        {!a.active && <Badge variant="outline" className="text-[9px] px-1 py-0">inativa</Badge>}
                      </div>
                    </SelectItem>
                  );
                })}
              </BulkSelectField>
            )}

            {allowedFields.centroCusto && (
              <BulkSelectField label="Centro de Custo" value={bulkCostCenterId} onChange={setBulkCostCenterId} disabled={isPending}>
                {((costCentersList || []) as any[]).map(c => {
                  const Icon = getEntityIcon(c.name);
                  const color = colorFromName(c.name);
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 shrink-0" style={{ color }} />
                        <span style={{ color }} className="font-medium">{c.name}</span>
                        {c.active === false && <Badge variant="outline" className="text-[9px] px-1 py-0">inativo</Badge>}
                      </div>
                    </SelectItem>
                  );
                })}
              </BulkSelectField>
            )}

            {allowedFields.categoria && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs flex items-center justify-between">
                  <span>Categoria</span>
                  {bulkCategoryId && (
                    <button type="button" onClick={() => setBulkCategoryId('')} className="text-[10px] text-muted-foreground hover:text-foreground">limpar</button>
                  )}
                </Label>
                <Select value={bulkCategoryId} onValueChange={setBulkCategoryId} disabled={isPending}>
                  <SelectTrigger><SelectValue placeholder="Não alterar" /></SelectTrigger>
                  <SelectContent className="max-h-[360px]">
                    <CategorySearchInput value={bulkCategorySearch} onChange={setBulkCategorySearch} />
                    {groupedCategories.length === 0 && (
                      <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                        Nenhuma categoria encontrada
                      </div>
                    )}
                    {groupedCategories.map((group) => (
                      <div key={group.accountName}>
                        <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 sticky top-0">
                          {group.accountName}
                        </div>
                        {group.categories.map((c: any) => {
                          const Icon = getEntityIcon(c.name);
                          const color = ensureDarkColor(c.color);
                          return (
                            <SelectItem key={c.id} value={c.id}>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 shrink-0" style={{ color }} />
                                <span style={{ color }}>{c.name}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {allowedFields.cliente && (
              <BulkSelectField label="Cliente (empresa)" value={bulkClienteId} onChange={setBulkClienteId} disabled={isPending}>
                {((clientsList || []) as any[]).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </BulkSelectField>
            )}

            {allowedFields.entity && (
              <BulkSelectField label="Vinculado a (Entidade)" value={bulkEntityId} onChange={setBulkEntityId} disabled={isPending}>
                {((entitiesList || []) as any[]).map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    <div className="flex items-center gap-2">
                      <span>{e.name}</span>
                      <span className="text-[10px] text-muted-foreground">{e.type}</span>
                    </div>
                  </SelectItem>
                ))}
              </BulkSelectField>
            )}

            {allowedFields.status && (
              <BulkSelectField label="Status" value={bulkStatus} onChange={setBulkStatus} disabled={isPending}>
                <SelectItem value="EM_ABERTO">Em Aberto</SelectItem>
                <SelectItem value="PAGO">Pago</SelectItem>
                <SelectItem value="ATRASADO">Atrasado</SelectItem>
              </BulkSelectField>
            )}

            {allowedFields.documentoRecebimento && (
              <BulkSelectField
                label="Documento (NF / Recibo / N. Débito)"
                value={bulkDocumentoRecebimento}
                onChange={setBulkDocumentoRecebimento}
                disabled={isPending}
              >
                {DOC_RECEB_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </BulkSelectField>
            )}
          </div>

          {(allowedFields.valor || allowedFields.vencimento || allowedFields.notes) && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
              <p className="text-xs font-semibold text-foreground">Conteúdo do lançamento</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allowedFields.valor && (
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center justify-between">
                      <span>Valor (R$)</span>
                      {bulkValor && <button type="button" onClick={() => setBulkValor('')} className="text-[10px] text-muted-foreground hover:text-foreground">limpar</button>}
                    </Label>
                    <CurrencyInput
                      value={bulkValor}
                      onValueChange={(n) => setBulkValor(n === null ? '' : String(n))}
                      placeholder="Não alterar"
                      disabled={isPending}
                    />
                  </div>
                )}
                {allowedFields.vencimento && (
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center justify-between">
                      <span>Vencimento</span>
                      {bulkDataVencimento && <button type="button" onClick={() => setBulkDataVencimento('')} className="text-[10px] text-muted-foreground hover:text-foreground">limpar</button>}
                    </Label>
                    <Input type="date" value={bulkDataVencimento} onChange={(e) => setBulkDataVencimento(e.target.value)} disabled={isPending} />
                  </div>
                )}
              </div>
              {allowedFields.notes && (
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center justify-between">
                    <span>Observações (substitui as existentes)</span>
                    {bulkNotes && <button type="button" onClick={() => setBulkNotes('')} className="text-[10px] text-muted-foreground hover:text-foreground">limpar</button>}
                  </Label>
                  <Textarea value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} placeholder="Não alterar (deixe vazio)" rows={2} disabled={isPending} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pré-visualização de impacto */}
        {showPreview && impactSummary && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-2">
            <p className="font-semibold text-primary">
              Você está prestes a alterar {impactSummary.total} lançamento(s):
            </p>
            <ul className="space-y-1 ml-2">
              {impactSummary.fieldNames.map(f => {
                const overw = impactSummary.overwriteCounts[f] ?? 0;
                return (
                  <li key={f} className="text-muted-foreground">
                    • <strong className="text-foreground">{f}</strong> — {overw} já preenchido(s){' '}
                    {overwriteExisting
                      ? <span className="text-destructive font-medium">(serão sobrescritos)</span>
                      : <span className="text-emerald-700 font-medium">(serão mantidos)</span>}
                  </li>
                );
              })}
            </ul>
            <div className="pt-1 border-t border-primary/20">
              <p className="text-muted-foreground">
                <strong>Origens:</strong>{' '}
                {Object.entries(impactSummary.origens).map(([o, n]) => `${o} (${n})`).join(' • ')}
              </p>
              {Object.keys(impactSummary.anos).length > 0 && (
                <p className="text-muted-foreground">
                  <strong>Anos:</strong>{' '}
                  {Object.entries(impactSummary.anos).sort().map(([y, n]) => `${y} (${n})`).join(' • ')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Progresso */}
        {progress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Atualizando…</span>
              <span className="font-medium">{progress.done} / {progress.total}</span>
            </div>
            <Progress value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0} className="h-2" />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          {!showPreview ? (
            <Button onClick={() => setShowPreview(true)} disabled={isPending || !impactSummary}>
              Pré-visualizar impacto
            </Button>
          ) : (
            <Button
              onClick={handleApply}
              disabled={isPending}
              className={cn(overwriteExisting && 'bg-destructive hover:bg-destructive/90')}
            >
              {isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Confirmar alteração de {selectedTransactions.length} lançamento(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Sub-componente: campo Select com label e botão "limpar" padrão -----
function BulkSelectField({
  label, value, onChange, disabled, children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center justify-between">
        <span>{label}</span>
        {value && (
          <button type="button" onClick={() => onChange('')} className="text-[10px] text-muted-foreground hover:text-foreground" disabled={disabled}>
            limpar
          </button>
        )}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder="Não alterar" /></SelectTrigger>
        <SelectContent className="max-h-[280px]">{children}</SelectContent>
      </Select>
    </div>
  );
}
