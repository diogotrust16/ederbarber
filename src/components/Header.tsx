import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, LogIn, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const Header = () => {
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const sessionToken = localStorage.getItem("sessionToken");
  const isLoggedIn = !!sessionToken;

  const handleLogout = () => {
    localStorage.removeItem("sessionToken");
    localStorage.removeItem("clientPhone");
    localStorage.removeItem("clientName");
    setShowLogoutModal(false);
    navigate("/");
  };

  return (
    <>
      <header className="bg-[#0a0f18] py-3 px-4 flex items-center justify-between">
        <h1 className="font-header text-[#00d9a5] text-[15px] tracking-[0.25em] uppercase font-semibold">
          Agenda Serviço
        </h1>
        
        {isLoggedIn ? (
          <button
            onClick={() => setShowLogoutModal(true)}
            className="text-[#00d9a5] hover:text-[#00d9a5]/80 transition-colors"
          >
            <LogOut className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={() => navigate("/admin/login")}
            className="text-[#00d9a5] hover:text-[#00d9a5]/80 transition-colors"
          >
            <LogIn className="h-5 w-5" />
          </button>
        )}
      </header>

      {/* Logout Confirmation Modal */}
      <Dialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
        <DialogContent className="max-w-sm rounded-lg p-6">
          <button
            onClick={() => setShowLogoutModal(false)}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="pt-2">
            <h2 className="text-lg font-semibold mb-4">Desconectar do sistema</h2>
            <p className="text-muted-foreground mb-6">
              Você confirma a desconexão do seu login?
            </p>

            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full"
            >
              Sim, confirmo a desconexão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Header;