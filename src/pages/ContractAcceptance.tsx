import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Logo } from '@/components/brand/Logo';
import { formatCurrency } from '@/data/mockData';
import {
  formatCpfCnpj,
  isValidCnpj,
  isValidCpf,
  useAcceptContract,
  useAcceptanceBundle,
} from '@/hooks/useDigitalContracts';

export default function ContractAcceptance() {
  const { token } = useParams();
  const { data, isLoading, error, refetch } = useAcceptanceBundle(token);
  const acceptContract = useAcceptContract();
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    documentNumber: '',
    email: '',
    confirmed: false,
  });

  const expectedDocumentType = data?.document.contractor_type;
  const documentValid = useMemo(() => {
    if (!form.documentNumber) return false;
    return expectedDocumentType === 'pessoa_fisica'
      ? isValidCpf(form.documentNumber)
      : isValidCnpj(form.documentNumber);
  }, [expectedDocumentType, form.documentNumber]);

  const canAccept = !!form.name.trim() && !!form.email.trim() && documentValid && form.confirmed;

  const handleAccept = async () => {
    if (!data || !canAccept) return;
    try {
      await acceptContract.mutateAsync({
        link: data.link,
        document: data.document,
        name: form.name,
        documentNumber: form.documentNumber,
        email: form.email,
      });
      setAccepted(true);
      toast.success('Aceite registrado com sucesso.');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar aceite.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-orange-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-orange-50 flex items-center justify-center p-6">
        <Card className="max-w-lg">
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
            <h1 className="mt-4 text-2xl font-bold">Link indisponível</h1>
            <p className="mt-2 text-muted-foreground">
              Este link de aceite não foi encontrado, já foi utilizado ou expirou.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { document, clauses } = data;

  return (
    <div className="min-h-screen bg-[#f7faf8]">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl border bg-white p-1 shadow-soft">
              <Logo variant="symbol" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="font-bold leading-tight">Ramos Engenharia</p>
              <p className="text-xs text-muted-foreground">Aceite digital de contrato</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <FileText className="w-4 h-4 mr-2" />
            PDF / imprimir
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <article className="bg-white rounded-3xl border shadow-soft overflow-hidden">
          <section className="min-h-[320px] bg-gradient-to-br from-emerald-50 via-white to-orange-50 p-8 md:p-12">
            <p className="text-xs uppercase tracking-[0.3em] text-primary font-bold">Contrato digital</p>
            <h1 className="mt-4 text-4xl md:text-5xl font-display font-bold text-foreground">
              {document.title}
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-10">
              <Info label="Contratante" value={document.contractor_name} />
              <Info label="Documento" value={document.contractor_document} />
              <Info label="Plano" value={document.plan_name || 'Não informado'} />
              <Info label="Valor" value={document.plan_value ? formatCurrency(Number(document.plan_value)) : 'A definir'} />
            </div>
          </section>

          <section className="p-8 md:p-12 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {clauses.map((clause, index) => (
              <section key={clause.id} className="break-inside-avoid">
                <h2 className="text-lg font-bold">
                  Cláusula {index + 1}ª - {clause.title}
                </h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground whitespace-pre-line">{clause.body}</p>
              </section>
            ))}
          </section>
        </article>

        <aside className="xl:sticky xl:top-24 h-fit">
          <Card className="border-primary/20">
            <CardContent className="p-5 space-y-4">
              {accepted ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-14 h-14 mx-auto text-income" />
                  <h2 className="mt-4 text-xl font-bold">Contrato aceito</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    O aceite foi registrado. Agora você pode baixar ou imprimir o PDF desta versão.
                  </p>
                  <Button className="mt-5 w-full" onClick={() => window.print()}>
                    <FileText className="w-4 h-4 mr-2" />
                    Baixar / imprimir PDF
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-bold">Confirmar aceite</h2>
                      <p className="text-xs text-muted-foreground">
                        Preencha seus dados para registrar ciência e concordância com esta versão.
                      </p>
                    </div>
                  </div>

                  <Field label="Nome de quem aceita *">
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </Field>
                  <Field label={expectedDocumentType === 'pessoa_fisica' ? 'CPF *' : 'CNPJ *'}>
                    <Input
                      value={formatCpfCnpj(form.documentNumber)}
                      onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                      className={form.documentNumber && !documentValid ? 'border-expense' : ''}
                    />
                  </Field>
                  <Field label="E-mail *">
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </Field>

                  <div className="rounded-2xl border bg-muted/30 p-3">
                    <label className="flex items-start gap-3 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={form.confirmed}
                        onChange={(e) => setForm({ ...form, confirmed: e.target.checked })}
                      />
                      <span>
                        Declaro que li o contrato digital apresentado nesta página e confirmo o aceite operacional dos termos.
                      </span>
                    </label>
                  </div>

                  <Textarea
                    readOnly
                    value="Este aceite registra data, hora e identificação técnica do navegador. Não substitui assinatura certificada quando ela for exigida."
                    className="text-xs text-muted-foreground"
                  />

                  <Button className="w-full" disabled={!canAccept || acceptContract.isPending} onClick={handleAccept}>
                    {acceptContract.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Aceitar contrato
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </aside>
      </main>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white/80 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
