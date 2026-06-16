import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ContractorType = 'pessoa_fisica' | 'pessoa_juridica';
export type ContractDocumentStatus = 'rascunho' | 'em_revisao' | 'aguardando_aceite' | 'aceito' | 'cancelado';

export interface ContractTemplate {
  id: string;
  name: string;
  service_type: string | null;
  description: string | null;
  cover_title: string | null;
  cover_subtitle: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContractClause {
  id: string;
  template_id: string;
  title: string;
  body: string;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContractDocument {
  id: string;
  template_id: string | null;
  title: string;
  status: ContractDocumentStatus;
  contractor_type: ContractorType;
  contractor_name: string;
  contractor_document: string;
  contractor_email: string | null;
  contractor_phone: string | null;
  contractor_address: string | null;
  contractor_responsible: string | null;
  plan_name: string | null;
  plan_value: number | null;
  payment_terms: string | null;
  start_date: string | null;
  end_date: string | null;
  digital_snapshot: Record<string, unknown>;
  accepted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractDocumentClause {
  id: string;
  document_id: string;
  source_clause_id: string | null;
  title: string;
  body: string;
  display_order: number;
  created_at: string;
}

export interface AcceptanceLink {
  id: string;
  document_id: string;
  token: string;
  status: 'aguardando' | 'aceito' | 'expirado' | 'cancelado';
  expires_at: string | null;
  accepted_at: string | null;
  accepted_name: string | null;
  accepted_document: string | null;
  accepted_email: string | null;
  accepted_ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ContractCreationInput {
  templateId: string;
  contractorType: ContractorType;
  contractorName: string;
  contractorDocument: string;
  contractorEmail?: string;
  contractorPhone?: string;
  contractorAddress?: string;
  contractorResponsible?: string;
  planName?: string;
  planValue?: number;
  paymentTerms?: string;
  startDate?: string;
  endDate?: string;
  selectedClauseIds: string[];
}

const onlyDigits = (value: string) => value.replace(/\D/g, '');

export function formatCpfCnpj(value: string) {
  const digits = onlyDigits(value);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  return digit === Number(cpf[10]);
}

export function isValidCnpj(value: string) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const calc = (length: number) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, weight, index) => acc + Number(cnpj[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

export function useContractTemplates() {
  return useQuery({
    queryKey: ['contract-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_templates' as any)
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ContractTemplate[];
    },
  });
}

export function useContractClauses(templateId?: string | null) {
  return useQuery({
    queryKey: ['contract-clauses', templateId],
    enabled: !!templateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_clauses' as any)
        .select('*')
        .eq('template_id', templateId)
        .eq('active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as ContractClause[];
    },
  });
}

export function useContractDocuments() {
  return useQuery({
    queryKey: ['contract-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_documents' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ContractDocument[];
    },
  });
}

export function useContractDocumentClauses(documentId?: string | null) {
  return useQuery({
    queryKey: ['contract-document-clauses', documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_document_clauses' as any)
        .select('*')
        .eq('document_id', documentId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as ContractDocumentClause[];
    },
  });
}

export function useCreateContractDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ContractCreationInput) => {
      if (input.contractorType === 'pessoa_fisica' && !isValidCpf(input.contractorDocument)) {
        throw new Error('CPF inválido. Confira os números informados.');
      }
      if (input.contractorType === 'pessoa_juridica' && !isValidCnpj(input.contractorDocument)) {
        throw new Error('CNPJ inválido. Confira os números informados.');
      }

      const { data: template, error: templateError } = await supabase
        .from('contract_templates' as any)
        .select('*')
        .eq('id', input.templateId)
        .single();
      if (templateError) throw templateError;

      const { data: sourceClauses, error: clausesError } = await supabase
        .from('contract_clauses' as any)
        .select('*')
        .in('id', input.selectedClauseIds)
        .order('display_order', { ascending: true });
      if (clausesError) throw clausesError;

      const clauses = (sourceClauses || []) as ContractClause[];
      const snapshot = {
        template,
        contractor: {
          type: input.contractorType,
          name: input.contractorName,
          document: formatCpfCnpj(input.contractorDocument),
          email: input.contractorEmail || null,
          phone: input.contractorPhone || null,
          address: input.contractorAddress || null,
          responsible: input.contractorResponsible || null,
        },
        commercial: {
          plan_name: input.planName || null,
          plan_value: input.planValue || null,
          payment_terms: input.paymentTerms || null,
          start_date: input.startDate || null,
          end_date: input.endDate || null,
        },
        clauses: clauses.map((clause, index) => ({
          source_clause_id: clause.id,
          title: clause.title,
          body: clause.body,
          display_order: index + 1,
        })),
      };

      const { data: document, error: documentError } = await supabase
        .from('contract_documents' as any)
        .insert({
          template_id: input.templateId,
          title: `${template.name} - ${input.contractorName}`,
          status: 'rascunho',
          contractor_type: input.contractorType,
          contractor_name: input.contractorName,
          contractor_document: formatCpfCnpj(input.contractorDocument),
          contractor_email: input.contractorEmail || null,
          contractor_phone: input.contractorPhone || null,
          contractor_address: input.contractorAddress || null,
          contractor_responsible: input.contractorResponsible || null,
          plan_name: input.planName || null,
          plan_value: input.planValue || null,
          payment_terms: input.paymentTerms || null,
          start_date: input.startDate || null,
          end_date: input.endDate || null,
          digital_snapshot: snapshot,
        })
        .select()
        .single();
      if (documentError) throw documentError;

      const documentClauses = clauses.map((clause, index) => ({
        document_id: document.id,
        source_clause_id: clause.id,
        title: clause.title,
        body: clause.body,
        display_order: index + 1,
      }));

      if (documentClauses.length) {
        const { error: insertClausesError } = await supabase
          .from('contract_document_clauses' as any)
          .insert(documentClauses);
        if (insertClausesError) throw insertClausesError;
      }

      return document as ContractDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-documents'] });
    },
  });
}

export function useCreateAcceptanceLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const token = crypto.randomUUID().replace(/-/g, '');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 15);

      const { data: link, error: linkError } = await supabase
        .from('contract_acceptance_links' as any)
        .insert({
          document_id: documentId,
          token,
          status: 'aguardando',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();
      if (linkError) throw linkError;

      const { error: documentError } = await supabase
        .from('contract_documents' as any)
        .update({ status: 'aguardando_aceite' })
        .eq('id', documentId);
      if (documentError) throw documentError;

      return link as AcceptanceLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-documents'] });
    },
  });
}

