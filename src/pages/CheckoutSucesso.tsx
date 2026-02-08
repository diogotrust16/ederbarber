import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Crown, ArrowRight } from "lucide-react";

const CheckoutSucesso = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-redirect after 10 seconds
    const timer = setTimeout(() => {
      navigate("/planos");
    }, 10000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <Logo />

      <main className="container max-w-md mx-auto px-4 flex-1 flex items-center justify-center">
        <Card className="w-full animate-scale-in">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center animate-fade-in">
                <CheckCircle className="h-10 w-10 text-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Assinatura Confirmada!
              </h1>
              <p className="text-muted-foreground">
                Seu pagamento foi processado com sucesso. Sua assinatura já está ativa.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-primary">
              <Crown className="h-5 w-5" />
              <span className="font-medium">Você agora é um assinante</span>
            </div>

            <div className="space-y-3 pt-2">
              <Button
                onClick={() => navigate("/planos")}
                className="w-full"
              >
                Ver Meus Planos
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="w-full"
              >
                Agendar Horário
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Você será redirecionado automaticamente em alguns segundos...
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CheckoutSucesso;
