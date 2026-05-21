import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput, parseBRLToNumber } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  ChevronLeft, ChevronRight, Check, Loader2, UserPlus, Users,
  DollarSign, Percent, Calendar, Info, FileText
} from 'lucide-react';
import { useFinancialEntities } from '@/hooks/useFinancialEntities';
import { cn } from '@/lib/utils';
import { 
  useRecurringClients, 
  useContractPlans, 
  useMinimumWageConfig,
  useCreateContractWithInstallments,
  useCreateClientWithContract,
  type CreateContractInput
} from '@/hooks/useRecurringContracts';
import { useTransactionCategories } from '@/hooks/useFinancialConfig';
import { formatCurrency } from '@/data/mockData';

interface NewRecurringContractModalProps {
  open: boolean;
  onClose: () => void;
  defaultYear?: number;
}

type Step = 'client' | 'pricing' | 'discount' | 'review';

const STEPS: { key: Step; label: string }[] = [
  { key: 'client', label: 'Cliente' },
  { key: 'pricing', label: 'Plano / Valor' },
  { key: 'discount', label: 'Descontos' },
  { key: 'review', label: 'Confirmar' },
];

type PricingModel = 'SM' | 'FIXED';
type DiscountType = 'factor' | 'value' | 'percent';

export function NewRecurringContractModal({ open, onClose, defaultYear }: NewRecurringContractModalProps) {
  const currentYear = defaultYear || new Date().getFullYear();
  
  const [step, setStep] = useState<Step>('client');
  const [isNewClient, setIsNewClient] = useState(false);
  
  // Client data
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', document: '' });
  
  // Pricing data
  const [pricingModel, setPricingModel] = useState<PricingModel>('SM');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [customFactor, setCustomFactor] = useState('');
  const [fixedValue, setFixedValue] = useState('');
  
  // Discount data
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountDuration, setDiscountDuration] = useState<'months' | 'date'>('months');
  const [discountMonths, setDiscountMonths] = useState('');
  const [discountUntil, setDiscountUntil] = useState('');
  
  // Contract data
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [year, setYear] = useState(currentYear);
  const [diaVencimento, setDiaVencimento] = useState(10);
  const [exigirNF, setExigirNF] = useState<'SEMPRE' | 'NUNCA' | 'PERGUNTAR'>('PERGUNTAR');
  const [notes, setNotes] = useState('');
  
  // Data hooks
  const { data: clients } = useRecurringClients();
  const { data: plans } = useContractPlans();
  const { data: minimumWageConfigs } = useMinimumWageConfig(year);
  const { data: categories } = useTransactionCategories();
  const { data: entities } = useFinancialEntities();

  // Auto-set Patrick as responsible
  const patrickEntity = useMemo(() => 
    entities?.find(e => e.name?.toUpperCase() === 'PATRICK' && e.type === 'SOCIO'),
    [entities]
  );
  
  const createContract = useCreateContractWithInstallments();
  const createClientWithContract = useCreateClientWithContract();

  const minimumWageValue = minimumWageConfigs?.[0]?.value || 1518;

  const selectedPlan = useMemo(() => 
    plans?.find(p => p.id === selectedPlanId), 
    [plans, selectedPlanId]
  );

  const selectedClient = useMemo(() => 
    clients?.find(c => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  // Calculate effective value
  const effectiveMonthlyValue = useMemo(() => {
    if (pricingModel === 'FIXED') {
      return parseBRLToNumber(fixedValue) || 0;
    }
    const factor = customFactor ? parseFloat(customFactor) : (selectedPlan?.minimum_wage_factor || 1);
    return factor * minimumWageValue;
  }, [pricingModel, fixedValue, customFactor, selectedPlan, minimumWageValue]);

  const discountedValue = useMemo(() => {
    if (!hasDiscount || !discountAmount) return effectiveMonthlyValue;
    const amount = parseBRLToNumber(discountAmount) || 0;
    switch (discountType) {
      case 'factor': return (getEffectiveFactor() - amount) * minimumWageValue;
      case 'value': return effectiveMonthlyValue - amount;
      case 'percent': return effectiveMonthlyValue * (1 - amount / 100);
      default: return effectiveMonthlyValue;
    }
  }, [hasDiscount, discountAmount, discountType, effectiveMonthlyValue, minimumWageValue]);

  function getEffectiveFactor() {
    return customFactor ? parseFloat(customFactor) : (selectedPlan?.minimum_wage_factor || 1);
  }

  const clientName = isNewClient ? newClient.name : (selectedClient?.name || '');
  const planName = pricingModel === 'FIXED' 
    ? 'Valor Fixo' 
    : (selectedPlan?.name || 'Personalizado');

  const resetForm = () => {
    setStep('client');
    setIsNewClient(false);
    setSelectedClientId('');
    setNewClient({ name: '', email: '', phone: '', document: '' });
    setPricingModel('SM');
    setSelectedPlanId('');
    setCustomFactor('');
    setFixedValue('');
    setHasDiscount(false);
    setDiscountType('percent');
    setDiscountAmount('');
    setDiscountDuration('months');
    setDiscountMonths('');
    setDiscountUntil('');
    setStartDate(`${currentYear}-01-01`);
    setYear(currentYear);
    setDiaVencimento(10);
    setExigirNF('PERGUNTAR');
    setNotes('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    const discountAmountNum = parseBRLToNumber(discountAmount) || 0;
    const discountMonthsNum = parseInt(discountMonths) || undefined;

    // Responsável padrão: Patrick (sócio)
    const responsavelId = patrickEntity?.id || null;

    if (isNewClient) {
      await createClientWithContract.mutateAsync({
        clientName: newClient.name,
        clientEmail: newClient.email || undefined,
        clientPhone: newClient.phone || undefined,
        clientDocument: newClient.document || undefined,
        plan_id: pricingModel === 'SM' ? selectedPlanId || undefined : undefined,
        custom_minimum_wage_factor: customFactor ? parseFloat(customFactor) : undefined,
        fixed_value: pricingModel === 'FIXED' ? parseBRLToNumber(fixedValue) || 0 : undefined,
        start_date: startDate,
        year,
        dia_vencimento: diaVencimento,
        exigir_emissao_nf: exigirNF,
        responsavel_id: responsavelId,
      });
    } else {
      const input: CreateContractInput = {
        client_id: selectedClientId,
        plan_id: pricingModel === 'SM' ? selectedPlanId || undefined : undefined,
        custom_minimum_wage_factor: customFactor ? parseFloat(customFactor) : undefined,
        fixed_value: pricingModel === 'FIXED' ? parseBRLToNumber(fixedValue) || 0 : undefined,
        start_date: startDate,
        notes: notes || undefined,
        year,
        dia_vencimento: diaVencimento,
        exigir_emissao_nf: exigirNF,
        responsavel_id: responsavelId,
        ...(hasDiscount && discountAmountNum > 0 ? {
          discount_type: discountType,
          discount_amount: discountAmountNum,
          discount_months: discountDuration === 'months' ? discountMonthsNum : undefined,
          discount_until: discountDuration === 'date' ? discountUntil : undefined,
        } : {}),
      };
      await createContract.mutateAsync(input);
    }

    handleClose();
  };

  const isSubmitting = createContract.isPending || createClientWithContract.isPending;

  const canProceed = () => {
    switch (step) {
      case 'client':
        return isNewClient ? newClient.name.trim().length > 0 : selectedClientId !== '';
      case 'pricing':
        return pricingModel === 'FIXED' ? fixedValue.trim().length > 0 : selectedPlanId !== '';
      case 'discount':
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    const idx = STEPS.findIndex(s => s.key === step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].key);
  };

  const goBack = () => {
    const idx = STEPS.findIndex(s => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1].key);
  };

  const currentStepIdx = STEPS.findIndex(s => s.key === step);

  const startMonth = new Date(startDate).getMonth() + 1;
  const installmentsCount = Math.max(0, 12 - startMonth + 1);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-income" />
            Novo Contrato Recorrente
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((s, idx) => (
            <div key={s.key} className="flex items-center flex-1">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                idx <= currentStepIdx 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
              )}>
                {idx < currentStepIdx ? <Check className="w-3.5 h-3.5" /> : idx + 1}
              </div>
              <span className={cn(
                "text-xs ml-1 hidden sm:inline",
                idx <= currentStepIdx ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                {s.label}
              </span>
              {idx < STEPS.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 mx-2",
                  idx < currentStepIdx ? "bg-primary" : "bg-muted"
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Step: Client */}
        {step === 'client' && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button 
                variant={!isNewClient ? "default" : "outline"} 
                size="sm" 
                onClick={() => setIsNewClient(false)}
                className="flex-1"
              >
                <Users className="w-4 h-4 mr-1" /> Cliente Existente
              </Button>
              <Button 
                variant={isNewClient ? "default" : "outline"} 
                size="sm"
                onClick={() => setIsNewClient(true)}
                className="flex-1"
              >
                <UserPlus className="w-4 h-4 mr-1" /> Novo Cliente
              </Button>
            </div>

            {!isNewClient ? (
              <div>
                <Label>Selecionar Cliente *</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Buscar cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.document ? `(${c.document})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Nome do Cliente *</Label>
                  <Input 
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    placeholder="Nome completo ou razão social"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Telefone</Label>
                    <Input 
                      value={newClient.phone}
                      onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div>
                    <Label>Documento</Label>
                    <Input 
                      value={newClient.document}
                      onChange={(e) => setNewClient({ ...newClient, document: e.target.value })}
                      placeholder="CPF/CNPJ"
                    />
                  </div>
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input 
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Pricing */}
        {step === 'pricing' && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-2">
              <Button 
                variant={pricingModel === 'SM' ? "default" : "outline"} 
                size="sm"
                onClick={() => setPricingModel('SM')}
                className="flex-1"
              >
                Salário Mínimo (SM)
              </Button>
              <Button 
                variant={pricingModel === 'FIXED' ? "default" : "outline"} 
                size="sm"
                onClick={() => setPricingModel('FIXED')}
                className="flex-1"
              >
                <DollarSign className="w-4 h-4 mr-1" /> Valor Fixo (R$)
              </Button>
            </div>

            {pricingModel === 'SM' ? (
              <div className="space-y-4">
                <div>
                  <Label>Plano *</Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans?.filter(p => p.active).map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {p.minimum_wage_factor} SM ({formatCurrency(p.minimum_wage_factor * minimumWageValue)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Fator Customizado (opcional)</Label>
                  <Input 
                    value={customFactor}
                    onChange={(e) => setCustomFactor(e.target.value)}
                    placeholder={selectedPlan ? `Padrão: ${selectedPlan.minimum_wage_factor}` : 'Ex: 1.0'}
                    type="number"
                    step="0.25"
                    min="0.25"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Sobrescreve o fator do plano para este cliente específico
                  </p>
                </div>

                <Card className="bg-muted/50">
                  <CardContent className="p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SM {year}:</span>
                      <span className="font-medium">{formatCurrency(minimumWageValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fator:</span>
                      <span className="font-medium">{customFactor || selectedPlan?.minimum_wage_factor || '—'}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 mt-1">
                      <span className="font-medium">Valor Mensal:</span>
                      <span className="font-bold text-income">{formatCurrency(effectiveMonthlyValue)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Valor Fixo Mensal (R$) *</Label>
                  <CurrencyInput
                    value={fixedValue}
                    onValueChange={(value) => setFixedValue(value === null ? '' : String(value))}
                    placeholder="0,00"
                  />
                </div>
                <Card className="bg-muted/50">
                  <CardContent className="p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">Valor Mensal:</span>
                      <span className="font-bold text-income">{formatCurrency(effectiveMonthlyValue)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Data de Início</Label>
                <Input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Dia Vencimento</Label>
                <Input 
                  type="number" min={1} max={31}
                  value={diaVencimento}
                  onChange={(e) => setDiaVencimento(parseInt(e.target.value) || 10)}
                />
              </div>
              <div>
                <Label>Ano de Geração</Label>
                <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* NF Requirement */}
            <div>
              <Label className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Emissão de Nota Fiscal
              </Label>
              <Select value={exigirNF} onValueChange={(v) => setExigirNF(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEMPRE">Sempre emitir NF</SelectItem>
                  <SelectItem value="NUNCA">Nunca emitir NF (Recibo)</SelectItem>
                  <SelectItem value="PERGUNTAR">Perguntar a cada lançamento</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Define se os lançamentos deste contrato terão Nota Fiscal
              </p>
            </div>
          </div>
        )}

        {/* Step: Discount */}
        {step === 'discount' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">Aplicar desconto?</p>
                <p className="text-xs text-muted-foreground">Desconto temporário ou permanente</p>
              </div>
              <Switch checked={hasDiscount} onCheckedChange={setHasDiscount} />
            </div>

            {hasDiscount && (
              <div className="space-y-4">
                <div>
                  <Label>Tipo de Desconto</Label>
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percentual (%)</SelectItem>
                      <SelectItem value="value">Valor Fixo (R$)</SelectItem>
                      {pricingModel === 'SM' && (
                        <SelectItem value="factor">Redução de Fator SM</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>
                    {discountType === 'percent' ? 'Percentual (%)' : 
                     discountType === 'value' ? 'Valor (R$)' : 
                     'Reduzir fator em'}
                  </Label>
                  {discountType === 'value' ? (
                    <CurrencyInput
                      value={discountAmount}
                      onValueChange={(value) => setDiscountAmount(value === null ? '' : String(value))}
                      placeholder="0,00"
                    />
                  ) : (
                    <Input
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      placeholder={discountType === 'percent' ? 'Ex: 10' : 'Ex: 0.5'}
                    />
                  )}
                </div>

                <div>
                  <Label>Duração do Desconto</Label>
                  <div className="flex gap-2 mb-2">
                    <Button 
                      variant={discountDuration === 'months' ? "default" : "outline"} 
                      size="sm"
                      onClick={() => setDiscountDuration('months')}
                      className="flex-1"
                    >
                      <Calendar className="w-3.5 h-3.5 mr-1" /> Por Meses
                    </Button>
                    <Button 
                      variant={discountDuration === 'date' ? "default" : "outline"} 
                      size="sm"
                      onClick={() => setDiscountDuration('date')}
                      className="flex-1"
                    >
                      <Calendar className="w-3.5 h-3.5 mr-1" /> Até Data
                    </Button>
                  </div>

                  {discountDuration === 'months' ? (
                    <Input 
                      type="number"
                      value={discountMonths}
                      onChange={(e) => setDiscountMonths(e.target.value)}
                      placeholder="Quantidade de meses"
                      min={1}
                    />
                  ) : (
                    <Input 
                      type="date"
                      value={discountUntil}
                      onChange={(e) => setDiscountUntil(e.target.value)}
                    />
                  )}
                </div>

                <Card className="bg-muted/50">
                  <CardContent className="p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor original:</span>
                      <span>{formatCurrency(effectiveMonthlyValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Com desconto:</span>
                      <span className="font-bold text-income">{formatCurrency(Math.max(0, discountedValue))}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Economia:</span>
                      <span className="text-warning">{formatCurrency(effectiveMonthlyValue - Math.max(0, discountedValue))}/mês</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div>
              <Label>Observações</Label>
              <Textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condições especiais, notas do contrato..."
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Step: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            <Card className="border-income/30 bg-income/5">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Info className="w-4 h-4" /> Resumo do Contrato
                </h3>
                
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-medium">{clientName}</span>
                  
                  <span className="text-muted-foreground">Modelo:</span>
                  <span className="font-medium">
                    {pricingModel === 'SM' ? `Salário Mínimo (${planName})` : 'Valor Fixo'}
                  </span>

                  {pricingModel === 'SM' && (
                    <>
                      <span className="text-muted-foreground">Fator:</span>
                      <span className="font-medium">
                        {customFactor || selectedPlan?.minimum_wage_factor || '—'} SM
                      </span>
                    </>
                  )}

                  <span className="text-muted-foreground">Valor Mensal:</span>
                  <span className="font-bold text-income">{formatCurrency(effectiveMonthlyValue)}</span>

                  {hasDiscount && (
                    <>
                      <span className="text-muted-foreground">Com Desconto:</span>
                      <span className="font-bold text-warning">{formatCurrency(Math.max(0, discountedValue))}</span>
                    </>
                  )}

                  <span className="text-muted-foreground">Início:</span>
                  <span className="font-medium">{new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>

                  <span className="text-muted-foreground">Vencimento:</span>
                  <span className="font-medium">Dia {diaVencimento} de cada mês</span>

                  <span className="text-muted-foreground">Nota Fiscal:</span>
                  <span className="font-medium">
                    {exigirNF === 'SEMPRE' ? 'Sempre' : exigirNF === 'NUNCA' ? 'Nunca' : 'Perguntar'}
                  </span>

                  <span className="text-muted-foreground">Competências:</span>
                  <span className="font-medium">{installmentsCount} meses ({year})</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground mb-2">Descrição padrão dos lançamentos:</p>
                <Badge variant="outline" className="text-xs font-mono">
                  {clientName} — Recorrente — {planName} — MM/{year}
                </Badge>
              </CardContent>
            </Card>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm">
                <strong>{installmentsCount} transações</strong> de entrada serão geradas automaticamente, 
                cada uma com status <Badge variant="outline" className="text-xs">Em Aberto</Badge> e 
                vencimento no dia <strong>{diaVencimento}</strong> de cada mês.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-2 pt-4 border-t">
          {currentStepIdx > 0 && (
            <Button variant="outline" onClick={goBack} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
          )}
          
          {step !== 'review' ? (
            <Button 
              onClick={goNext} 
              disabled={!canProceed()}
              className="flex-1"
            >
              Próximo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="flex-1 bg-income hover:bg-income/90"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Criar Contrato e Gerar Competências
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
