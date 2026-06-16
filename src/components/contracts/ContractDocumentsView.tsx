import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileCheck2,
  FileText,
  Link2,
  Loader2,
  PencilLine,
  Send,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/data/mockData';
import { cn } from '@/lib/utils';
import {
  ContractClause,
  ContractDocument,
  ContractDocumentClause,
  ContractTemplate,
  ContractorType,
  formatCpfCnpj,
  isValidCnpj,
  isValidCpf,
  useContractClauses,
  useContractDocumentClauses,
  useContractDocuments,
  useContractTemplates,
  useCreateAcceptanceLink,
  useCreateContractDocument,
} from '@/hooks/useDigitalContracts';

const statusLabels: Record<string, string> = {
  rascunho: 'Rascunho',
  em_revisao: 'Em revisão',
  aguardando_aceite: 'Aguardando aceite',
  aceito: 'Aceito',
  cancelado: 'Cancelado',
};

const statusClass: Record<string, string> = {
  rascunho: 'bg-muted text-muted-foreground',
  em_revisao: 'bg-blue-50 text-blue-700 border-blue-200',
  aguardando_aceite: 'bg-amber-50 text-amber-700 border-amber-200',
  aceito: 'bg-income/10 text-income border-income/20',
  cancelado: 'bg-expense/10 text-expense border-expense/20',
};

const emptyForm = {
  contractorType: 'pessoa_juridica' as ContractorType,
  contractorName: '',
  contractorDocument: '',
  contractorEmail: '',
  contractorPhone: '',
  contractorAddress: '',
  contractorResponsible: '',
  planName: 'Plano VIP',
  planValue: '',
  paymentTerms: 'Pagamento mensal conforme condições comerciais acordadas.',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
};

