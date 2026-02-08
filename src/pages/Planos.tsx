import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Logo from "@/components/Logo";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Crown, Loader2, Sparkles, Star, Gift, Calendar, Scissors, Heart } from "lucide-react";
import { useServices, Service } from "@/hooks/useServices";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Subscription {
  id: string;
  service_id: string;
  client_name: string;
  client_phone: string;
  status: string;
  start_date: string;
  end_date: string | null;
  service: {
    id: string;
    name: string;
    price: number;
    duration_minutes: number;
    description: string | null;
  };
}

const Planos = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"agendar" | "historico" | "planos">("planos");
  const { data: services, isLoading: servicesLoading } = useServices();
  const [mySubscriptions, setMySubscriptions] = useState<Subscription[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Service | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter only subscription services
  const subscriptionPlans = services?.filter(s => s.is_subscription) || [];

  // Check if user is logged in
  const isLoggedIn = !!localStorage.getItem("sessionToken");

  useEffect(() => {
    const savedName = localStorage.getItem("clientName");
    const savedPhone = localStorage.getItem("clientPhone");
    if (savedName) setClientName(savedName);
    if (savedPhone) setClientPhone(savedPhone);
  }, []);

  // Fetch user's subscriptions
  useEffect(() => {
    const fetchMySubscriptions = async () => {
      const sessionToken = localStorage.getItem("sessionToken");
      if (!sessionToken) {
        setLoadingSubscriptions(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('client-subscriptions', {
          method: 'GET',
          headers: {
            'x-session-token': sessionToken
          }
        });

        if (error) {
          console.error("Error fetching subscriptions:", error);
        } else if (data?.success && data.data) {
          setMySubscriptions(data.data);
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoadingSubscriptions(false);
      }
    };

    fetchMySubscriptions();
  }, []);

  const handleTabChange = (tab: "agendar" | "historico" | "planos") => {
    if (tab === "agendar") {
      navigate("/");
    } else if (tab === "historico") {
      navigate("/historico");
    }
    setActiveTab(tab);
  };

  const handleSubscribe = (plan: Service) => {
    setSelectedPlan(plan);
    if (!isLoggedIn) {
      setShowLoginModal(true);
    } else {
      setShowConfirmModal(true);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)})${digits.slice(2)}`;
    return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientPhone(formatPhone(e.target.value));
  };

  const handleLoginAndSubscribe = async () => {
    if (!clientName.trim() || !clientPhone.trim()) {
      toast({
        title: "Preencha nome e telefone",
        variant: "destructive",
      });
      return;
    }

    // Save to localStorage
    localStorage.setItem("clientName", clientName.trim());
    localStorage.setItem("clientPhone", clientPhone.trim());
    
    // Create session token (simple base64 for now)
    const sessionToken = btoa(clientPhone.trim());
    localStorage.setItem("sessionToken", sessionToken);

    setShowLoginModal(false);
    setShowConfirmModal(true);
  };

  const handleConfirmSubscription = async () => {
    if (!selectedPlan) return;

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          service_id: selectedPlan.id,
          client_name: clientName.trim(),
          client_phone: clientPhone.trim(),
        }
      });

      if (error || !data?.success) {
        toast({
          title: "Erro ao iniciar checkout",
          description: data?.error || "Tente novamente mais tarde",
          variant: "destructive",
        });
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Error:", err);
      toast({
        title: "Erro ao iniciar checkout",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubscribed = (serviceId: string) => {
    return mySubscriptions.some(s => s.service_id === serviceId && s.status === "active");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <Logo />

      <main className="container max-w-3xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-bold mb-2">Planos de Assinatura</h1>
          <p className="text-muted-foreground">Escolha o plano ideal para você</p>
        </div>

        {/* My Active Subscriptions */}
        {mySubscriptions.filter(s => s.status === "active").length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Meus Planos Ativos
            </h2>
            <div className="space-y-3">
              {mySubscriptions.filter(s => s.status === "active").map((sub) => (
                <Card key={sub.id} className="border-primary/50 bg-primary/5">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{sub.service.name}</CardTitle>
                      <Badge variant="default">Ativo</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <p className="text-sm text-muted-foreground">
                      Desde {new Date(sub.start_date).toLocaleDateString("pt-BR")}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Available Plans */}
        <div className="space-y-4">
          {servicesLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando planos...
            </div>
          ) : subscriptionPlans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum plano disponível no momento.
            </div>
          ) : (
            subscriptionPlans.map((plan, index) => (
              <Card
                key={plan.id}
                className="animate-fade-in overflow-hidden"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                      </div>
                      {plan.description && (
                        <CardDescription className="mt-2">{plan.description}</CardDescription>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-primary">
                        R$ {plan.price.toFixed(2).replace(".", ",")}
                      </span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                  </div>
                </CardHeader>
                
                {/* Benefits Section */}
                {plan.benefits && plan.benefits.length > 0 && (
                  <CardContent className="pt-0 pb-4">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 animate-fade-in" style={{ animationDelay: `${index * 0.05 + 0.1}s` }}>
                        <Gift className="h-4 w-4 text-primary" />
                        Benefícios inclusos
                      </h4>
                      <ul className="space-y-2">
                        {plan.benefits.map((benefit, idx) => (
                          <li
                            key={idx}
                            className="flex items-center gap-3 text-sm opacity-0 animate-slide-in-left"
                            style={{ animationDelay: `${index * 0.05 + 0.15 + idx * 0.08}s` }}
                          >
                            <div className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary" />
                            </div>
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                )}
                
                <CardFooter className="pt-2">
                  {isSubscribed(plan.id) ? (
                    <Button disabled className="w-full" variant="outline">
                      <Check className="h-4 w-4 mr-2" />
                      Você já possui este plano
                    </Button>
                  ) : (
                    <Button onClick={() => handleSubscribe(plan)} className="w-full">
                      <Crown className="h-4 w-4 mr-2" />
                      Assinar Plano
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </main>

      <BottomNav activeTab={activeTab as "agendar" | "historico"} onTabChange={handleTabChange as (tab: "agendar" | "historico") => void} />

      {/* Login Modal */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Identificação</DialogTitle>
            <DialogDescription>
              Insira seus dados para assinar o plano
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={clientPhone}
                onChange={handlePhoneChange}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoginModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleLoginAndSubscribe}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Subscription Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Assinatura</DialogTitle>
            <DialogDescription>
              Você está prestes a assinar o plano:
            </DialogDescription>
          </DialogHeader>
          {selectedPlan && (
            <div className="py-4">
              <Card className="border-primary">
                <CardHeader className="pb-2">
                  <CardTitle>{selectedPlan.name}</CardTitle>
                  {selectedPlan.description && (
                    <CardDescription>{selectedPlan.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">
                    R$ {selectedPlan.price.toFixed(2).replace(".", ",")}<span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmSubscription} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                "Confirmar Assinatura"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Planos;
