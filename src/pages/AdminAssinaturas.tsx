import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminSession } from "@/hooks/useAdminSession";
import AdminSidebar from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CreditCard, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface Subscription {
  id: string;
  service_id: string;
  client_name: string;
  client_phone: string;
  status: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  service: Service;
}

interface StripeStatus {
  status: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  error?: boolean;
}

// Extract Stripe subscription ID from notes field
const extractStripeSubId = (notes: string | null): string | null => {
  if (!notes) return null;
  const match = notes.match(/Stripe subscription:\s*(sub_\w+)/i);
  return match ? match[1] : null;
};

const getStripeStatusBadge = (stripeStatus: StripeStatus | undefined, isLoading: boolean) => {
  if (isLoading) {
    return <Loader2 className="h-3 w-3 animate-spin text-gray-400" />;
  }
  if (!stripeStatus) {
    return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px]">Manual</Badge>;
  }
  if (stripeStatus.error) {
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Erro</Badge>;
  }
  switch (stripeStatus.status) {
    case "active":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
          Pago ✓
        </Badge>
      );
    case "past_due":
      return (
        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]">
          Atrasado
        </Badge>
      );
    case "canceled":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
          Cancelado
        </Badge>
      );
    case "unpaid":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
          Não pago
        </Badge>
      );
    case "trialing":
      return (
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
          Trial
        </Badge>
      );
    case "incomplete":
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">
          Incompleto
        </Badge>
      );
    case "not_found":
      return (
        <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px]">
          Não encontrado
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px]">
          {stripeStatus.status}
        </Badge>
      );
  }
};

