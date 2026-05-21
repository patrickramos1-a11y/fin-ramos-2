import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput, parseBRLToNumber } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Check, Loader2, ArrowDownCircle, ArrowUpCircle, Repeat, Split, FileText, AlertCircle } from 'lucide-react';
import { useCreateTransaction, useClients } from '@/hooks/useTransactions';
import { useAuth } from '@/hooks/useAuth';
import { useTransactionCategories, usePaymentMethods, type CategorySubtype } from '@/hooks/useFinancialConfig';
import { useSaveTransactionEntities } from '@/hooks/useTransactionEntities';
import { useNFPercentual, useNFEditavel, type OrigemReceita, type DocumentoRecebimento } from '@/hooks/useFiscalConfig';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MultiEntitySelector } from './MultiEntitySelector';
import { CategoryFilteredSelector } from './CategoryFilteredSelector';

interface QuickTransactionModalProps {
  open: boolean;
  onClose: () => void;
  tipo: 'ENTRADA' | 'SAIDA';
  natureza: 'AVULSA';
  defaultMonth?: number;
  defaultYear?: number;
  filterSubtype?: CategorySubtype;
}

export function QuickTransactionModal({ 
  open, onClose, tipo, natureza, defaultMonth, defaultYear, filterSubtype
}: QuickTransactionModalProps) {
  const currentDate = new Date();
  const month = defaultMonth || currentDate.getMonth() + 1;
  const year = defaultYear || currentDate.getFullYear();

  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    cliente_id: '',
    categoria_id: '',
    forma_pagamento_id: '',
    data_vencimento: currentDate.toISOString().split('T')[0],
    competencia_mes: month,
    competencia_ano: year,
    notes: '',
    // New fiscal fields for ENTRADA
    origem_receita: '' as string,
    documento_recebimento: '' as string,
    nf_percentual_aplicado: '',
  });

  const [entityIds, setEntityIds] = useState<string[]>([]);
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterCostCenterId, setFilterCostCenterId] = useState('');
  const [accountIdOverride, setAccountIdOverride] = useState('');
  const [resolvedAccountId, setResolvedAccountId] = useState<string | null>(null);
  const [resolvedCostCenterId, setResolvedCostCenterId] = useState<string | null>(null);

  // Repetition state
  const [enableRepetition, setEnableRepetition] = useState(false);
  const [repetitionCount, setRepetitionCount] = useState(2);
  const [repetitionMode, setRepetitionMode] = useState<'parcelamento' | 'repeticao'>('parcelamento');

  const { data: clients } = useClients();
  const { data: categories } = useTransactionCategories();
  const { data: paymentMethods } = usePaymentMethods();
  const createTransaction = useCreateTransaction();
  const { user } = useAuth();
  const saveEntities = useSaveTransactionEntities();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nfPercentualPadrao = useNFPercentual();
  const nfEditavel = useNFEditavel();

  const effectiveSubtype = filterSubtype || (tipo === 'ENTRADA' ? 'AVULSA' : 'VARIAVEL');
  const selectedCategory = categories?.find(c => c.id === formData.categoria_id);

  const isEntrada = tipo === 'ENTRADA';
  const isVariavel = effectiveSubtype === 'VARIAVEL';
  const label = isEntrada ? 'Nova Entrada Avulsa' : 'Nova Despesa Variável';

  // NF calculations
  const isNF = formData.documento_recebimento === 'NOTA_FISCAL';
  const nfPercentual = formData.nf_percentual_aplicado 
    ? parseFloat(formData.nf_percentual_aplicado) 
    : nfPercentualPadrao;
  const valorBruto = parseBRLToNumber(formData.valor) || 0;
  const valorImpostoNF = isNF ? valorBruto * nfPercentual : 0;
  const valorLiquidoNF = isNF ? valorBruto - valorImpostoNF : valorBruto;

  const resetForm = () => {
    setFormData({
      descricao: '', valor: '', cliente_id: '', categoria_id: '',
      forma_pagamento_id: '',
      data_vencimento: currentDate.toISOString().split('T')[0],
      competencia_mes: month, competencia_ano: year, notes: '',
      origem_receita: '', documento_recebimento: '', nf_percentual_aplicado: '',
    });
    setEntityIds([]);
    setFilterAccountId('');
    setFilterCostCenterId('');
    setAccountIdOverride('');
    setResolvedAccountId(null);
    setResolvedCostCenterId(null);
    setEnableRepetition(false);
    setRepetitionCount(2);
    setRepetitionMode('parcelamento');
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleSubmit = async () => {
    const valorTotal = parseBRLToNumber(formData.valor) || 0;

    // Guard final: bloqueia órfã
    if (formData.categoria_id && !resolvedAccountId) {
      toast.error('Selecione uma Conta — a categoria escolhida não tem conta padrão.');
      return;
    }

    if (!enableRepetition || repetitionCount <= 1) {
      const result = await createTransaction.mutateAsync({
        tipo_movimento: tipo,
        natureza,
        origem: 'LANCAMENTO_MANUAL',
        cliente_id: formData.cliente_id || null,
        competencia_mes: formData.competencia_mes,
        competencia_ano: formData.competencia_ano,
        valor: valorTotal,
        data_vencimento: formData.data_vencimento,
        descricao: formData.descricao,
        categoria_id: formData.categoria_id || null,
        centro_custo_id: resolvedCostCenterId,
        conta_id: resolvedAccountId,
        forma_pagamento_id: formData.forma_pagamento_id || null,
        notes: formData.notes || null,
        entity_id: entityIds[0] || null,
        created_by_user_id: user?.id,
        // Fiscal fields
        ...(isEntrada ? {
          origem_receita: formData.origem_receita || null,
          documento_recebimento: formData.documento_recebimento || null,
          nf_percentual_aplicado: isNF ? nfPercentual : null,
          valor_imposto_nf: isNF ? valorImpostoNF : null,
          valor_liquido_nf: isNF ? valorLiquidoNF : null,
        } : {}),
      } as any);

      // Save multi-entity links
      if (entityIds.length > 0 && result?.id) {
        await saveEntities.mutateAsync({ transactionId: result.id, entityIds });
      }

      handleClose();
      return;
    }

    // Batch creation for repetition/installments
    setIsSubmitting(true);
    try {
      const valorParcela = repetitionMode === 'parcelamento' 
        ? Math.round((valorTotal / repetitionCount) * 100) / 100 
        : valorTotal;

      let currentMonth = formData.competencia_mes;
      let currentYear = formData.competencia_ano;

      for (let i = 0; i < repetitionCount; i++) {
        const suffix = repetitionMode === 'parcelamento'
          ? ` - Parcela ${i + 1}/${repetitionCount}`
          : ` - Repetição ${i + 1}/${repetitionCount}`;

        const dueDate = new Date(currentYear, currentMonth - 1, new Date(formData.data_vencimento).getDate());

        const result = await createTransaction.mutateAsync({
          tipo_movimento: tipo,
          natureza,
          origem: 'LANCAMENTO_MANUAL',
          cliente_id: formData.cliente_id || null,
          competencia_mes: currentMonth,
          competencia_ano: currentYear,
          valor: valorParcela,
          data_vencimento: dueDate.toISOString().split('T')[0],
          descricao: formData.descricao + suffix,
          categoria_id: formData.categoria_id || null,
          centro_custo_id: resolvedCostCenterId,
          conta_id: resolvedAccountId,
          forma_pagamento_id: formData.forma_pagamento_id || null,
          notes: formData.notes || null,
          entity_id: entityIds[0] || null,
          created_by_user_id: user?.id,
        } as any);

        if (entityIds.length > 0 && result?.id) {
          await saveEntities.mutateAsync({ transactionId: result.id, entityIds });
        }

        currentMonth++;
        if (currentMonth > 12) { currentMonth = 1; currentYear++; }
      }

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success(`${repetitionCount} lançamentos criados com sucesso!`);
      handleClose();
    } catch (error) {
      console.error('Batch creation error:', error);
      toast.error('Erro ao criar lançamentos em lote');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validation: ALL fields required except observações
  const baseFieldsValid = formData.descricao.trim().length > 0 
    && formData.valor.trim().length > 0 
    && formData.cliente_id.length > 0 
    && entityIds.length > 0 
    && formData.categoria_id.length > 0
    && formData.forma_pagamento_id.length > 0;
  const entradaFieldsValid = !isEntrada || (
    formData.documento_recebimento.length > 0 &&
    formData.origem_receita.length > 0
  );
  // Despesas fixas também precisam de documento fiscal
  const despesaDocValid = isEntrada || formData.documento_recebimento?.length > 0;
  // Conta deve estar resolvida (default da categoria ou override do usuário)
  const accountResolved = !formData.categoria_id || !!resolvedAccountId;
  const canSubmit = baseFieldsValid && entradaFieldsValid && despesaDocValid && accountResolved;
  const valorTotal = parseBRLToNumber(formData.valor) || 0;
  const valorParcela = enableRepetition && repetitionMode === 'parcelamento' && repetitionCount > 1
    ? Math.round((valorTotal / repetitionCount) * 100) / 100
    : valorTotal;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEntrada ? (
              <ArrowDownCircle className="w-5 h-5 text-income" />
            ) : (
              <ArrowUpCircle className="w-5 h-5 text-expense" />
            )}
            {label}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-2">
          <Badge variant="outline" className={isEntrada ? "text-income border-income/30" : "text-expense border-expense/30"}>
            {isEntrada ? 'Entrada' : 'Saída'}
          </Badge>
          <Badge variant="outline">Avulsa / Pontual</Badge>
        </div>

        <div className="space-y-4">
          {/* CATEGORY with pre-filters + inheritance panel + override */}
          <CategoryFilteredSelector
            tipo={tipo}
            subtype={effectiveSubtype as any}
            selectedCategoryId={formData.categoria_id}
            onCategoryChange={(v) => {
              setFormData({ ...formData, categoria_id: v });
              setAccountIdOverride('');
            }}
            filterAccountId={filterAccountId}
            onFilterAccountChange={(v) => setFilterAccountId(v === 'all' ? '' : v)}
            filterCostCenterId={filterCostCenterId}
            onFilterCostCenterChange={(v) => setFilterCostCenterId(v === 'all' ? '' : v)}
            overrideAccountId={accountIdOverride}
            onOverrideAccountChange={setAccountIdOverride}
            onResolvedAccountChange={setResolvedAccountId}
            onResolvedCostCenterChange={setResolvedCostCenterId}
          />

          <div>
            <Label>Descrição *</Label>
            <Input 
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder={isEntrada ? "Ex: Serviço de consultoria pontual" : "Ex: Compra de notebook"}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{enableRepetition && repetitionMode === 'parcelamento' ? 'Valor Total *' : 'Valor *'}</Label>
              <CurrencyInput
                value={formData.valor}
                onValueChange={(value) => setFormData({ ...formData, valor: value === null ? '' : String(value) })}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Data de Vencimento *</Label>
              <Input 
                type="date"
                value={formData.data_vencimento}
                onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
              />
            </div>
          </div>

          {/* REPETITION - only for variable expenses */}
          {isVariavel && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Repetir este lançamento</Label>
                </div>
                <Switch checked={enableRepetition} onCheckedChange={setEnableRepetition} />
              </div>

              {enableRepetition && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Modo</Label>
                      <Select value={repetitionMode} onValueChange={(v) => setRepetitionMode(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="parcelamento">
                            <div className="flex items-center gap-2">
                              <Split className="w-3 h-3" />
                              Parcelamento (divide valor)
                            </div>
                          </SelectItem>
                          <SelectItem value="repeticao">
                            <div className="flex items-center gap-2">
                              <Repeat className="w-3 h-3" />
                              Repetição (mesmo valor)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Quantas vezes</Label>
                      <Select value={repetitionCount.toString()} onValueChange={(v) => setRepetitionCount(parseInt(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 23 }, (_, i) => i + 2).map(n => (
                            <SelectItem key={n} value={n.toString()}>{n}x</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {valorTotal > 0 && (
                    <div className="text-xs text-muted-foreground bg-background rounded p-2 space-y-1">
                      {repetitionMode === 'parcelamento' ? (
                        <>
                          <p>Valor total: <strong>R$ {valorTotal.toFixed(2)}</strong></p>
                          <p>Valor por parcela: <strong>R$ {valorParcela.toFixed(2)}</strong></p>
                          <p>{repetitionCount} parcelas mensais a partir de {formData.competencia_mes}/{formData.competencia_ano}</p>
                        </>
                      ) : (
                        <>
                          <p>Valor por mês: <strong>R$ {valorTotal.toFixed(2)}</strong></p>
                          <p>Total acumulado: <strong>R$ {(valorTotal * repetitionCount).toFixed(2)}</strong></p>
                          <p>{repetitionCount} repetições mensais a partir de {formData.competencia_mes}/{formData.competencia_ano}</p>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Client - always required */}
          <div>
            <Label>Cliente (empresa) *</Label>
            <p className="text-[10px] text-muted-foreground -mt-0.5 mb-1">
              Empresa/CNPJ ao qual a transação se refere.
            </p>
            <Select value={formData.cliente_id} onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}>
              <SelectTrigger className={!formData.cliente_id ? 'border-destructive' : ''}>
                <SelectValue placeholder="Selecionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Multi-Entity Selector - always required */}
          <div>
            <MultiEntitySelector
              selectedIds={entityIds}
              onChange={setEntityIds}
              required
            />
            {entityIds.length === 0 && (
              <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Entidade é obrigatória
              </p>
            )}
          </div>

          {/* FISCAL FIELDS - Only for ENTRADA */}
          {isEntrada && (
            <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Dados Fiscais (Obrigatório)</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Origem da Receita *</Label>
                  <Select value={formData.origem_receita} onValueChange={(v) => setFormData({ ...formData, origem_receita: v })}>
                    <SelectTrigger className={!formData.origem_receita ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SERVICO">Serviço</SelectItem>
                      <SelectItem value="VENDA">Venda</SelectItem>
                      <SelectItem value="REEMBOLSO">Reembolso</SelectItem>
                      <SelectItem value="AJUSTE_FINANCEIRO">Ajuste Financeiro</SelectItem>
                      <SelectItem value="OUTRO">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Documento de Recebimento *</Label>
                  <Select 
                    value={formData.documento_recebimento} 
                    onValueChange={(v) => {
                      setFormData({ 
                        ...formData, 
                        documento_recebimento: v,
                        nf_percentual_aplicado: v === 'NOTA_FISCAL' ? (nfPercentualPadrao * 100).toString() : '',
                      });
                    }}
                  >
                    <SelectTrigger className={!formData.documento_recebimento ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NOTA_FISCAL">Nota Fiscal</SelectItem>
                      <SelectItem value="RECIBO">Recibo</SelectItem>
                      <SelectItem value="NOTA_DE_DEBITO">Nota de Débito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* NF Tax calculation */}
              {isNF && valorBruto > 0 && (
                <div className="bg-background rounded-lg p-2.5 space-y-1.5 text-xs border">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Percentual NF:</span>
                    {nfEditavel ? (
                      <Input 
                        className="w-20 h-6 text-xs text-right"
                        value={formData.nf_percentual_aplicado || (nfPercentualPadrao * 100).toString()}
                        onChange={(e) => setFormData({ ...formData, nf_percentual_aplicado: e.target.value })}
                        placeholder="9"
                      />
                    ) : (
                      <span className="font-medium">{(nfPercentualPadrao * 100).toFixed(0)}%</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor Bruto:</span>
                    <span className="font-medium">R$ {valorBruto.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-expense">
                    <span>Imposto NF:</span>
                    <span className="font-bold">- R$ {valorImpostoNF.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 text-income font-bold">
                    <span>Valor Líquido:</span>
                    <span>R$ {valorLiquidoNF.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DOCUMENTO FISCAL - For SAIDA (despesas) */}
          {!isEntrada && (
            <div>
              <Label>Documento Fiscal *</Label>
              <Select 
                value={formData.documento_recebimento} 
                onValueChange={(v) => setFormData({ ...formData, documento_recebimento: v })}
              >
                <SelectTrigger className={!formData.documento_recebimento ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecionar tipo de documento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOTA_FISCAL">Nota Fiscal</SelectItem>
                  <SelectItem value="RECIBO">Recibo</SelectItem>
                  <SelectItem value="NOTA_DE_DEBITO">Nota de Débito</SelectItem>
                  <SelectItem value="SEM_DOCUMENTO">Sem Documento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Forma de Pagamento *</Label>
              <Select value={formData.forma_pagamento_id} onValueChange={(v) => setFormData({ ...formData, forma_pagamento_id: v })}>
                <SelectTrigger className={!formData.forma_pagamento_id ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods?.filter(p => p.active).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Competência</Label>
              <div className="flex gap-1">
                <Select 
                  value={formData.competencia_mes.toString()} 
                  onValueChange={(v) => setFormData({ ...formData, competencia_mes: parseInt(v) })}
                >
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {new Date(2000, i, 1).toLocaleString('pt-BR', { month: 'short' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select 
                  value={formData.competencia_ano.toString()} 
                  onValueChange={(v) => setFormData({ ...formData, competencia_ano: parseInt(v) })}
                >
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea 
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas adicionais..."
              rows={2}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} className="flex-1">Cancelar</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit || createTransaction.isPending || isSubmitting}
            className="flex-1"
          >
            {(createTransaction.isPending || isSubmitting) ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            {enableRepetition && repetitionCount > 1
              ? `Criar ${repetitionCount} lançamentos`
              : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
