import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Historico from "./pages/Historico";
import Planos from "./pages/Planos";
import CheckoutSucesso from "./pages/CheckoutSucesso";
import Auth from "./pages/Auth";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminAgenda from "./pages/AdminAgenda";
import AdminServicos from "./pages/AdminServicos";
import AdminFuncionarios from "./pages/AdminFuncionarios";
import AdminClientes from "./pages/AdminClientes";
import AdminHorarios from "./pages/AdminHorarios";
import AdminFuncionamento from "./pages/AdminFuncionamento";
import AdminAssinaturas from "./pages/AdminAssinaturas";
import AdminRelatorios from "./pages/AdminRelatorios";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/planos" element={<Planos />} />
          <Route path="/checkout-sucesso" element={<CheckoutSucesso />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminAgenda />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/servico" element={<AdminServicos />} />
          <Route path="/admin/funcionario" element={<AdminFuncionarios />} />
          <Route path="/admin/clientes" element={<AdminClientes />} />
          <Route path="/admin/horarios" element={<AdminHorarios />} />
          <Route path="/admin/funcionamento" element={<AdminFuncionamento />} />
          <Route path="/admin/assinatura" element={<AdminAssinaturas />} />
          <Route path="/admin/relatorios" element={<AdminRelatorios />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
