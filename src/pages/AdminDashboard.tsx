import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Users, Scissors, Clock } from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSession } from "@/hooks/useAdminSession";

interface Appointment {
  id: string;
  client_name: string;
  client_phone: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  service: {
    name: string;
    price: number;
  };
  professional: {
    name: string;
  } | null;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, logout, getSession, invokeAdminFunction } = useAdminSession();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayCount: 0,
    weekCount: 0,
    totalRevenue: 0,
  });

  const adminSession = getSession();

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/admin/login");
    }
  }, [navigate, isAuthenticated]);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!adminSession) return;

      try {
        const res = await invokeAdminFunction("admin-appointments", {
          action: "dashboard",
        });

        const list = (res?.appointments || []) as any[];
        const formattedData: Appointment[] = list.map((item: any) => ({
          id: item.id,
          client_name: item.client_name,
          client_phone: item.client_phone,
          appointment_date: item.appointment_date,
          appointment_time: item.appointment_time,
          status: item.status,
          service: item.services || { name: "Serviço", price: 0 },
          professional: item.professionals || null,
        }));

        setAppointments(formattedData);

        setStats({
          todayCount: res?.stats?.todayCount || 0,
          weekCount: res?.stats?.next7DaysCount || 0,
          totalRevenue: res?.stats?.totalRevenue || 0,
        });
      } catch (error) {
        console.error("Error fetching dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    if (adminSession) {
      fetchDashboard();
    }
  }, [adminSession, invokeAdminFunction]);

  const handleLogout = () => {
    logout();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge className="bg-blue-500">Agendado</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Concluído</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!adminSession) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="animate-pulse text-[#00d9a5]">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628] flex">
      <AdminSidebar onLogout={handleLogout} />

      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            Olá, {adminSession.admin.name}!
          </h1>
          <p className="text-[#00d9a5]/70">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-[#1a2d4a] border-[#2a3d5a]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#00d9a5]/70">
                Agendamentos Hoje
              </CardTitle>
              <CalendarDays className="h-4 w-4 text-[#00d9a5]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.todayCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a2d4a] border-[#2a3d5a]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#00d9a5]/70">
                Próximos 7 dias
              </CardTitle>
              <Clock className="h-4 w-4 text-[#00d9a5]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats.weekCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a2d4a] border-[#2a3d5a]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[#00d9a5]/70">
                Receita Prevista
              </CardTitle>
              <Scissors className="h-4 w-4 text-[#00d9a5]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                R$ {stats.totalRevenue.toFixed(2).replace(".", ",")}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Appointments List */}
        <Card className="bg-[#1a2d4a] border-[#2a3d5a]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="h-5 w-5 text-[#00d9a5]" />
              Próximos Agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 bg-[#2a3d5a]" />
                ))}
              </div>
            ) : appointments.length === 0 ? (
              <p className="text-[#00d9a5]/50 text-center py-8">
                Nenhum agendamento próximo.
              </p>
            ) : (
              <div className="space-y-4">
                {appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-[#2a3d5a] bg-[#0a1628]"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                          {appointment.client_name}
                        </span>
                        {getStatusBadge(appointment.status)}
                      </div>
                      <p className="text-sm text-[#00d9a5]/70">
                        {appointment.service?.name} • R${" "}
                        {appointment.service?.price?.toFixed(2).replace(".", ",")}
                      </p>
                      <p className="text-sm text-[#00d9a5]/50">
                        Tel: {appointment.client_phone}
                      </p>
                    </div>
                    <div className="mt-2 sm:mt-0 text-right">
                      <p className="font-medium text-white">
                        {format(parseISO(appointment.appointment_date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                      <p className="text-sm text-[#00d9a5]/70">
                        {appointment.appointment_time.slice(0, 5)}
                      </p>
                      {appointment.professional && (
                        <p className="text-sm text-[#00d9a5]">
                          {appointment.professional.name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminDashboard;