const AdminAssinaturas = () => {
  const navigate = useNavigate();
  const { getSession, logout, isAuthenticated } = useAdminSession();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [deletingSubscription, setDeletingSubscription] = useState<Subscription | null>(null);
  const [formData, setFormData] = useState({
    service_id: "",
    client_name: "",
    client_phone: "",
    start_date: "",
    end_date: "",
    status: "active",
    notes: "",
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isSaving, setIsSaving] = useState(false);
  const [stripeStatuses, setStripeStatuses] = useState<Record<string, StripeStatus>>({});
  const [isLoadingStripe, setIsLoadingStripe] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/admin/login");
    }
  }, [isAuthenticated, navigate]);

  const getToken = () => {
    const session = getSession();
    return session?.token || "";
  };

  const fetchSubscriptions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-subscriptions?${params}`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const result = await response.json();
      if (result.success) {
        setSubscriptions(result.data || []);
        return result.data || [];
      } else {
        toast({
          title: "Erro",
          description: result.error || "Erro ao carregar assinaturas",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar assinaturas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
    return [];
  }, [statusFilter]);

  const fetchServices = useCallback(async () => {
    try {
      const session = getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-services`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "list" }),
        }
      );
      const result = await response.json();
      if (result.success) {
        const subscriptionServices = (result.services || []).filter(
          (s: Service & { is_subscription: boolean }) => s.is_subscription
        );
        setServices(subscriptionServices);
      }
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  }, []);

  const fetchStripeStatuses = useCallback(async (subs: Subscription[]) => {
    const stripeIds: string[] = [];
    subs.forEach((sub) => {
      const stripeId = extractStripeSubId(sub.notes);
      if (stripeId) stripeIds.push(stripeId);
    });

    if (stripeIds.length === 0) return;

    setIsLoadingStripe(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-stripe-status`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ stripe_subscription_ids: stripeIds }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setStripeStatuses(result.data || {});
      }
    } catch (error) {
      console.error("Error fetching Stripe statuses:", error);
    } finally {
      setIsLoadingStripe(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated()) {
      (async () => {
        const subs = await fetchSubscriptions();
        fetchServices();
        if (subs.length > 0) {
          fetchStripeStatuses(subs);
        }
      })();
    }
  }, [isAuthenticated, statusFilter]);

  const handleRefreshStripe = async () => {
    if (subscriptions.length > 0) {
      await fetchStripeStatuses(subscriptions);
      toast({ title: "Atualizado", description: "Status do Stripe atualizado" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.service_id || !formData.client_name || !formData.client_phone) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const method = editingSubscription ? "PUT" : "POST";
      const body = editingSubscription
        ? { id: editingSubscription.id, ...formData }
        : formData;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-subscriptions`,
        {
          method,
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const result = await response.json();
      if (result.success) {
        toast({
          title: "Sucesso",
          description: editingSubscription
            ? "Assinatura atualizada!"
            : "Assinatura criada!",
        });
        setIsDialogOpen(false);
        resetForm();
        const subs = await fetchSubscriptions();
        if (subs.length > 0) fetchStripeStatuses(subs);
      } else {
        toast({
          title: "Erro",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving subscription:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar assinatura",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSubscription) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-subscriptions?id=${deletingSubscription.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      const result = await response.json();
      if (result.success) {
        toast({
          title: "Sucesso",
          description: "Assinatura excluída!",
        });
        setIsDeleteDialogOpen(false);
        setDeletingSubscription(null);
        fetchSubscriptions();
      } else {
        toast({
          title: "Erro",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting subscription:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir assinatura",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      service_id: "",
      client_name: "",
      client_phone: "",
      start_date: "",
      end_date: "",
      status: "active",
      notes: "",
    });
    setEditingSubscription(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditModal = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setFormData({
      service_id: subscription.service_id,
      client_name: subscription.client_name,
      client_phone: subscription.client_phone,
      start_date: subscription.start_date,
      end_date: subscription.end_date || "",
      status: subscription.status,
      notes: subscription.notes || "",
    });
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Ativa</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Cancelada</Badge>;
      case "expired":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Expirada</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const formatStripeDate = (timestamp: number | undefined) => {
    if (!timestamp) return "-";
    return format(new Date(timestamp * 1000), "dd/MM/yyyy", { locale: ptBR });
  };

  const handleLogout = () => {
    logout();
  };

  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full bg-[#1a2d4a]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628] flex">
      <AdminSidebar onLogout={handleLogout} />
      
      <main className="flex-1 p-4 lg:p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#00d9a5]/20 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-[#00d9a5]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Assinaturas</h1>
                <p className="text-[#00d9a5]/70 text-sm">Gerencie os planos de assinatura</p>
              </div>
            </div>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleRefreshStripe}
                      disabled={isLoadingStripe}
                      className="border-[#2a3d5a] text-[#00d9a5] hover:bg-[#2a3d5a]"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoadingStripe ? "animate-spin" : ""}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Atualizar status do Stripe</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                onClick={openCreateModal}
                className="bg-[#00d9a5] hover:bg-[#00d9a5]/90 text-[#0a1628]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Assinatura
              </Button>
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-[#1a2d4a] border-[#2a3d5a] text-white">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2d4a] border-[#2a3d5a]">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
                <SelectItem value="expired">Expiradas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card className="bg-[#1a2d4a] border-[#2a3d5a]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#2a3d5a] hover:bg-transparent">
                      <TableHead className="text-[#00d9a5]">Cliente</TableHead>
                      <TableHead className="text-[#00d9a5]">Telefone</TableHead>
                      <TableHead className="text-[#00d9a5]">Plano</TableHead>
                      <TableHead className="text-[#00d9a5]">Status</TableHead>
                      <TableHead className="text-[#00d9a5]">Pagamento</TableHead>
                      <TableHead className="text-[#00d9a5]">Início</TableHead>
                      <TableHead className="text-[#00d9a5]">Próx. Cobrança</TableHead>
                      <TableHead className="text-[#00d9a5] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-[#2a3d5a]">
                          {Array.from({ length: 8 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-20 bg-[#2a3d5a]" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : subscriptions.length === 0 ? (
                      <TableRow className="border-[#2a3d5a]">
                        <TableCell colSpan={8} className="text-center py-12">
                          <p className="text-[#00d9a5]/50">
                            {services.length === 0
                              ? 'Nenhum plano de assinatura cadastrado. Crie um serviço com "É assinatura" marcado primeiro.'
                              : "Nenhuma assinatura encontrada"}
                          </p>
                          {services.length > 0 && (
                            <Button
                              onClick={openCreateModal}
                              variant="outline"
                              className="mt-4 border-[#00d9a5] text-[#00d9a5] hover:bg-[#00d9a5]/10"
                            >
                              Criar primeira assinatura
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      subscriptions.map((subscription) => {
                        const stripeSubId = extractStripeSubId(subscription.notes);
                        const stripeStatus = stripeSubId ? stripeStatuses[stripeSubId] : undefined;
                        const isStripe = !!stripeSubId;

                        return (
                          <TableRow key={subscription.id} className="border-[#2a3d5a] hover:bg-[#2a3d5a]/50">
                            <TableCell className="font-medium text-white">
                              {subscription.client_name}
                            </TableCell>
                            <TableCell className="text-gray-300">
                              {formatPhone(subscription.client_phone)}
                            </TableCell>
                            <TableCell className="text-[#00d9a5]">
                              {subscription.service?.name || "Plano"}
                            </TableCell>
                            <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {getStripeStatusBadge(isStripe ? stripeStatus : undefined, isStripe && isLoadingStripe && !stripeStatus)}
                                {isStripe && stripeSubId && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <a
                                          href={`https://dashboard.stripe.com/subscriptions/${stripeSubId}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-gray-500 hover:text-[#00d9a5] transition-colors"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                      </TooltipTrigger>
                                      <TooltipContent>Ver no Stripe</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-300">
                              {formatDate(subscription.start_date)}
                            </TableCell>
                            <TableCell className="text-gray-300">
                              {isStripe && stripeStatus && !stripeStatus.error
                                ? formatStripeDate(stripeStatus.current_period_end)
                                : formatDate(subscription.end_date)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-[#2a3d5a] text-[#00d9a5] hover:bg-[#2a3d5a]"
                                  onClick={() => openEditModal(subscription)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-[#2a3d5a] text-red-500 hover:bg-red-500/10"
                                  onClick={() => {
                                    setDeletingSubscription(subscription);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Create/Edit Modal */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="bg-[#1a2d4a] border-[#2a3d5a] text-white max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSubscription ? "Editar Assinatura" : "Nova Assinatura"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Plano *</Label>
              <Select
                value={formData.service_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, service_id: value })
                }
              >
                <SelectTrigger className="bg-[#0a1628] border-[#2a3d5a]">
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2d4a] border-[#2a3d5a]">
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} - R$ {service.price.toFixed(2).replace(".", ",")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nome do Cliente *</Label>
              <Input
                value={formData.client_name}
                onChange={(e) =>
                  setFormData({ ...formData, client_name: e.target.value })
                }
                className="bg-[#0a1628] border-[#2a3d5a]"
                placeholder="Nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input
                value={formData.client_phone}
                onChange={(e) =>
                  setFormData({ ...formData, client_phone: e.target.value })
                }
                className="bg-[#0a1628] border-[#2a3d5a]"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  className="bg-[#0a1628] border-[#2a3d5a]"
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  className="bg-[#0a1628] border-[#2a3d5a]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger className="bg-[#0a1628] border-[#2a3d5a]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2d4a] border-[#2a3d5a]">
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                  <SelectItem value="expired">Expirada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="bg-[#0a1628] border-[#2a3d5a] resize-none"
                placeholder="Observações adicionais..."
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-[#2a3d5a] text-white hover:bg-[#2a3d5a]"
                onClick={() => setIsDialogOpen(false)}
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
              Excluir assinatura?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#00d9a5]/70">
              Tem certeza que deseja excluir a assinatura de "{deletingSubscription?.client_name}"? Esta ação não pode ser desfeita.
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

export default AdminAssinaturas;