export function useAcceptanceBundle(token?: string) {
  return useQuery({
    queryKey: ['contract-acceptance-bundle', token],
    enabled: !!token,
    queryFn: async () => {
      const { data: link, error: linkError } = await supabase
        .from('contract_acceptance_links' as any)
        .select('*')
        .eq('token', token)
        .eq('status', 'aguardando')
        .maybeSingle();
      if (linkError) throw linkError;
      if (!link) throw new Error('Link de aceite não encontrado ou expirado.');

      const { data: document, error: documentError } = await supabase
        .from('contract_documents' as any)
        .select('*')
        .eq('id', link.document_id)
        .single();
      if (documentError) throw documentError;

      const { data: clauses, error: clausesError } = await supabase
        .from('contract_document_clauses' as any)
        .select('*')
        .eq('document_id', link.document_id)
        .order('display_order', { ascending: true });
      if (clausesError) throw clausesError;

      return {
        link: link as AcceptanceLink,
        document: document as ContractDocument,
        clauses: (clauses || []) as ContractDocumentClause[],
      };
    },
  });
}

export function useAcceptContract() {
  return useMutation({
    mutationFn: async (input: {
      link: AcceptanceLink;
      document: ContractDocument;
      name: string;
      documentNumber: string;
      email: string;
    }) => {
      const acceptedAt = new Date().toISOString();
      const formattedDocument = formatCpfCnpj(input.documentNumber);
      const userAgent = navigator.userAgent;

      const { error: linkError } = await supabase
        .from('contract_acceptance_links' as any)
        .update({
          status: 'aceito',
          accepted_at: acceptedAt,
          accepted_name: input.name,
          accepted_document: formattedDocument,
          accepted_email: input.email,
          user_agent: userAgent,
        })
        .eq('id', input.link.id)
        .eq('status', 'aguardando');
      if (linkError) throw linkError;

      const { error: documentError } = await supabase
        .from('contract_documents' as any)
        .update({
          status: 'aceito',
          accepted_at: acceptedAt,
        })
        .eq('id', input.document.id);
      if (documentError) throw documentError;

      const { error: eventError } = await supabase
        .from('contract_acceptance_events' as any)
        .insert({
          document_id: input.document.id,
          acceptance_link_id: input.link.id,
          event_type: 'aceite_digital',
          actor_name: input.name,
          actor_document: formattedDocument,
          actor_email: input.email,
          user_agent: userAgent,
          metadata: {
            source: 'public_acceptance_page',
            accepted_at: acceptedAt,
          },
        });
      if (eventError) throw eventError;

      return { acceptedAt };
    },
  });
}
