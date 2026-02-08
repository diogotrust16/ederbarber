
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, subDays, startOfMonth, endOfMonth, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart3,
  CalendarDays,
  DollarSign,
  TrendingUp,
  Users,
  Scissors,
  Crown,
  Filter,
  FileText,
  Settings2,
  Camera,
  Check,
  Menu,
  Bell,
  MessageCircle,
} from "lucide-react";
import AdminSidebar from "@/components/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAdminSession } from "@/hooks/useAdminSession";
import { useProfessionals } from "@/hooks/useProfessionals";
import { cn } from "@/lib/utils";

type Period = "today" | "week" | "month";
type SaldoTab = "servicos" | "produtos" | "assinaturas";

interface ProfessionalStats {
  id: string;
  name: string;
  avatar_url: string | null;
  count: number;
  revenue: number;
}

interface ReportStats {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  totalRevenue: number;
  averageTicket: number;
  topServices: { name: string; count: number; revenue: number }[];
  professionalStats: ProfessionalStats[];
}

const AdminRelatorios = () => {
  const navigate = useNavigate();
  const { isAuthenticated, logout, getSession, invokeAdminFunction } = useAdminSession();
  const { data: professionals = [] } = useProfessionals();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");
  const [saldoTab, setSaldoTab] = useState<SaldoTab>("servicos");
  const [appointmentsData, setAppointmentsData] = useState<any[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [stats, setStats] = useState<ReportStats>({
    totalAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    totalRevenue: 0,
    averageTicket: 0,
    topServices: [],
    professionalStats: [],
  });

  const adminSession = getSession();
  const isLoggedIn = !!adminSession;

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/admin/login");
    }
  }, [navigate, isAuthenticated]);

  // Update dates when period changes
  useEffect(() => {
    const now = new Date();
    switch (period) {
      case "today":
        setStartDate(format(now, "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        break;
      case "week":
        setStartDate(format(subDays(now, 7), "yyyy-MM-dd"));
        setEndDate(format(now, "yyyy-MM-dd"));
        break;
      case "month":
        setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
        break;
    }
  }, [period]);
  const computeStats = (appointments: any[], professionalFilter?: string | null): ReportStats => {
    const filteredAppointments = professionalFilter
      ? appointments.filter((a) => a.professional_id === professionalFilter)
      : appointments;

    const validAppointments = filteredAppointments.filter((a) => a.status !== "cancelled");
    const completed = filteredAppointments.filter((a) => a.status === "completed");
    const cancelled = filteredAppointments.filter((a) => a.status === "cancelled");
    const revenueSource = validAppointments;
    const revenue = revenueSource.reduce(
      (sum, a) => sum + (a.services?.price || a.service?.price || 0),
      0
    );

    // Top services (include scheduled and completed, ignore cancelled)
    const serviceMap = new Map<string, { count: number; revenue: number }>();
    revenueSource.forEach((a) => {
      const name = a.services?.name || a.service?.name || "Outro";
      const price = a.services?.price || a.service?.price || 0;
      const existing = serviceMap.get(name) || { count: 0, revenue: 0 };
      serviceMap.set(name, { count: existing.count + 1, revenue: existing.revenue + price });
    });

    // Professional stats (include scheduled and completed, ignore cancelled)
    const profMap = new Map<string, { count: number; revenue: number }>();
    revenueSource.forEach((a) => {
      const profId = a.professional_id || "unknown";
      const price = a.services?.price || a.service?.price || 0;
      const existing = profMap.get(profId) || { count: 0, revenue: 0 };
      profMap.set(profId, { count: existing.count + 1, revenue: existing.revenue + price });
    });

    const profStats: ProfessionalStats[] = professionals.map((p) => {
      const data = profMap.get(p.id) || { count: 0, revenue: 0 };
      return { id: p.id, name: p.name, avatar_url: p.avatar_url, ...data };
    });

    return {
      totalAppointments: validAppointments.length,
      completedAppointments: completed.length,
      cancelledAppointments: cancelled.length,
      totalRevenue: revenue,
      averageTicket: revenueSource.length > 0 ? revenue / revenueSource.length : 0,
      topServices: Array.from(serviceMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      professionalStats: profStats.sort((a, b) => b.revenue - a.revenue),
    };
  };

  const fetchReport = async () => {
    if (!isLoggedIn) return;
    setLoading(true);

    try {
      const res = await invokeAdminFunction("admin-appointments", {
        action: "list-range",
        start_date: startDate,
        end_date: endDate,
      });
      const appointments = (res?.appointments || []) as any[];
      setAppointmentsData(appointments);
    } catch (error) {
      console.error("Error fetching report:", error);
      try {
        // Fallback: fetch today only
        const res = await invokeAdminFunction("admin-appointments", {
          action: "list",
          date: format(new Date(), "yyyy-MM-dd"),
        });
        const appointments = (res?.appointments || []) as any[];
        setAppointmentsData(appointments);
      } catch (err) {
        console.error("Fallback also failed:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // invokeAdminFunction is stable from useAdminSession; omit to avoid effect loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, startDate, endDate]);

  useEffect(() => {
    setStats(computeStats(appointmentsData, selectedProfessionalId));
  }, [appointmentsData, selectedProfessionalId, professionals]);

  const handleLogout = () => logout();

  const formatCurrency = (value: number) =>
    `R$ ${value.toFixed(2).replace(".", ",")}`;

  const formatDateLabel = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return format(date, "dd 'de' MMM. 'de' yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const periodLabels: Record<Period, string> = {
    today: "Hoje",
    week: "Semana",
    month: "Mês",
  };

  const handleProfessionalClick = (profId: string) => {
    setSelectedProfessionalId((current) => (current === profId ? null : profId));
  };

  const selectedProfessional =
    professionals.find((p) => p.id === selectedProfessionalId) || null;

  const tableProfessionals = useMemo(
    () =>
      stats.professionalStats.length > 0
        ? stats.professionalStats
        : professionals.map((p) => ({
            id: p.id,
            name: p.name,
            avatar_url: p.avatar_url,
            count: 0,
            revenue: 0,
          })),
    [stats.professionalStats, professionals]
  );

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

      <main className="flex-1 flex flex-col overflow-y-auto pt-16 lg:pt-0">
        {/* Fixed status bar */}
        <div className="sticky top-0 z-40 bg-[#0a1628] px-2 sm:px-3 lg:px-4 pl-12 sm:pl-14 py-1.5 border-b border-[#1a2d4a]">
          <div className="flex items-center justify-between gap-2 sm:gap-3 w-full max-w-[420px] sm:max-w-5xl mx-auto">
            <div className="w-5" />
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00d9a5] text-[#00d9a5] bg-[#0f1d33] shadow-[0_0_8px_rgba(0,217,165,0.28)] text-xs sm:text-sm font-semibold tracking-wide">
              <MessageCircle className="h-4 w-4" />
              <span>WHATSAPP CONECTADO</span>
            </div>
          </div>
          <Bell className="h-5 w-5 text-[#00d9a5] opacity-80" />
          </div>
        </div>

        {/* Top Section - matching reference design */}
        <div className="bg-[#0a1628] px-4 lg:pl-4 pl-16 pt-4 pb-2 space-y-4">

          {/* Period Tabs */}
          <div className="flex gap-2">
            {(["today", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                  period === p
                    ? "bg-[#00d9a5]/20 text-[#00d9a5] border border-[#00d9a5]/40"
                    : "text-[#00d9a5]/60 border border-[#2a3d5a] hover:bg-[#1a2d4a] hover:text-[#00d9a5]"
                )}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {/* Date Range with Calendar Popovers */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Start Date */}
            <div className="flex items-center gap-2">
              <span className="text-[#00d9a5]/70 text-sm">De:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="bg-[#1a2d4a] border border-[#2a3d5a] rounded-md px-3 py-1.5 text-[#00d9a5] text-sm flex items-center gap-2 hover:bg-[#2a3d5a] transition-colors">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {format(parse(startDate, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border-0 rounded-2xl shadow-2xl z-50" align="start" side="bottom" sideOffset={4}>
                  <div className="p-1">
                    <Calendar
                      mode="single"
                      selected={parse(startDate, "yyyy-MM-dd", new Date())}
                      onSelect={(date) => {
                        if (date) setStartDate(format(date, "yyyy-MM-dd"));
                      }}
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                      classNames={{
                        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                        month: "space-y-4",
                        caption: "flex justify-between items-center px-1",
                        caption_label: "text-sm font-semibold text-gray-800",
                        nav: "flex items-center gap-1",
                        nav_button: "h-7 w-7 bg-transparent p-0 text-blue-500 hover:bg-blue-50 rounded-full flex items-center justify-center",
                        table: "w-full border-collapse",
                        head_row: "flex",
                        head_cell: "text-gray-400 rounded-md w-9 font-medium text-[0.7rem] uppercase",
                        row: "flex w-full mt-1",
                        cell: "h-9 w-9 text-center text-sm relative",
                        day: "h-9 w-9 p-0 font-normal text-gray-700 hover:bg-blue-50 rounded-full flex items-center justify-center transition-colors",
                        day_selected: "bg-blue-500 text-white hover:bg-blue-600 rounded-full font-semibold",
                        day_today: "border border-blue-300 rounded-full",
                        day_outside: "text-gray-300",
                        day_disabled: "text-gray-300",
                      }}
                    />
                    <div className="flex items-center justify-between px-3 pb-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs rounded-full border-gray-300 text-gray-600 hover:bg-gray-100"
                        onClick={() => {
                          setStartDate(format(startOfMonth(new Date()), "yyyy-MM-dd"));
                        }}
                      >
                        Redefinir
                      </Button>
                      <PopoverTrigger asChild>
                        <button className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center hover:bg-blue-600 transition-colors">
                          <Check className="h-5 w-5 text-white" />
                        </button>
                      </PopoverTrigger>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="flex items-center gap-2">
              <span className="text-[#00d9a5]/70 text-sm">Até:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="bg-[#1a2d4a] border border-[#2a3d5a] rounded-md px-3 py-1.5 text-[#00d9a5] text-sm flex items-center gap-2 hover:bg-[#2a3d5a] transition-colors">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {format(parse(endDate, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border-0 rounded-2xl shadow-2xl z-50" align="start" side="bottom" sideOffset={4}>
                  <div className="p-1">
                    <Calendar
                      mode="single"
                      selected={parse(endDate, "yyyy-MM-dd", new Date())}
                      onSelect={(date) => {
                        if (date) setEndDate(format(date, "yyyy-MM-dd"));
                      }}
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                      classNames={{
                        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                        month: "space-y-4",
                        caption: "flex justify-between items-center px-1",
                        caption_label: "text-sm font-semibold text-gray-800",
                        nav: "flex items-center gap-1",
                        nav_button: "h-7 w-7 bg-transparent p-0 text-blue-500 hover:bg-blue-50 rounded-full flex items-center justify-center",
                        table: "w-full border-collapse",
                        head_row: "flex",
                        head_cell: "text-gray-400 rounded-md w-9 font-medium text-[0.7rem] uppercase",
                        row: "flex w-full mt-1",
                        cell: "h-9 w-9 text-center text-sm relative",
                        day: "h-9 w-9 p-0 font-normal text-gray-700 hover:bg-blue-50 rounded-full flex items-center justify-center transition-colors",
                        day_selected: "bg-blue-500 text-white hover:bg-blue-600 rounded-full font-semibold",
                        day_today: "border border-blue-300 rounded-full",
                        day_outside: "text-gray-300",
                        day_disabled: "text-gray-300",
                      }}
                    />
                    <div className="flex items-center justify-between px-3 pb-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs rounded-full border-gray-300 text-gray-600 hover:bg-gray-100"
                        onClick={() => {
                          setEndDate(format(new Date(), "yyyy-MM-dd"));
                        }}
                      >
                        Redefinir
                      </Button>
                      <PopoverTrigger asChild>
                        <button className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center hover:bg-blue-600 transition-colors">
                          <Check className="h-5 w-5 text-white" />
                        </button>
                      </PopoverTrigger>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={fetchReport}
              className="bg-[#1a2d4a] border border-[#2a3d5a] text-white hover:bg-[#2a3d5a] gap-2"
            >
              <FileText className="h-4 w-4" />
              Gerar Relatório
            </Button>
            <Button
              className="bg-[#00d9a5] text-[#0a1628] hover:bg-[#00d9a5]/80 gap-2 font-semibold"
            >
              <Settings2 className="h-4 w-4" />
              Comissões
            </Button>
          </div>

          {/* Saldos Section */}
          <div className="flex items-center gap-3 pt-2">
            <Camera className="h-6 w-6 text-[#00d9a5]" />
            <span className="text-white font-semibold">Saldos:</span>
            <div className="flex gap-1">
              {([
                { key: "servicos", label: "Serviços" },
                { key: "produtos", label: "Produtos" },
                { key: "assinaturas", label: "Assinaturas" },
              ] as { key: SaldoTab; label: string }[]).map((tab, i) => (
                <span key={tab.key} className="flex items-center">
                  {i > 0 && <span className="text-[#00d9a5]/40 mx-1">|</span>}
                  <button
                    onClick={() => setSaldoTab(tab.key)}
                    className={cn(
                      "text-sm transition-colors",
                      saldoTab === tab.key
                        ? "text-[#00d9a5] font-semibold"
                        : "text-[#00d9a5]/60 hover:text-[#00d9a5]"
                    )}
                  >
                    {tab.label}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* Professional Cards Row */}
        <div className="px-4 py-3 overflow-x-auto">
          {loading ? (
            <div className="flex gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-40 flex-shrink-0 bg-[#1a2d4a] rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="flex gap-3">
              {/* "Casa" / Total Card */}
              <button
                onClick={() => setSelectedProfessionalId(null)}
                className={cn(
                  "flex-shrink-0 bg-gradient-to-br from-[#00d9a5]/30 to-[#00d9a5]/10 border rounded-xl p-4 min-w-[140px] flex flex-col items-center gap-2 transition-colors",
                  selectedProfessionalId === null
                    ? "border-[#00d9a5] shadow-[0_0_0_2px_rgba(0,217,165,0.35)]"
                    : "border-[#00d9a5]/30 hover:border-[#00d9a5]/60"
                )}
              >
                <div className="w-12 h-12 rounded-full bg-[#0a1628] border-2 border-[#00d9a5] flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-[#00d9a5]" />
                </div>
                <span className="text-white font-bold text-sm">Total</span>
                <span className="text-[#00d9a5] font-bold text-lg">
                  {formatCurrency(stats.totalRevenue)}
                </span>
              </button>

              {/* Professional Cards */}
              {(stats.professionalStats.length > 0
                ? stats.professionalStats
                : professionals.map((p) => ({
                    id: p.id,
                    name: p.name,
                    avatar_url: p.avatar_url,
                    count: 0,
                    revenue: 0,
                  }))
              ).map((prof) => {
                const isSelected = selectedProfessionalId === prof.id;
                return (
                  <button
                    key={prof.id}
                    onClick={() => handleProfessionalClick(prof.id)}
                    className={cn(
                      "flex-shrink-0 bg-[#1a2d4a] border rounded-xl p-4 min-w-[140px] flex flex-col items-center gap-2 transition-colors",
                      isSelected
                        ? "border-[#00d9a5] shadow-[0_0_0_2px_rgba(0,217,165,0.35)]"
                        : "border-[#2a3d5a] hover:border-[#00d9a5]/60"
                    )}
                  >
                    <Avatar className="h-12 w-12 border-2 border-[#00d9a5]">
                      <AvatarImage src={prof.avatar_url || undefined} alt={prof.name} />
                      <AvatarFallback className="bg-[#0a1628] text-[#00d9a5] text-sm font-bold">
                        {prof.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-white font-bold text-sm truncate max-w-[120px]">
                      {prof.name}
                    </span>
                    <span className="text-[#00d9a5] font-bold text-lg">
                      {formatCurrency(prof.revenue)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {/* Faturamento Bruto Section */}
        <div className="px-4 py-3">
          <div className="bg-[#1e2a3a] rounded-2xl p-4 space-y-3">
            <h3 className="text-white font-semibold text-center text-base">
              Faturamento bruto{selectedProfessional ? `  ${selectedProfessional.name}` : ""}
            </h3>

            {/* Total Card */}
            <div className="bg-gradient-to-r from-[#2ecc71] to-[#27ae60] rounded-xl px-4 py-3 text-center">
              <span className="text-white font-semibold text-base block">Total</span>
              <span className="text-white font-bold text-lg block">
                {formatCurrency(stats.totalRevenue)}
              </span>
            </div>

            {/* Serviços Card */}
            <div className="bg-[#5dade2]/80 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <span className="text-white font-semibold text-base block">Serviços</span>
                <span className="text-white font-bold text-lg block">
                  {formatCurrency(stats.totalRevenue)}
                </span>
              </div>
              <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center">
                <span className="text-white text-sm">?</span>
              </div>
            </div>

            {/* Produtos Card */}
            <div className="bg-[#9b8ec4]/80 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <span className="text-white font-semibold text-base block">Produtos</span>
                <span className="text-white font-bold text-lg block">R$ 0,00</span>
              </div>
              <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center">
                <span className="text-white text-sm">?</span>
              </div>
            </div>

            {/* Assinaturas Card */}
            <div className="bg-[#c9b23d]/80 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <span className="text-white font-semibold text-base block">Assinaturas</span>
                <span className="text-white font-bold text-lg block">R$ 0,00</span>
              </div>
              <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center">
                <span className="text-white text-sm">?</span>
              </div>
            </div>
          </div>
        </div>
        {/* Scrollable Content */}
        <div className="px-4 pb-6 space-y-6">
          {loading ? (
            <div className="space-y-4" />
          ) : (
            <>
              {/* Total Detalhado Table */}
              <div className="bg-[#1e2a3a] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto max-w-[640px] w-full">
                  <table className="min-w-[960px] text-base">
                    <thead>
                      <tr>
                        {/* Header: Label column */}
                        <th className="bg-[#2ecc71] text-white font-bold text-left px-4 py-3.5 min-w-[120px]">
                          Total detalhado
                        </th>
                        {/* Professional columns */}
                        {tableProfessionals.map((prof) => {
                          const isSelected = selectedProfessionalId === prof.id;
                          return (
                            <th
                              key={prof.id}
                              className={cn(
                                "bg-[#1e2a3a] px-3.5 py-3 text-center min-w-[130px]",
                                isSelected ? "border-b-2 border-[#00d9a5]" : ""
                              )}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <Avatar className="h-10 w-10 border-2 border-[#00d9a5]">
                                  <AvatarImage src={prof.avatar_url || undefined} alt={prof.name} />
                                  <AvatarFallback className="bg-[#0a1628] text-[#00d9a5] text-xs font-bold">
                                    {prof.name.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-white text-xs font-semibold">{prof.name.split(" ")[0]}</span>
                              </div>
                            </th>
                          );
                        })}
                        {/* Casa column */}
                        <th className="bg-[#1e2a3a] px-3.5 py-3 text-center min-w-[130px]">
                          <div className="flex flex-col items-center gap-1">
                            <div className="h-10 w-10 rounded-full bg-[#0a1628] border-2 border-[#00d9a5] flex items-center justify-center">
                              <BarChart3 className="h-5 w-5 text-[#00d9a5]" />
                            </div>
                            <span className="text-white text-xs font-semibold">Casa</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Serviços Row */}
                      <tr>
                        <td className="bg-[#5dade2]/60 text-white font-semibold px-4 py-4 border-t border-[#2a3d5a]">
                          Serviços
                        </td>
                        {tableProfessionals.map((prof) => (
                          <td key={prof.id} className="text-white text-center px-3.5 py-3 border-t border-[#2a3d5a]">
                            {formatCurrency(prof.revenue)}
                          </td>
                        ))}
                        <td className="text-white text-center px-3.5 py-3 border-t border-[#2a3d5a]">
                          {formatCurrency(stats.totalRevenue)}
                        </td>
                      </tr>

                      {/* Produtos Row */}
                      <tr>
                        <td className="bg-[#9b8ec4]/60 text-white font-semibold px-4 py-4 border-t border-[#2a3d5a]">
                          Produtos
                        </td>
                        {tableProfessionals.map((prof) => (
                          <td key={prof.id} className="text-white text-center px-3.5 py-3 border-t border-[#2a3d5a]">
                            R$ 0,00
                          </td>
                        ))}
                        <td className="text-white text-center px-3.5 py-3 border-t border-[#2a3d5a]">
                          R$ 0,00
                        </td>
                      </tr>

                      {/* Assinaturas Row */}
                      <tr>
                        <td className="bg-[#c9b23d]/60 text-white font-semibold px-4 py-4 border-t border-[#2a3d5a]">
                          Assinaturas
                        </td>
                        {tableProfessionals.map((prof) => (
                          <td key={prof.id} className="text-white text-center px-3.5 py-3 border-t border-[#2a3d5a]">
                            R$ 0,00
                          </td>
                        ))}
                        <td className="text-white text-center px-3.5 py-3 border-t border-[#2a3d5a]">
                          R$ 0,00
                        </td>
                      </tr>

                      {/* Descontos Row */}
                      <tr>
                        <td className="bg-[#e74c3c]/40 text-white font-semibold px-4 py-4 border-t border-[#2a3d5a]">
                          Descontos(-)
                        </td>
                        {tableProfessionals.map((prof) => (
                          <td key={prof.id} className="text-white text-center px-3.5 py-3 border-t border-[#2a3d5a]">
                            R$ 0,00
                          </td>
                        ))}
                        <td className="text-white text-center px-3.5 py-3 border-t border-[#2a3d5a]">
                          R$ 0,00
                        </td>
                      </tr>

                      {/* Total Row */}
                      <tr>
                        <td className="bg-[#7f8c8d]/40 text-white font-bold px-4 py-4 border-t border-[#2a3d5a]">
                          Total
                        </td>
                        {tableProfessionals.map((prof) => (
                          <td key={prof.id} className="text-white font-bold text-center px-3.5 py-3 border-t border-[#2a3d5a]">
                            {formatCurrency(prof.revenue)}
                          </td>
                        ))}
                        <td className="text-white font-bold text-center px-3.5 py-3 border-t border-[#2a3d5a]">
                          {formatCurrency(stats.totalRevenue)}
                        </td>
                      </tr>

                      {/* Comissão Row */}
                      <tr>
                        <td className="bg-[#1abc9c]/40 text-white font-semibold px-4 py-4 border-t border-[#2a3d5a]">
                          Comissão
                        </td>
                        {tableProfessionals.map((prof) => (
                          <td key={prof.id} className="text-white text-center px-3.5 py-3 border-t border-[#2a3d5a]">
                            {formatCurrency(Math.round(prof.revenue * 0.4))}
                          </td>
                        ))}
                        <td className="text-white text-center px-3.5 py-3 border-t border-[#2a3d5a]">
                          {formatCurrency(Math.round(stats.totalRevenue * 0.4))}
                        </td>
                      </tr>

                      {/* Casa Row */}
                      <tr>
                        <td className="bg-[#e67e22]/40 text-white font-semibold px-4 py-4 border-t border-[#2a3d5a]">
                          Casa
                        </td>
                        {tableProfessionals.map((prof) => (
                          <td key={prof.id} className="text-white text-center px-3.5 py-3 border-t border-[#2a3d5a]">
                            {formatCurrency(Math.round(prof.revenue * 0.6))}
                          </td>
                        ))}
                        <td className="text-white text-center px-3.5 py-3 border-t border-[#2a3d5a]">
                          {formatCurrency(Math.round(stats.totalRevenue * 0.6))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="p-3 rounded-lg bg-[#1a2d4a] border border-[#2a3d5a] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-[#00d9a5]" />
                  <span className="text-[#00d9a5]/70 text-xs">
                    {formatDateLabel(startDate)}  {formatDateLabel(endDate)}
                    {selectedProfessional ? `  ${selectedProfessional.name}` : ""}
                  </span>
                </div>
                <p className="text-[#00d9a5]/50 text-xs">
                  Atualizado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminRelatorios;