export function ContractDocumentsView() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedClauseIds, setSelectedClauseIds] = useState<string[]>([]);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const { data: templates = [], isLoading: loadingTemplates, error: templatesError } = useContractTemplates();
  const { data: clauses = [], isLoading: loadingClauses } = useContractClauses(selectedTemplateId);
  const { data: documents = [], isLoading: loadingDocuments } = useContractDocuments();
  const createDocument = useCreateContractDocument();
  const createAcceptanceLink = useCreateAcceptanceLink();

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || null;
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) || documents[0] || null;
  const { data: previewClauses = [] } = useContractDocumentClauses(selectedDocument?.id);

  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (clauses.length > 0 && selectedClauseIds.length === 0) {
      setSelectedClauseIds(clauses.map((clause) => clause.id));
    }
  }, [clauses, selectedClauseIds.length]);

  const documentIsValid = useMemo(() => {
    if (!form.contractorName.trim()) return false;
    if (form.contractorType === 'pessoa_fisica') return isValidCpf(form.contractorDocument);
    return isValidCnpj(form.contractorDocument);
  }, [form.contractorDocument, form.contractorName, form.contractorType]);

  const setField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleClause = (clauseId: string) => {
    setSelectedClauseIds((current) =>
      current.includes(clauseId)
        ? current.filter((id) => id !== clauseId)
        : [...current, clauseId]
    );
  };

  const handleCreateDocument = async () => {
    if (!selectedTemplateId) {
      toast.error('Selecione um modelo de contrato.');
      return;
    }
    if (!documentIsValid) {
      toast.error(form.contractorType === 'pessoa_fisica' ? 'Informe um CPF válido.' : 'Informe um CNPJ válido.');
      return;
    }
    if (selectedClauseIds.length === 0) {
      toast.error('Selecione pelo menos uma cláusula.');
      return;
    }

    try {
      const created = await createDocument.mutateAsync({
        templateId: selectedTemplateId,
        contractorType: form.contractorType,
        contractorName: form.contractorName,
        contractorDocument: form.contractorDocument,
        contractorEmail: form.contractorEmail,
        contractorPhone: form.contractorPhone,
        contractorAddress: form.contractorAddress,
        contractorResponsible: form.contractorResponsible,
        planName: form.planName,
        planValue: form.planValue ? Number(form.planValue) : undefined,
        paymentTerms: form.paymentTerms,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        selectedClauseIds,
      });
      setSelectedDocumentId(created.id);
      setGeneratedLink(null);
      toast.success('Contrato digital criado com snapshot das cláusulas.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar contrato digital.');
    }
  };

  const handleCreateAcceptanceLink = async (document: ContractDocument) => {
    try {
      const link = await createAcceptanceLink.mutateAsync(document.id);
      const url = `${window.location.origin}/contrato/aceite/${link.token}`;
      setSelectedDocumentId(document.id);
      setGeneratedLink(url);
      await navigator.clipboard?.writeText(url);
      toast.success('Link de aceite criado e copiado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar link de aceite.');
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard?.writeText(generatedLink);
    toast.success('Link copiado novamente.');
  };

  if (templatesError) {
    return (
      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="p-6">
          <p className="font-semibold text-amber-900">A estrutura de contratos digitais ainda não está aplicada no banco.</p>
          <p className="mt-2 text-sm text-amber-800">
            A migration `20260616143000_digital_contracts.sql` foi criada. Aplique as migrations no Supabase para liberar a tela.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="bg-gradient-to-br from-emerald-50 via-white to-orange-50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Criar contrato digital
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecione modelo, contratante, plano e cláusulas. O contrato gerado fica congelado para aceite.
                </p>
              </div>
              <Badge variant="outline" className="bg-white/80">
                Aceite simples v1
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">1. Modelo</h3>
                {loadingTemplates && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    active={template.id === selectedTemplateId}
                    onClick={() => {
                      setSelectedTemplateId(template.id);
                      setSelectedClauseIds([]);
                    }}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold text-sm">2. Contratante</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={form.contractorType === 'pessoa_juridica' ? 'default' : 'outline'}
                  onClick={() => setForm({ ...form, contractorType: 'pessoa_juridica', contractorDocument: '' })}
                  className="justify-center"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Pessoa Jurídica
                </Button>
                <Button
                  type="button"
                  variant={form.contractorType === 'pessoa_fisica' ? 'default' : 'outline'}
                  onClick={() => setForm({ ...form, contractorType: 'pessoa_fisica', contractorDocument: '', contractorResponsible: '' })}
                  className="justify-center"
                >
                  <User className="w-4 h-4 mr-2" />
                  Pessoa Física
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={form.contractorType === 'pessoa_fisica' ? 'Nome completo *' : 'Razão social *'}>
                  <Input value={form.contractorName} onChange={(e) => setField('contractorName', e.target.value)} placeholder="Nome do contratante" />
                </Field>
                <Field label={form.contractorType === 'pessoa_fisica' ? 'CPF *' : 'CNPJ *'}>
                  <Input
                    value={formatCpfCnpj(form.contractorDocument)}
                    onChange={(e) => setField('contractorDocument', e.target.value)}
                    placeholder={form.contractorType === 'pessoa_fisica' ? '000.000.000-00' : '00.000.000/0000-00'}
                    className={cn(
                      form.contractorDocument && !documentIsValid && 'border-expense focus-visible:ring-expense'
                    )}
                  />
                </Field>
                {form.contractorType === 'pessoa_juridica' && (
                  <Field label="Responsável">
                    <Input value={form.contractorResponsible} onChange={(e) => setField('contractorResponsible', e.target.value)} placeholder="Representante legal ou contato" />
                  </Field>
                )}
                <Field label="E-mail">
                  <Input type="email" value={form.contractorEmail} onChange={(e) => setField('contractorEmail', e.target.value)} placeholder="cliente@email.com" />
                </Field>
                <Field label="Telefone">
                  <Input value={form.contractorPhone} onChange={(e) => setField('contractorPhone', e.target.value)} placeholder="(00) 00000-0000" />
                </Field>
                <Field label="Endereço">
                  <Input value={form.contractorAddress} onChange={(e) => setField('contractorAddress', e.target.value)} placeholder="Endereço completo" />
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-semibold text-sm">3. Plano, valor e vigência</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Plano">
                  <Input value={form.planName} onChange={(e) => setField('planName', e.target.value)} placeholder="Plano VIP, Premium..." />
                </Field>
                <Field label="Valor do contrato">
                  <Input type="number" value={form.planValue} onChange={(e) => setField('planValue', e.target.value)} placeholder="0,00" />
                </Field>
                <Field label="Data de início">
                  <Input type="date" value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} />
                </Field>
                <Field label="Data de fim">
                  <Input type="date" value={form.endDate} onChange={(e) => setField('endDate', e.target.value)} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Condições de pagamento">
                    <Textarea value={form.paymentTerms} onChange={(e) => setField('paymentTerms', e.target.value)} rows={3} />
                  </Field>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">4. Cláusulas</h3>
                <span className="text-xs text-muted-foreground">{selectedClauseIds.length} selecionada(s)</span>
              </div>
              {loadingClauses ? (
                <div className="h-24 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {clauses.map((clause) => (
                    <ClauseToggle
                      key={clause.id}
                      clause={clause}
                      checked={selectedClauseIds.includes(clause.id)}
                      onToggle={() => toggleClause(clause.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border bg-muted/30 p-4">
              <div>
                <p className="font-semibold text-sm">Resumo pronto para gerar</p>
                <p className="text-xs text-muted-foreground">
                  O contrato será salvo como rascunho com cópia congelada das cláusulas selecionadas.
                </p>
              </div>
              <Button onClick={handleCreateDocument} disabled={createDocument.isPending || !documentIsValid || !selectedTemplateId}>
                {createDocument.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileCheck2 className="w-4 h-4 mr-2" />}
                Gerar contrato
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Contratos gerados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingDocuments ? (
              <div className="h-32 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                Nenhum contrato digital criado ainda.
              </div>
            ) : (
              documents.map((document) => (
                <button
                  key={document.id}
                  onClick={() => {
                    setSelectedDocumentId(document.id);
                    setGeneratedLink(null);
                  }}
                  className={cn(
                    'w-full text-left rounded-2xl border p-4 transition-all hover:border-primary/50 hover:bg-primary/5',
                    selectedDocument?.id === document.id && 'border-primary bg-primary/5'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{document.contractor_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{document.title}</p>
                    </div>
                    <Badge variant="outline" className={statusClass[document.status]}>
                      {statusLabels[document.status]}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{document.contractor_document}</span>
                    <span>{document.plan_name || 'Sem plano'}</span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {selectedDocument && (
        <Card className="overflow-hidden">
          <CardHeader className="bg-card">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <CardTitle>Prévia digital congelada</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Esta é a versão que será enviada para leitura e aceite do cliente.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => window.print()}>
                  <FileText className="w-4 h-4 mr-2" />
                  PDF / imprimir
                </Button>
                <Button
                  onClick={() => handleCreateAcceptanceLink(selectedDocument)}
                  disabled={createAcceptanceLink.isPending || selectedDocument.status === 'aceito'}
                >
                  {createAcceptanceLink.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Enviar para aceite
                </Button>
              </div>
            </div>
            {generatedLink && (
              <div className="mt-4 flex flex-col md:flex-row md:items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                <Link2 className="w-4 h-4 text-primary" />
                <code className="flex-1 text-xs break-all">{generatedLink}</code>
                <Button size="sm" variant="outline" onClick={handleCopyLink}>
                  <Clipboard className="w-4 h-4 mr-2" />
                  Copiar
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={generatedLink} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir
                  </a>
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <ContractPreview document={selectedDocument} clauses={previewClauses} template={selectedTemplate} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
    </div>
  );
}

function TemplateCard({ template, active, onClick }: { template: ContractTemplate; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border p-4 text-left transition-all',
        active ? 'border-primary bg-primary/5 shadow-soft' : 'hover:border-primary/40 hover:bg-muted/40'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('w-12 h-16 rounded-xl flex items-center justify-center', active ? 'bg-primary text-white' : 'bg-muted')}>
          <FileText className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">{template.name}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description || template.service_type}</p>
          <Badge variant="outline" className="mt-2 text-[10px]">{template.service_type || 'Modelo'}</Badge>
        </div>
      </div>
    </button>
  );
}

function ClauseToggle({ clause, checked, onToggle }: { clause: ContractClause; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-full rounded-xl border p-3 text-left transition-all',
        checked ? 'border-primary/50 bg-primary/5' : 'hover:bg-muted/50'
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center', checked && 'bg-primary border-primary text-white')}>
          {checked && <CheckCircle2 className="w-4 h-4" />}
        </span>
        <div>
          <p className="text-sm font-semibold">
            {clause.display_order}. {clause.title}
          </p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{clause.body}</p>
        </div>
      </div>
    </button>
  );
}

function ContractPreview({
  document,
  clauses,
  template,
}: {
  document: ContractDocument;
  clauses: ContractDocumentClause[];
  template: ContractTemplate | null;
}) {
  return (
    <article className="mx-auto max-w-4xl bg-white print:shadow-none print:border-0 rounded-3xl border shadow-soft overflow-hidden">
      <section className="min-h-[360px] bg-gradient-to-br from-emerald-50 via-white to-orange-50 p-8 md:p-12 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary font-bold">Ramos Engenharia</p>
            <h1 className="mt-4 text-4xl md:text-5xl font-display font-bold text-foreground">
              {template?.cover_title || 'Contrato de Prestação de Serviços'}
            </h1>
          </div>
          <Badge variant="outline" className={statusClass[document.status]}>
            {statusLabels[document.status]}
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
          <div className="rounded-2xl bg-white/80 border p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Contratante</p>
            <p className="mt-2 text-xl font-bold">{document.contractor_name}</p>
            <p className="text-sm text-muted-foreground">{document.contractor_document}</p>
            {document.contractor_responsible && <p className="text-sm mt-2">Responsável: {document.contractor_responsible}</p>}
          </div>
          <div className="rounded-2xl bg-white/80 border p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Resumo comercial</p>
            <p className="mt-2 text-xl font-bold">{document.plan_name || 'Plano não informado'}</p>
            <p className="text-sm text-muted-foreground">
              {document.plan_value ? formatCurrency(Number(document.plan_value)) : 'Valor a definir'}
            </p>
          </div>
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          {template?.cover_subtitle || 'Construindo o presente para preservar o futuro'}
        </p>
      </section>

      <section className="p-8 md:p-12 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Info label="E-mail" value={document.contractor_email || 'Não informado'} />
          <Info label="Telefone" value={document.contractor_phone || 'Não informado'} />
          <Info label="Endereço" value={document.contractor_address || 'Não informado'} />
          <Info label="Vigência" value={`${document.start_date || 'Início não informado'} até ${document.end_date || 'prazo indeterminado'}`} />
        </div>

        {document.payment_terms && (
          <div className="rounded-2xl border bg-muted/20 p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Condições de pagamento</p>
            <p className="mt-2 text-sm leading-relaxed">{document.payment_terms}</p>
          </div>
        )}

        <div className="space-y-6">
          {clauses.map((clause, index) => (
            <section key={clause.id} className="break-inside-avoid">
              <h2 className="text-lg font-bold">
                Cláusula {index + 1}ª - {clause.title}
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground whitespace-pre-line">{clause.body}</p>
            </section>
          ))}
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm">
          <p className="font-semibold text-primary">Trilha de aceite digital</p>
          <p className="mt-1 text-muted-foreground">
            Este documento usa aceite operacional simples. Ao aceitar pelo link, serão registrados nome, documento,
            e-mail, data, hora e identificação técnica do navegador.
          </p>
          {document.accepted_at && (
            <p className="mt-3 font-semibold text-income">Aceito em {new Date(document.accepted_at).toLocaleString('pt-BR')}</p>
          )}
        </div>
      </section>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
