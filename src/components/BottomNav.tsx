import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, Crown } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface BottomNavProps {
  activeTab: "agendar" | "historico" | "planos";
  onTabChange: (tab: "agendar" | "historico" | "planos") => void;
}

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  const navigate = useNavigate();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleHistoricoClick = () => {
    const sessionToken = localStorage.getItem("sessionToken");
    
    if (sessionToken) {
      // User has a session token, navigate to historico
      onTabChange("historico");
    } else {
      // User is not logged in, show login modal
      setShowLoginModal(true);
    }
  };

  const handleLogin = async () => {
    if (!phoneInput.trim()) {
      toast({
        title: "Digite seu número de telefone",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Use edge function to check phone
      const { data, error } = await supabase.functions.invoke('check-phone', {
        body: { client_phone: phoneInput.trim() }
      });

      if (error) {
        console.error("Error checking phone:", error);
        toast({
          title: "Erro ao verificar telefone",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!data?.found) {
        toast({
          title: "Nenhum agendamento encontrado",
          description: "Não encontramos agendamentos para este número.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Save session token and user info to localStorage
      localStorage.setItem("sessionToken", data.session_token);
      localStorage.setItem("clientPhone", data.client_phone || phoneInput.trim());
      if (data.client_name) {
        localStorage.setItem("clientName", data.client_name);
      }
    } catch (err) {
      console.error("Error calling edge function:", err);
      toast({
        title: "Erro ao verificar telefone",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    setShowLoginModal(false);
    setPhoneInput("");
    onTabChange("historico");
  };

  return (
    <>
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-xl border border-gray-200 flex">
        <button
          onClick={() => onTabChange("agendar")}
          className={`flex flex-col items-center justify-center px-6 py-3 transition-all ${activeTab === "agendar" ? "border-b-2 border-black" : ""}`}
        >
          <Calendar className="w-5 h-5 mb-1 text-gray-500" />
          <span className="text-xs font-medium text-gray-600">Agendar</span>
        </button>
        <button
          onClick={() => navigate("/planos")}
          className={`flex flex-col items-center justify-center px-6 py-3 transition-all ${activeTab === "planos" ? "border-b-2 border-black" : ""}`}
        >
          <Crown className="w-5 h-5 mb-1 text-gray-500" />
          <span className="text-xs font-medium text-gray-600">Planos</span>
        </button>
        <button
          onClick={handleHistoricoClick}
          className={`flex flex-col items-center justify-center px-6 py-3 transition-all ${activeTab === "historico" ? "border-b-2 border-black" : ""}`}
        >
          <Clock className="w-5 h-5 mb-1 text-gray-500" />
          <span className="text-xs font-medium text-gray-600">Histórico</span>
        </button>
      </nav>

      {/* Phone Login Modal */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="max-w-sm rounded-lg p-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-4">Insira seu número de telefone:</h2>
            
            <Input
              placeholder="(DDD)00000-000"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="mb-6 text-center"
            />

            <Button
              onClick={handleLogin}
              disabled={isLoading}
              variant="outline"
              className="px-8"
            >
              {isLoading ? "Verificando..." : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BottomNav;