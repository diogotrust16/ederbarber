import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, User, Phone } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAdminSession } from "@/hooks/useAdminSession";
import { toast } from "sonner";

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface Professional {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface ExistingAppointment {
  id: string;
  appointment_time: string;
  service: {
    duration_minutes: number;
  } | null;
}

interface CreateAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  selectedTime: string;
  selectedProfessional: Professional | null;
  existingAppointments: ExistingAppointment[];
  onAppointmentCreated?: () => void;
}

const CreateAppointmentModal = ({
  open,
  onOpenChange,
  selectedDate,
  selectedTime,
  selectedProfessional,
  existingAppointments,
  onAppointmentCreated,
}: CreateAppointmentModalProps) => {
  const { invokeAdminFunction } = useAdminSession();

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all services
  useEffect(() => {
    const fetchServices = async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price, duration_minutes")
        .eq("is_active", true);

      if (!error && data) {
        setServices(data);
      }
    };

    if (open) {
      fetchServices();
      // Reset form when modal opens
      setClientName("");
      setClientPhone("");
      setSelectedServiceId("");
    }
  }, [open]);

  const selectedService = services.find((s) => s.id === selectedServiceId);

  // Calculate end time
  const getEndTime = () => {
    if (!selectedService) return selectedTime;
    const [startHour, startMin] = selectedTime.split(":").map(Number);
    const endMinutes = startHour * 60 + startMin + selectedService.duration_minutes;
    const endHour = Math.floor(endMinutes / 60);
    const endMin = endMinutes % 60;
    return `${endHour.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`;
  };

  // Check for time conflicts with existing appointments
  const checkTimeConflict = (): string | null => {
    if (!selectedService) return null;

    const [newStartHour, newStartMin] = selectedTime.split(":").map(Number);
    const newStartMinutes = newStartHour * 60 + newStartMin;
    const newEndMinutes = newStartMinutes + selectedService.duration_minutes;

    for (const apt of existingAppointments) {
      const [aptStartHour, aptStartMin] = apt.appointment_time.slice(0, 5).split(":").map(Number);
      const aptStartMinutes = aptStartHour * 60 + aptStartMin;
      const aptDuration = apt.service?.duration_minutes || 30;
      const aptEndMinutes = aptStartMinutes + aptDuration;

      // Check if ranges overlap
      const hasOverlap = newStartMinutes < aptEndMinutes && newEndMinutes > aptStartMinutes;

      if (hasOverlap) {
        const aptEndTime = `${Math.floor(aptEndMinutes / 60).toString().padStart(2, "0")}:${(aptEndMinutes % 60).toString().padStart(2, "0")}`;
        return `Conflito com agendamento das ${apt.appointment_time.slice(0, 5)} às ${aptEndTime}`;
      }
    }

    return null;
  };

  const conflictMessage = checkTimeConflict();

  const handleCreateAppointment = async () => {
    if (!clientName.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    if (!clientPhone.trim()) {
      toast.error("Informe o telefone do cliente");
      return;
    }
    if (!selectedServiceId) {
      toast.error("Selecione um serviço");
      return;
    }
    if (!selectedProfessional) {
      toast.error("Nenhum profissional selecionado");
      return;
    }
    if (conflictMessage) {
      toast.error(conflictMessage);
      return;
    }

    setIsLoading(true);
    try {
      await invokeAdminFunction("admin-appointments", {
        action: "create",
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        service_id: selectedServiceId,
        professional_id: selectedProfessional.id,
        appointment_date: format(selectedDate, "yyyy-MM-dd"),
        appointment_time: selectedTime,
      });

      toast.success("Agendamento criado com sucesso");
      onAppointmentCreated?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating appointment:", error);
      toast.error("Erro ao criar agendamento");
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)})${cleaned.slice(2)}`;
    if (cleaned.length <= 11) return `(${cleaned.slice(0, 2)})${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    return `(${cleaned.slice(0, 2)})${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientPhone(formatPhone(e.target.value));
  };

  const dayName = format(selectedDate, "EEEE", { locale: ptBR });
  const formattedDate = format(selectedDate, "dd/MM");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a2e] border-none text-white max-w-md p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a4a]">
          <h2 className="text-lg font-semibold">
            {selectedTime} - {getEndTime()} {dayName.charAt(0).toUpperCase() + dayName.slice(1)} {formattedDate}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Professional Info */}
          {selectedProfessional && (
            <div className="flex items-center gap-3 bg-[#2a2a4a] rounded-lg px-4 py-3">
              <div className="h-10 w-10 rounded-full bg-[#6366f1] flex items-center justify-center text-white font-semibold">
                {selectedProfessional.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-white font-medium">{selectedProfessional.name}</span>
            </div>
          )}

          {/* Client Name */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">Nome do Cliente</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Digite o nome do cliente"
                className="bg-[#2a2a4a] border-none text-white pl-10 placeholder:text-white/30"
              />
            </div>
          </div>

          {/* Client Phone */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">Telefone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                value={clientPhone}
                onChange={handlePhoneChange}
                placeholder="(00) 00000-0000"
                className="bg-[#2a2a4a] border-none text-white pl-10 placeholder:text-white/30"
              />
            </div>
          </div>

          {/* Service Selection */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">Serviço</label>
            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
              <SelectTrigger className="bg-[#2a2a4a] border-none text-white">
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} - R$ {service.price.toFixed(2).replace(".", ",")} ({service.duration_minutes}min)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price Summary */}
          {selectedService && (
            <div className={`border rounded-lg p-3 ${conflictMessage ? 'border-red-500' : 'border-[#00d9a5]'}`}>
              <div className="flex justify-between items-center">
                <span className="text-white/70">Valor do serviço</span>
                <span className="text-[#00d9a5] font-semibold text-lg">
                  R$ {selectedService.price.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-white/50 text-sm">Duração</span>
                <span className="text-white/70 text-sm">{selectedService.duration_minutes} minutos</span>
              </div>
            </div>
          )}

          {/* Conflict Warning */}
          {conflictMessage && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-300 text-sm">
              ⚠️ {conflictMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              variant="outline"
              className="flex-1 bg-[#2a2a4a] border-none text-white hover:bg-[#3a3a5a]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateAppointment}
              disabled={isLoading || !clientName || !clientPhone || !selectedServiceId || !!conflictMessage}
              className="flex-1 bg-[#00d9a5] hover:bg-[#00c896] text-black font-semibold disabled:opacity-50"
            >
              {isLoading ? "Criando..." : "Criar Agendamento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAppointmentModal;
