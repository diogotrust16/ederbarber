import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Power, PowerOff, X } from "lucide-react";
import { useAdminSession } from "@/hooks/useAdminSession";
import AdminSidebar from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  is_subscription: boolean;
}

interface ServiceFormData {
  name: string;
  description: string;
  price: string;
  duration_minutes: string;
  is_subscription: boolean;
}

const emptyForm: ServiceFormData = {
  name: "",
  description: "",
  price: "",
  duration_minutes: "",
  is_subscription: false,
};

const AdminServicos = () => {
  const navigate = useNavigate();
  const { isAuthenticated, invokeAdminFunction, logout } = useAdminSession();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/admin/login");
      return;
    }
    fetchServices();
  }, [navigate, isAuthenticated]);

  const fetchServices = async () => {
    try {
      const data = await invokeAdminFunction("admin-services", { action: "list" });

      if (data.success) {
        setServices(data.services);
      }
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar serviços",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const openCreateModal = () => {
    setSelectedService(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setSelectedService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      price: service.price.toString(),
      duration_minutes: service.duration_minutes.toString(),
      is_subscription: service.is_subscription,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({ title: "Erro", description: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    
    const price = parseFloat(formData.price);
    const duration = parseInt(formData.duration_minutes);
    
    if (isNaN(price) || price <= 0) {
      toast({ title: "Erro", description: "Preço inválido", variant: "destructive" });
      return;
    }
    
    if (isNaN(duration) || duration <= 0) {
      toast({ title: "Erro", description: "Duração inválida", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    try {
      const action = selectedService ? "update" : "create";
      const serviceData = {
        ...(selectedService && { id: selectedService.id }),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price,
        duration_minutes: duration,
        is_subscription: formData.is_subscription,
      };

      const data = await invokeAdminFunction("admin-services", { action, service: serviceData });
      
      if (data.success) {
        toast({
          title: "Sucesso",
          description: selectedService ? "Serviço atualizado!" : "Serviço criado!",
        });
        setIsModalOpen(false);
        fetchServices();
      }
    } catch (error) {
      console.error("Error saving service:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar serviço",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (service: Service) => {
    try {
      const data = await invokeAdminFunction("admin-services", { action: "toggle", service: { id: service.id } });
      
      if (data.success) {
        toast({
          title: "Sucesso",
          description: `Serviço ${data.service.is_active ? "ativado" : "desativado"}!`,
        });
        fetchServices();
      }
    } catch (error) {
      console.error("Error toggling service:", error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedService) return;

    try {
      const data = await invokeAdminFunction("admin-services", { action: "delete", service: { id: selectedService.id } });
      
      if (data.success) {
        toast({ title: "Sucesso", description: "Serviço excluído!" });
        setIsDeleteDialogOpen(false);
        setSelectedService(null);
        fetchServices();
      }
    } catch (error) {
      console.error("Error deleting service:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir serviço",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const number = parseInt(digits) / 100;
    return number.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-[#0a1628] flex">
      <AdminSidebar onLogout={handleLogout} />

      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Serviços</h1>
          <Button
            onClick={openCreateModal}
            className="bg-[#00d9a5] hover:bg-[#00d9a5]/90 text-[#0a1628]"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Serviço
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 bg-[#1a2d4a]" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <Card className="bg-[#1a2d4a] border-[#2a3d5a]">
            <CardContent className="py-12 text-center">
              <p className="text-[#00d9a5]/50">Nenhum serviço cadastrado.</p>
              <Button
                onClick={openCreateModal}
                variant="outline"
                className="mt-4 border-[#00d9a5] text-[#00d9a5] hover:bg-[#00d9a5]/10"
              >
                Criar primeiro serviço
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <Card
                key={service.id}
                className={`bg-[#1a2d4a] border-[#2a3d5a] ${
                  !service.is_active ? "opacity-60" : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-white text-lg">
                      {service.name}
                    </CardTitle>
                    <div className="flex gap-1">
                      {service.is_subscription && (
                        <Badge className="bg-purple-500">Assinatura</Badge>
                      )}
                      <Badge
                        className={
                          service.is_active ? "bg-green-500" : "bg-gray-500"
                        }
                      >
                        {service.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {service.description && (
                    <p className="text-[#00d9a5]/70 text-sm mb-3 line-clamp-2">
                      {service.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm mb-4">
                    <span className="text-white font-semibold">
                      R$ {service.price.toFixed(2).replace(".", ",")}
                    </span>
                    <span className="text-[#00d9a5]/70">
                      {service.duration_minutes} min
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-[#2a3d5a] text-[#00d9a5] hover:bg-[#2a3d5a]"
                      onClick={() => openEditModal(service)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`border-[#2a3d5a] hover:bg-[#2a3d5a] ${
                        service.is_active ? "text-yellow-500" : "text-green-500"
                      }`}
                      onClick={() => handleToggleActive(service)}
                    >
                      {service.is_active ? (
                        <PowerOff className="h-4 w-4" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#2a3d5a] text-red-500 hover:bg-red-500/10"
                      onClick={() => {
                        setSelectedService(service);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#1a2d4a] border-[#2a3d5a] text-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedService ? "Editar Serviço" : "Novo Serviço"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="bg-[#0a1628] border-[#2a3d5a]"
                placeholder="Nome do serviço"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="bg-[#0a1628] border-[#2a3d5a] resize-none"
                placeholder="Descrição do serviço"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  className="bg-[#0a1628] border-[#2a3d5a]"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Duração (min)</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.duration_minutes}
                  onChange={(e) =>
                    setFormData({ ...formData, duration_minutes: e.target.value })
                  }
                  className="bg-[#0a1628] border-[#2a3d5a]"
                  placeholder="30"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>É assinatura?</Label>
              <Switch
                checked={formData.is_subscription}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_subscription: checked })
                }
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-[#2a3d5a] text-white hover:bg-[#2a3d5a]"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#00d9a5] hover:bg-[#00d9a5]/90 text-[#0a1628]"
                disabled={isSaving}
              >
                {isSaving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#1a2d4a] border-[#2a3d5a]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Excluir serviço?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#00d9a5]/70">
              Tem certeza que deseja excluir "{selectedService?.name}"? Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#2a3d5a] text-white hover:bg-[#2a3d5a]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={handleDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminServicos;
