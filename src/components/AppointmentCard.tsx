import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Appointment } from "@/hooks/useAppointments";

interface AppointmentCardProps {
  appointment: Appointment;
  onCancel: (id: string) => void;
  isCancelling: boolean;
}

const statusLabels = {
  scheduled: "Agendado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const statusColors = {
  scheduled: "bg-accent text-accent-foreground",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const AppointmentCard = ({ appointment, onCancel, isCancelling }: AppointmentCardProps) => {
  const date = parseISO(appointment.appointment_date);
  const isUpcoming = appointment.status === "scheduled" && date >= new Date();

  return (
    <div className="service-card">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-display text-lg font-semibold">
          {appointment.services?.name}
        </h3>
        <span className={`text-xs px-2 py-1 rounded-full ${statusColors[appointment.status]}`}>
          {statusLabels[appointment.status]}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
        <div className="flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {format(date, "dd/MM/yyyy", { locale: ptBR })}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          {appointment.appointment_time.slice(0, 5)}
        </div>
      </div>

      <p className="price-text text-sm">
        R$ {appointment.services?.price.toFixed(2).replace(".", ",")}
      </p>

      {isUpcoming && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onCancel(appointment.id)}
          disabled={isCancelling}
          className="mt-3 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="w-4 h-4 mr-1" />
          Cancelar
        </Button>
      )}
    </div>
  );
};

export default AppointmentCard;
