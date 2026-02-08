import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import logoImage from "@/assets/logo-eder-barbearia.png";
import { z } from "zod";

const emailSchema = z.string().email("Email inválido");
const passwordSchema = z.string().min(6, "Senha deve ter no mínimo 6 caracteres");

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn, signUp, user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !roleLoading && user) {
      if (isAdmin) {
        navigate("/admin");
      } else {
        navigate("/");
      }
    }
  }, [user, loading, roleLoading, isAdmin, navigate]);

  const validateForm = () => {
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      
      if (!isLogin) {
        if (!firstName.trim()) {
          toast({ title: "Erro", description: "Nome é obrigatório", variant: "destructive" });
          return false;
        }
        if (!lastName.trim()) {
          toast({ title: "Erro", description: "Sobrenome é obrigatório", variant: "destructive" });
          return false;
        }
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Erro", description: error.errors[0].message, variant: "destructive" });
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({ title: "Erro", description: "Email ou senha incorretos", variant: "destructive" });
          } else {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
          }
        } else {
          toast({ title: "Sucesso", description: "Login realizado com sucesso!" });
          navigate("/");
        }
      } else {
        const { error } = await signUp(email, password, {
          first_name: firstName,
          last_name: lastName,
          phone,
        });
        if (error) {
          if (error.message.includes("User already registered")) {
            toast({ title: "Erro", description: "Este email já está cadastrado", variant: "destructive" });
          } else {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
          }
        } else {
          toast({ title: "Sucesso", description: "Conta criada com sucesso!" });
          navigate("/");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-[#0a1628] py-3 px-4 border-b border-[#00d4aa]/30">
        <h1 className="font-header text-[#00d4aa] text-sm tracking-[0.3em] uppercase font-medium">
          Eder Barbearia
        </h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="logo-container mb-8">
          <img src={logoImage} alt="Eder Barbearia" className="w-24 h-24 object-contain" />
        </div>

        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl text-center mb-6">
            {isLogin ? "Entrar" : "Criar Conta"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nome</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Seu nome"
                    className="border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Sobrenome</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Seu sobrenome"
                    className="border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="border-primary"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="border-primary"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
            >
              {isSubmitting ? "Aguarde..." : isLogin ? "Entrar" : "Criar Conta"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin
                ? "Não tem conta? Cadastre-se"
                : "Já tem conta? Entre"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
