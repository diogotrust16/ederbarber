import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Phone, Calendar, DollarSign, ChevronLeft, ChevronRight, User } from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";
import { useAdminSession } from "@/hooks/useAdminSession";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Client {
  id: string;
  name: string;
  phone: string;
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  total_spent: number;
  last_appointment_date: string | null;
  first_appointment_date: string;
}

interface ClientAppointment {
  id: string;
  client_name: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  services: { name: string; price: number } | null;
  professionals: { name: string } | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const AdminClientes = () => {
  const navigate = useNavigate();
  const { isAuthenticated, logout, invokeAdminFunction } = useAdminSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientAppointments, setClientAppointments] = useState<ClientAppointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Check admin session
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/admin/login");
    }
  }, [navigate, isAuthenticated]);

  // Fetch clients
  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      try {
        const res = await invokeAdminFunction("admin-clients", {
          action: "list",
          search: search || undefined,
          page: pagination.page,
          limit: pagination.limit,
        });

        if (res?.success) {
          setClients(res.clients || []);
          setPagination(res.pagination);
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchClients, 300);
    return () => clearTimeout(debounce);
  }, [search, pagination.page, invokeAdminFunction]);

  const handleClientClick = async (client: Client) => {
    setSelectedClient(client);
    setIsModalOpen(true);
    setLoadingAppointments(true);

    try {
      const res = await invokeAdminFunction("admin-clients", {
        action: "get",
        phone: client.phone,
      });

      if (res?.success) {
        setClientAppointments(res.appointments || []);
      }
    } catch (error) {
      console.error("Error fetching client appointments:", error);
    } finally {
      setLoadingAppointments(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Finalizado</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Cancelado</Badge>;
      case "scheduled":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Agendado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1628] flex">
      <AdminSidebar onLogout={handleLogout} />

      <main className="flex-1 p-4 lg:p-6 lg:ml-0 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Clientes</h1>
              <p className="text-[#00d9a5]/70 text-sm mt-1">
                Gerencie todos os clientes da barbearia
              </p>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00d9a5]/50" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="pl-10 bg-[#1a2d4a] border-[#2a3d5a] text-white placeholder:text-[#00d9a5]/40"
              />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-[#1a2d4a] border-[#2a3d5a]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[#00d9a5]/70">
                  Total de Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-white">
                  {loading ? <Skeleton className="h-8 w-16" /> : pagination.total}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Clients Table */}
          <Card className="bg-[#1a2d4a] border-[#2a3d5a]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#2a3d5a] hover:bg-transparent">
                      <TableHead className="text-[#00d9a5]">Cliente (Telefone)</TableHead>
                      <TableHead className="text-[#00d9a5] text-center">Agendamentos</TableHead>
                      <TableHead className="text-[#00d9a5] text-center">Finalizados</TableHead>
                      <TableHead className="text-[#00d9a5] text-right">Total Gasto</TableHead>
                      <TableHead className="text-[#00d9a5]">Último Agend.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-[#2a3d5a]">
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        </TableRow>
                      ))
                    ) : clients.length === 0 ? (
                      <TableRow className="border-[#2a3d5a]">
                        <TableCell colSpan={6} className="text-center py-8 text-[#00d9a5]/50">
                          Nenhum cliente encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      clients.map((client) => (
                        <TableRow
                          key={client.id}
                          onClick={() => handleClientClick(client)}
                          className="border-[#2a3d5a] hover:bg-[#2a3d5a]/50 cursor-pointer"
                        >
                          <TableCell className="font-medium text-white">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-[#00d9a5]/20 flex items-center justify-center">
                                <Phone className="h-4 w-4 text-[#00d9a5]" />
                              </div>
                              <div>
                                <p>{formatPhone(client.phone)}</p>
                                <p className="text-xs text-gray-400">{client.name}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-gray-300">
                            {client.total_appointments}
                          </TableCell>
                          <TableCell className="text-center text-blue-400">
                            {client.completed_appointments}
                          </TableCell>
                          <TableCell className="text-right text-[#00d9a5] font-medium">
                            {formatCurrency(client.total_spent)}
                          </TableCell>
                          <TableCell className="text-gray-300">
                            {formatDate(client.last_appointment_date)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#2a3d5a]">
                  <p className="text-sm text-[#00d9a5]/70">
                    Mostrando {(pagination.page - 1) * pagination.limit + 1} a{" "}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} de{" "}
                    {pagination.total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="border-[#2a3d5a] text-white hover:bg-[#2a3d5a]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="border-[#2a3d5a] text-white hover:bg-[#2a3d5a]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Client Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#1a2d4a] border-[#2a3d5a] text-white max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-xl text-white flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#00d9a5]/20 flex items-center justify-center">
                <Phone className="h-5 w-5 text-[#00d9a5]" />
              </div>
              <div>
                <p>{selectedClient ? formatPhone(selectedClient.phone) : ""}</p>
                <p className="text-sm font-normal text-gray-400">{selectedClient?.name}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedClient && (
            <div className="space-y-6">
              {/* Client Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-gray-300">
                  <Phone className="h-4 w-4 text-[#00d9a5]" />
                  {formatPhone(selectedClient.phone)}
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Calendar className="h-4 w-4 text-[#00d9a5]" />
                  Cliente desde {formatDate(selectedClient.first_appointment_date)}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#0a1628] rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-white">{selectedClient.total_appointments}</p>
                  <p className="text-xs text-[#00d9a5]/70">Agendamentos</p>
                </div>
                <div className="bg-[#0a1628] rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-400">{selectedClient.completed_appointments}</p>
                  <p className="text-xs text-[#00d9a5]/70">Finalizados</p>
                </div>
                <div className="bg-[#0a1628] rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-[#00d9a5]">{formatCurrency(selectedClient.total_spent)}</p>
                  <p className="text-xs text-[#00d9a5]/70">Total Gasto</p>
                </div>
              </div>

              {/* Appointments History */}
              <div>
                <h3 className="text-sm font-medium text-[#00d9a5] mb-3">Histórico de Agendamentos</h3>
                <ScrollArea className="h-[200px]">
                  {loadingAppointments ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : clientAppointments.length === 0 ? (
                    <p className="text-center text-[#00d9a5]/50 py-4">
                      Nenhum agendamento encontrado
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {clientAppointments.map((apt) => (
                        <div
                          key={apt.id}
                          className="bg-[#0a1628] rounded-lg p-3 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-white text-sm font-medium">
                              {apt.services?.name || "Serviço"}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatDate(apt.appointment_date)} às {apt.appointment_time.slice(0, 5)}
                              {apt.professionals?.name && ` • ${apt.professionals.name}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[#00d9a5] text-sm font-medium">
                              {formatCurrency(apt.services?.price || 0)}
                            </span>
                            {getStatusBadge(apt.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminClientes;
