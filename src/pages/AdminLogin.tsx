import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Phone } from "lucide-react";
import { z } from "zod";
import Header from "@/components/Header";
import Logo from "@/components/Logo";

const phoneSchema = z.string().min(10, "Telefone inválido");
const passwordSchema = z.string().min(4, "Senha deve ter no mínimo 4 caracteres");

const AdminLogin = () => {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)})${digits.slice(2)}`;
    return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
  };

  const validateForm = () => {
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      phoneSchema.parse(cleanPhone);
      passwordSchema.parse(password);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("admin-auth", {
        body: { phone, password },
      });

      if (error) {
        console.error("Auth error:", error);
        const serverMessage =
          "Não foi possível validar suas credenciais no momento. Verifique sua conexão e tente novamente.";

        toast({
          title: "Falha no login",
          description: serverMessage,
          variant: "destructive",
        });
        return;
      }

      if (!data.success) {
        toast({
          title: "Credenciais incorretas",
          description: data.error || "Telefone ou senha não conferem. Revise os dados e tente novamente.",
          variant: "destructive",
        });
        return;
      }

      // Store admin session with expiry
      localStorage.setItem("adminSession", JSON.stringify({
        token: data.sessionToken,
        admin: data.admin,
        expiresAt: data.expiresAt,
      }));

      toast({
        title: "Sucesso",
        description: `Bem-vindo, ${data.admin.name}!`,
      });

      navigate("/admin");
    } catch (err) {
      console.error("Login error:", err);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível concluir o login. Tente novamente em alguns segundos.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Logo />

      <main className="container max-w-md mx-auto px-4 pt-8">
        <div className="service-card p-6">
          <div className="text-center mb-6 animate-fade-in" style={{ animationDelay: '0ms' }}>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
              <Lock className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-xl font-header font-bold text-foreground mb-1">Acesso Admin</h1>
            <p className="text-sm text-muted-foreground">Entre com suas credenciais</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2 animate-fade-in" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
              <Label htmlFor="phone" className="text-foreground">
                Telefone
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/50" />
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(99)99999-9999"
                  className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                  maxLength={14}
                />
              </div>
            </div>

            <div className="space-y-2 animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
              <Label htmlFor="password" className="text-foreground">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/50" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="animate-fade-in" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Entrando..." : "Entrar"}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center animate-fade-in" style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-sm text-primary/70 hover:text-primary transition-colors"
            >
              ← Voltar para o site
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLogin;
