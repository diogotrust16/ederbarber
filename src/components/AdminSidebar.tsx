import { useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CreditCard,
  BarChart3,
  PhoneCall,
  RefreshCw,
  Package,
  Scissors,
  Users,
  FileText,
  Wallet,
  Clock,
  Building2,
  UserCog,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  active?: boolean;
}

const menuItems: MenuItem[] = [
  { icon: CalendarDays, label: "Agenda", path: "/admin" },
  { icon: CreditCard, label: "AS Pay", path: "/admin/pay" },
  { icon: PhoneCall, label: "Relatório", path: "/admin/relatorios" },
  { icon: BarChart3, label: "Caixa", path: "/admin/caixa" },
  { icon: RefreshCw, label: "Assinatura", path: "/admin/assinatura" },
  { icon: Package, label: "Produtos", path: "/admin/produtos" },
  { icon: Scissors, label: "Serviço", path: "/admin/servico" },
  { icon: Users, label: "Clientes", path: "/admin/clientes" },
  { icon: FileText, label: "Templates", path: "/admin/templates" },
  { icon: Wallet, label: "Pagamentos", path: "/admin/pagamentos" },
  { icon: Clock, label: "Horários Bloqueados", path: "/admin/horarios" },
  { icon: Building2, label: "Funcionamento", path: "/admin/funcionamento" },
  { icon: UserCog, label: "Profissionais", path: "/admin/funcionario" },
  { icon: Settings, label: "Configurações", path: "/admin/configuracoes" },
];

interface AdminSidebarProps {
  onLogout: () => void;
}

const AdminSidebar = ({ onLogout }: AdminSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname.startsWith(path);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-1.5 left-2 z-50 lg:hidden text-[#00d9a5] bg-[#0a1628]"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#0a1628] border-r border-[#1a2d4a] transform transition-transform duration-300 ease-in-out",
          "lg:transform-none",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-[#1a2d4a]">
            <h1 className="text-[#00d9a5] font-semibold text-lg tracking-wide">
              Painel Admin
            </h1>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <li key={item.path}>
                    <button
                      onClick={() => handleNavigation(item.path)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                        active
                          ? "bg-[#00d9a5]/10 text-[#00d9a5]"
                          : "text-[#00d9a5]/70 hover:bg-[#1a2d4a] hover:text-[#00d9a5]"
                      )}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-[#1a2d4a]">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
