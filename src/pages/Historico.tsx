import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "@/components/Header";
import Logo from "@/components/Logo";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { Check, Calendar, User, DollarSign, Info, CheckCircle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  client_name: string | null;
  status: string;
  services: { name: string; price: number } | null;
  professionals: { name: string } | null;
}

interface GroupedAppointments {
  [monthYear: string]: {
    [day: string]: Appointment[];
  };
}

const Historico = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Check if we came from a successful booking
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (location.state?.showConfirmation || searchParams.get('confirmation') === 'true') {
      setShowConfirmation(true);
      // Clear the state and URL params so it doesn't show again on refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.state]);

  // Get session data from localStorage
  const sessionToken = localStorage.getItem("sessionToken");
  const clientName = localStorage.getItem("clientName");

  useEffect(() => {
    const fetchAppointments = async () => {
      // If not logged in, don't fetch appointments
      if (!sessionToken) {
        setAppointments([]);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('get-appointments', {
          body: { session_token: sessionToken }
        });

        if (error) {
          console.error("Error fetching appointments:", error);
          setAppointments([]);
        } else if (data?.unauthorized) {
          // Token expired or invalid, clear session
          localStorage.removeItem("sessionToken");
          localStorage.removeItem("clientPhone");
          localStorage.removeItem("clientName");
          setAppointments([]);
          navigate("/");
        } else {
          setAppointments(data?.appointments || []);
        }
      } catch (err) {
        console.error("Error calling edge function:", err);
        setAppointments([]);
      }
      
      setIsLoading(false);
    };

    fetchAppointments();
  }, [sessionToken, navigate]);

  const handleTabChange = (tab: "agendar" | "historico" | "planos") => {
    if (tab === "agendar") {
      navigate("/");
    } else if (tab === "planos") {
      navigate("/planos");
    }
  };

  // Group appointments by month and day
  const groupedAppointments = appointments.reduce<GroupedAppointments>((acc, appointment) => {
    const date = new Date(appointment.appointment_date + "T00:00:00");
    const monthYear = format(date, "MMMM", { locale: ptBR });
    const day = format(date, "dd/MM");

    if (!acc[monthYear]) {
      acc[monthYear] = {};
    }
    if (!acc[monthYear][day]) {
      acc[monthYear][day] = [];
    }
    acc[monthYear][day].push(appointment);
    return acc;
  }, {});

  const formatDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr + "T00:00:00");
    return format(date, "EEEE", { locale: ptBR });
  };

  const capitalizeFirst = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <Logo />

      <main className="container max-w-3xl mx-auto px-4">
        <h1 className="text-xl font-bold text-center">Histórico de Agendamentos</h1>
        {clientName && (
          <p className="text-center text-muted-foreground mb-6">{clientName}</p>
        )}

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando agendamentos...
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum agendamento encontrado.
          </div>
        ) : (
          <div className="relative mt-8">
            {Object.entries(groupedAppointments).map(([month, days]) => (
              <div key={month} className="relative">
                {/* Month header with timeline dot */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-foreground" />
                  <span className="font-medium">{capitalizeFirst(month)}</span>
                </div>

                {/* Days within month */}
                <div className="ml-[5px] border-l border-muted-foreground/50">
                  {Object.entries(days).map(([day, dayAppointments]) => (
                    <div key={day} className="relative pb-4">
                      {/* Day label with line */}
                      <div className="flex items-center mb-3">
                        <div className="w-4 border-t border-muted-foreground/50" />
                        <span className="text-sm text-muted-foreground ml-2">{day}</span>
                      </div>

                      {/* Appointments for this day */}
                      <div className="ml-6 space-y-3">
                        {dayAppointments.map((appointment) => (
                          <div
                            key={appointment.id}
                            className="relative border-2 border-primary rounded-lg p-4 bg-card"
                          >
                            <div className="space-y-1.5 pr-12">
                              {/* Service name */}
                              <div className="flex items-center gap-2">
                                <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium uppercase">
                                  {appointment.services?.name || "Serviço"}
                                </span>
                              </div>

                              {/* Date and time */}
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span>
                                  {capitalizeFirst(formatDayOfWeek(appointment.appointment_date))}{" "}
                                  {format(new Date(appointment.appointment_date + "T00:00:00"), "dd/MM", { locale: ptBR })} às{" "}
                                  {appointment.appointment_time.slice(0, 5)}
                                </span>
                              </div>

                              {/* Professional */}
                              <div className="flex items-center gap-2 text-sm">
                                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span>Profissional {appointment.professionals?.name || "N/A"}</span>
                              </div>

                              {/* Price */}
                              <div className="flex items-center gap-2 text-sm">
                                <DollarSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span>
                                  Valor R${appointment.services?.price?.toFixed(2).replace(".", ",") || "0,00"}
                                </span>
                              </div>
                            </div>

                            {/* Checkmark */}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <div className="w-9 h-9 rounded-full border-2 border-primary flex items-center justify-center">
                                <Check className="h-5 w-5 text-primary" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-w-sm rounded-2xl p-6">
          <button
            onClick={() => setShowConfirmation(false)}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex flex-col items-center text-center pt-4">
            {/* Success Icon */}
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <CheckCircle className="h-12 w-12 text-primary" />
            </div>

            <h2 className="text-xl font-bold mb-2">Agendamento Confirmado!</h2>
            <p className="text-muted-foreground mb-6">
              Seu agendamento foi realizado com sucesso.
            </p>

            <Button
              onClick={() => setShowConfirmation(false)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-6"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav activeTab="historico" onTabChange={handleTabChange} />
    </div>
  );
};

export default Historico;
