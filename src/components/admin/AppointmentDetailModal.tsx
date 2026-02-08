import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, User, Phone, Plus, ShoppingCart, ExternalLink, Printer, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAdminSession } from "@/hooks/useAdminSession";
import { toast } from "sonner";

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface AppointmentDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    client_name: string;
    client_phone: string;
    appointment_date: string;
    appointment_time: string;
    status: string;
    professional_id: string | null;
    service_id?: string;
    service: {
      name: string;
      price: number;
      duration_minutes: number;
    } | null;
  } | null;
  onStatusChange?: () => void;
  onAppointmentStatusUpdated?: (
    appointmentId: string,
    nextStatus: "cancelled" | "completed"
  ) => void;
}

const AppointmentDetailModal = ({
  open,
  onOpenChange,
  appointment,
  onStatusChange,
  onAppointmentStatusUpdated,
}: AppointmentDetailModalProps) => {
  const { invokeAdminFunction } = useAdminSession();

  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isServiceChecked, setIsServiceChecked] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

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
    }
  }, [open]);

  // Set initial selected service when appointment changes
  useEffect(() => {
    if (appointment?.service_id) {
      setSelectedServiceId(appointment.service_id);
    }
  }, [appointment]);

  if (!appointment) return null;

  const selectedService = services.find((s) => s.id === selectedServiceId) || appointment.service;

  const startTime = appointment.appointment_time.slice(0, 5);
  const durationMinutes = selectedService?.duration_minutes || 30;

  // Calculate end time
  const [startHour, startMin] = startTime.split(":").map(Number);
  const endMinutes = startHour * 60 + startMin + durationMinutes;
  const endHour = Math.floor(endMinutes / 60);
  const endMin = endMinutes % 60;
  const endTime = `${endHour.toString().padStart(2, "0")}:${endMin.toString().padStart(2, "0")}`;

  // Format date
  const appointmentDate = parseISO(appointment.appointment_date);
  const dayName = format(appointmentDate, "EEEE", { locale: ptBR });
  const formattedDate = format(appointmentDate, "dd/MM");

  const servicePrice = selectedService?.price || 0;
  const total = isServiceChecked ? servicePrice : 0;

  const handleServiceChange = async (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setIsLoading(true);

    try {
      await invokeAdminFunction("admin-appointments", {
        action: "update",
        id: appointment.id,
        updates: { service_id: serviceId },
      });

      toast.success("Serviço alterado com sucesso");
      onStatusChange?.();
    } catch (error) {
      console.error("Error updating service:", error);
      toast.error("Erro ao alterar serviço");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    setIsLoading(true);
    try {
      await invokeAdminFunction("admin-appointments", {
        action: "delete",
        id: appointment.id,
      });

      toast.success("Agendamento cancelado com sucesso");
      onAppointmentStatusUpdated?.(appointment.id, "cancelled");
      onStatusChange?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast.error("Erro ao cancelar agendamento");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishAppointment = async () => {
    setIsLoading(true);
    try {
      await invokeAdminFunction("admin-appointments", {
        action: "update",
        id: appointment.id,
        updates: {
          status: "completed",
          notes: description || null,
        },
      });

      toast.success("Serviço finalizado com sucesso");
      onAppointmentStatusUpdated?.(appointment.id, "completed");
      onStatusChange?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error finishing appointment:", error);
      toast.error("Erro ao finalizar serviço");
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)})${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1a1a2e] border-none text-white max-w-md p-0 gap-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a4a]">
          <h2 className="text-lg font-semibold">
            {startTime} - {endTime} {dayName.charAt(0).toUpperCase() + dayName.slice(1)} {formattedDate}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Origin Tag */}
          <div className="inline-block">
            <span className="bg-[#00d9a5] text-black text-xs font-medium px-3 py-1 rounded">
              Origem: Link principal
            </span>
          </div>

          {/* Client Info */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2 bg-[#2a2a4a] rounded-lg px-4 py-2 flex-1">
              <User className="h-4 w-4 text-white/70" />
              <span className="text-sm">{appointment.client_name}</span>
            </div>
            <div className="flex items-center gap-2 bg-[#2a2a4a] rounded-lg px-4 py-2 flex-1">
              <Phone className="h-4 w-4 text-[#25D366]" />
              <span className="text-sm">{formatPhone(appointment.client_phone)}</span>
            </div>
          </div>

          {/* Services/Products Tabs */}
          <div className="border border-[#6366f1] rounded-lg p-3">
            <Tabs defaultValue="servicos" className="w-full">
              <TabsList className="bg-transparent border-b border-[#2a2a4a] w-full justify-start rounded-none h-auto p-0 mb-3">
                <TabsTrigger
                  value="servicos"
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-[#6366f1] data-[state=active]:border-b-2 data-[state=active]:border-[#6366f1] rounded-none px-4 py-2 text-white/70"
                >
                  Serviços
                </TabsTrigger>
                <TabsTrigger
                  value="produtos"
                  className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-[#6366f1] data-[state=active]:border-b-2 data-[state=active]:border-[#6366f1] rounded-none px-4 py-2 text-white/70"
                >
                  Produtos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="servicos" className="mt-0 space-y-3">
                {/* Service Item */}
                <div className="flex items-center gap-2">
                  <Select value={selectedServiceId} onValueChange={handleServiceChange}>
                    <SelectTrigger className="bg-[#6366f1] border-none text-white flex-1">
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="bg-[#2a2a4a] px-4 py-2 rounded text-[#00d9a5] font-medium">
                    R$ {servicePrice.toFixed(2).replace(".", ",")}
                  </div>
                  <Checkbox
                    checked={isServiceChecked}
                    onCheckedChange={(checked) => setIsServiceChecked(!!checked)}
                    className="border-white/50 data-[state=checked]:bg-[#6366f1] data-[state=checked]:border-[#6366f1]"
                  />
                  <button className="text-red-400 hover:text-red-300 transition-colors">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>

                {/* Add Buttons */}
                <div className="flex gap-2">
                  <button className="bg-[#6366f1] hover:bg-[#5558e3] text-white p-2 rounded transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                  <button className="bg-[#6366f1] hover:bg-[#5558e3] text-white p-2 rounded transition-colors">
                    <ShoppingCart className="h-4 w-4" />
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="produtos" className="mt-0">
                <p className="text-white/50 text-sm text-center py-4">
                  Nenhum produto adicionado
                </p>
              </TabsContent>
            </Tabs>
          </div>

          {/* Payment Summary */}
          <div className="border border-[#00d9a5] rounded-lg p-3 space-y-3">
            <span className="text-xs text-[#00d9a5]">Resumo de pagamento</span>
            
            <div className="space-y-2">
              <p className="text-[#00d9a5] font-semibold">Total pendente</p>
              
              <div className="flex items-center gap-2">
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="bg-[#2a2a4a] border-none text-white flex-1">
                    <SelectValue placeholder="Selecione a forma de pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  </SelectContent>
                </Select>
                <div className="bg-[#2a2a4a] px-4 py-2 rounded text-[#00d9a5] font-medium whitespace-nowrap">
                  R$ {total.toFixed(2).replace(".", ",")}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-white font-medium">
                  Total R$ {total.toFixed(2).replace(".", ",")}
                </span>
                <div className="flex gap-2">
                  <button className="bg-[#2a2a4a] hover:bg-[#3a3a5a] p-2 rounded transition-colors">
                    <ExternalLink className="h-4 w-4 text-white" />
                  </button>
                  <button className="bg-[#2a2a4a] hover:bg-[#3a3a5a] p-2 rounded transition-colors">
                    <Printer className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={isLoading}
                  className="flex-1 bg-[#ff4757] hover:bg-[#ff3344] text-white border-none"
                >
                  Cancelar<br />serviço
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#1a1a2e] border-[#2a2a4a]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Cancelar agendamento?</AlertDialogTitle>
                  <AlertDialogDescription className="text-white/70">
                    Tem certeza que deseja cancelar o agendamento de <strong className="text-white">{appointment.client_name}</strong>? 
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-[#2a2a4a] text-white border-none hover:bg-[#3a3a5a]">
                    Voltar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelAppointment}
                    className="bg-[#ff4757] hover:bg-[#ff3344] text-white"
                  >
                    Sim, cancelar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={isLoading}
                  className="flex-1 bg-[#00d9a5] hover:bg-[#00c896] text-black border-none font-semibold"
                >
                  Finalizar serviço
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#1a1a2e] border-[#2a2a4a]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Finalizar serviço?</AlertDialogTitle>
                  <AlertDialogDescription className="text-white/70">
                    Confirma a finalização do serviço de <strong className="text-white">{appointment.client_name}</strong>?
                    <br />
                    <span className="text-[#00d9a5]">Valor: R$ {total.toFixed(2).replace(".", ",")}</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-[#2a2a4a] text-white border-none hover:bg-[#3a3a5a]">
                    Voltar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleFinishAppointment}
                    className="bg-[#00d9a5] hover:bg-[#00c896] text-black font-semibold"
                  >
                    Sim, finalizar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">Descrição:</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicione uma descrição..."
              className="bg-[#2a2a4a] border-none text-white placeholder:text-white/30 resize-none"
              rows={2}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentDetailModal;
