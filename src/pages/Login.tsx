import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Logo } from '@/components/brand/Logo';
import watermark from '@/assets/brand/watermark.png';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const getLoginErrorMessage = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes('invalid login credentials')) {
      return 'Credenciais inválidas. Verifique e-mail e senha.';
    }

    if (normalizedMessage.includes('email not confirmed')) {
      return 'Seu e-mail ainda não foi confirmado.';
    }

    return 'Não foi possível entrar agora. Tente novamente em instantes.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error('Preencha e-mail e senha');
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast.error(getLoginErrorMessage(error));
    }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background">
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-mesh p-12">
        <img
          src={watermark}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-20 -bottom-20 w-[640px] opacity-[0.06] select-none"
        />
        <div className="relative z-10">
          <Logo variant="vertical" className="h-40 w-auto" />
        </div>
        <div className="relative z-10 space-y-3 max-w-md">
          <h2 className="font-display text-3xl font-bold leading-tight text-foreground">
            Gestão financeira <span className="text-brand">inteligente</span>
            <br />
            para a Ramos Engenharia.
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Controle de receitas, despesas, contratos recorrentes e DRE em um único lugar,
            com a clareza visual que a sua operação merece.
          </p>
        </div>
        <p className="relative z-10 text-xs text-muted-foreground/70 tracking-wide uppercase">
          Ramos Engenharia | Consulting & Solutions | © 2026
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 animate-fade-in">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex flex-col items-center gap-3 text-center">
            <Logo variant="symbol" className="h-16 w-16" />
            <div>
              <h1 className="font-display text-xl font-bold">Ramos Engenharia</h1>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Financeiro</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-bold tracking-tight">Bem-vindo de volta</h2>
            <p className="text-sm text-muted-foreground">Acesse sua conta para continuar.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="brand"
              size="lg"
              disabled={loading}
              className="w-full"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground tracking-wide">
            Acesso restrito | Equipe Ramos Engenharia
          </p>
        </div>
      </div>
    </div>
  );
}
