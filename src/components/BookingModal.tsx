import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Scissors, User, Calendar, Clock, Crown, AlertTriangle, Loader2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Service } from "@/hooks/useServices";
import { useProfessionals, Professional } from "@/hooks/useProfessionals";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface BookingModalProps {
  service: Service | null;
  isOpen: boolean;
  onClose: () => void;
}

interface AvailabilitySlot {
  appointment_time: string;
  professional_id: string | null;
  duration_minutes: number;
}

interface BlockedTime {
  professional_id: string;
  start_time: string;
  end_time: string;
}

interface BusinessHours {
  day_of_week: number;
  is_open: boolean;
  open_time?: string | null;
  close_time?: string | null;
}

interface SubscriptionInfo {
  has_active: boolean;
  active_subscriptions: Array<{
    id: string;
    service_id: string;
    service: { id: string; name: string; price: number; is_subscription: boolean } | null;
  }>;
  expired_subscriptions: Array<{
    id: string;
    service_id: string;
    service: { id: string; name: string; price: number; is_subscription: boolean } | null;
  }>;
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const generateSlots = (open: string, close: string, duration: number, step = 15) => {
  const slots: string[] = [];
  const start = toMinutes(open);
  const end = toMinutes(close);
  for (let current = start; current + duration <= end; current += step) {
    const hours = Math.floor(current / 60)
      .toString()
      .padStart(2, "0");
    const minutes = (current % 60).toString().padStart(2, "0");
    slots.push(`${hours}:${minutes}`);
  }
  return slots;
};

const getDayName = (date: Date): string => {
  const fullName = format(date, "EEEE", { locale: ptBR });
  return fullName.replace("-feira", "");
};

const getAvailableDates = (startOffset: number, isOpen: (d: Date) => boolean): Date[] => {
  const dates: Date[] = [];
  const today = new Date();
  let offset = startOffset;

  // scan up to 30 days from offset and collect 7 open days
  while (dates.length < 7 && offset < startOffset + 30) {
    const date = addDays(today, offset);
    if (isOpen(date)) {
      dates.push(date);
    }
    offset++;
  }

  return dates;
};

const BookingModal = ({ service, isOpen, onClose }: BookingModalProps) => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const { data: professionals } = useProfessionals();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [existingAppointments, setExistingAppointments] = useState<AvailabilitySlot[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([]);
  const [loadingBusinessHours, setLoadingBusinessHours] = useState(true);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [showExpiredWarning, setShowExpiredWarning] = useState(false);
  const [dismissedWarning, setDismissedWarning] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Try to fetch business_hours using admin session token if present (helps when backend deploy está defasado)
  const fetchBusinessHoursWithAdminSession = useCallback(async () => {
    try {
      const adminSessionStr = localStorage.getItem("adminSession");
      if (!adminSessionStr) return null;
      const adminSession = JSON.parse(adminSessionStr);
      if (!adminSession?.token) return null;

      const { data, error } = await supabase.functions.invoke("admin-business-hours", {
        body: { action: "list" },
        headers: { Authorization: `Bearer ${adminSession.token}` },
      });

      if (error) {
        console.warn("[BookingModal] admin-business-hours invoke error:", error);
        return null;
      }

      if (data?.data) {
        console.log("[BookingModal] business_hours from admin session:", data.data);
        return data.data as BusinessHours[];
      }
    } catch (err) {
      console.warn("[BookingModal] failed to fetch business_hours via admin session", err);
    }
    return null;
  }, []);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)})${digits.slice(2)}`;
    return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setClientPhone(formatted);
    setDismissedWarning(false);
  };

  const [dateOffset, setDateOffset] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const professionalRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const resumeRef = useRef<HTMLDivElement>(null);

  const effectiveBusinessHours =
    businessHours.length > 0 ? businessHours : defaultBusinessHours;

  const scheduleMap = useMemo(() => {
    if (businessHours.length === 0) {
      console.warn(
        "[BookingModal] business_hours not returned from backend; using fallback defaults."
      );
    }
    const m = new Map<number, BusinessHours>();
    effectiveBusinessHours.forEach((bh) => m.set(bh.day_of_week, bh));
    return m;
  }, [effectiveBusinessHours, businessHours.length]);

  const isDateOpen = useCallback(
    (date: Date) => {
      const entry = scheduleMap.get(date.getDay());
      return entry ? entry.is_open : false;
    },
    [scheduleMap]
  );

  const availableDates = useMemo(
    () => getAvailableDates(dateOffset, isDateOpen),
    [dateOffset, isDateOpen]
  );

  useEffect(() => {
    if (loadingBusinessHours) return;
    if (availableDates.length === 0) {
      setSelectedDate(undefined);
      setSelectedProfessional(null);
      setSelectedTime(null);
      return;
    }
    if (
      !selectedDate ||
      !availableDates.some((d) => d.toDateString() === selectedDate.toDateString()) ||
      !isDateOpen(selectedDate)
    ) {
      setSelectedDate(availableDates[0]);
      setSelectedTime(null);
    }
  }, [loadingBusinessHours, availableDates, selectedDate, isDateOpen]);

  // Check subscription when phone has 11 digits
  const checkSubscription = useCallback(async (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setSubscriptionInfo(null);
      setShowExpiredWarning(false);
      return;
    }

    setCheckingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-subscriptions', {
        body: { action: "check-by-phone", client_phone: phone }
      });

      if (error || !data?.success) {
        console.error("Error checking subscription:", error);
        setSubscriptionInfo(null);
        return;
      }

      setSubscriptionInfo(data);
      if (!data.has_active && data.expired_subscriptions?.length > 0) {
        setShowExpiredWarning(true);
      } else {
        setShowExpiredWarning(false);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setCheckingSubscription(false);
    }
  }, []);

  // Debounce subscription check
  useEffect(() => {
    const digits = clientPhone.replace(/\D/g, "");
    if (digits.length >= 10) {
      const timer = setTimeout(() => checkSubscription(clientPhone), 500);
      return () => clearTimeout(timer);
    } else {
      setSubscriptionInfo(null);
      setShowExpiredWarning(false);
    }
  }, [clientPhone, checkSubscription]);

  // Fetch availability + business hours
  useEffect(() => {
    const fetchAvailability = async () => {
      if (!selectedDate) {
        setExistingAppointments([]);
        setBlockedTimes([]);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('get-availability', {
          body: { date: format(selectedDate, "yyyy-MM-dd") }
        });

        if (error) {
          console.error("Error fetching availability:", error);
          return;
        }

        if (data?.businessHours) {
          console.log("[BookingModal] business_hours received:", data.businessHours);
          setBusinessHours(data.businessHours);
        } else {
          // Fallback: try anon select (policy added) then admin session
          const { data: bhData, error: bhError } = await supabase
            .from("business_hours")
            .select("day_of_week, is_open, open_time, close_time")
            .order("day_of_week");
          if (bhError) {
            console.warn("[BookingModal] fallback business_hours select failed:", bhError);
            const adminBH = await fetchBusinessHoursWithAdminSession();
            if (adminBH) {
              setBusinessHours(adminBH);
            }
          } else if (bhData) {
            console.log("[BookingModal] business_hours via direct select:", bhData);
            setBusinessHours(bhData);
          }
        }

        if (data?.availability) {
          console.log("[BookingModal] availability received:", data.availability);
          setExistingAppointments(data.availability);
        }
        if (data?.blockedTimes) {
          console.log("[BookingModal] blockedTimes received:", data.blockedTimes);
          setBlockedTimes(data.blockedTimes);
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoadingBusinessHours(false);
      }
    };

    fetchAvailability();
  }, [selectedDate, refreshKey]);

  // Refresh schedule and availability periodically while modal aberto
  useEffect(() => {
    if (!isOpen) return;
    // reset to today when abrir
    setSelectedDate(new Date());
    setLoadingBusinessHours(true);
    const id = setInterval(() => setRefreshKey((k) => k + 1), 10000);
    return () => clearInterval(id);
  }, [isOpen]);

  // Ensure selected date always points to a day em funcionamento
  useEffect(() => {
    if (loadingBusinessHours) return;
    if (availableDates.length === 0) return;

    const isDateOpen = (date: Date | undefined) => {
      if (!date) return false;
      const schedule = businessHours.find((bh) => bh.day_of_week === date.getDay());
      return schedule ? schedule.is_open : true;
    };

    if (!selectedDate || !isDateOpen(selectedDate)) {
      setSelectedDate(availableDates[0]);
      setSelectedTime(null);
    }
  }, [loadingBusinessHours, availableDates, businessHours, selectedDate]);

  // Auto-scroll
  useEffect(() => {
    if (selectedDate && professionalRef.current) {
      setTimeout(() => {
        professionalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedProfessional && timeRef.current) {
      setTimeout(() => {
        timeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [selectedProfessional]);

  useEffect(() => {
    if (selectedTime && resumeRef.current) {
      setTimeout(() => {
        resumeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [selectedTime]);

  const handleRenewSubscription = async (expiredSub: SubscriptionInfo["expired_subscriptions"][0]) => {
    if (!expiredSub.service) return;

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          service_id: expiredSub.service_id,
          client_name: clientName.trim(),
          client_phone: clientPhone.trim(),
        }
      });

      if (error || !data?.success) {
        toast({
          title: "Erro ao iniciar checkout",
          description: data?.error || "Tente novamente mais tarde",
          variant: "destructive",
        });
        return;
      }

      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Error:", err);
      toast({
        title: "Erro ao iniciar checkout",
        variant: "destructive",
      });
    }
  };

  const handleBook = async () => {
    if (!service || !selectedDate || !selectedTime || !selectedProfessional) {
      toast({
        title: "Selecione data, profissional e horário",
        variant: "destructive",
      });
      return;
    }

    if (!clientName.trim() || !clientPhone.trim()) {
      toast({
        title: "Preencha nome e telefone",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase.functions.invoke('create-booking', {
      body: {
        service_id: service.id,
        professional_id: selectedProfessional.id,
        appointment_date: format(selectedDate, "yyyy-MM-dd"),
        appointment_time: selectedTime,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
      }
    });

    if (error || data?.error) {
      console.error("Booking error:", error || data?.error);
      toast({
        title: "Erro ao agendar",
        description: data?.error === 'Time slot is no longer available' 
          ? "Este horário já não está disponível" 
          : "Tente novamente mais tarde",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const { data: sessionData } = await supabase.functions.invoke('check-phone', {
        body: { client_phone: clientPhone.trim() }
      });

      if (sessionData?.session_token) {
        localStorage.setItem("sessionToken", sessionData.session_token);
        localStorage.setItem("clientName", sessionData.client_name || clientName.trim());
        localStorage.setItem("clientPhone", sessionData.client_phone || clientPhone.trim());
      }
    } catch (err) {
      console.error("Error getting session token:", err);
      localStorage.setItem("clientName", clientName.trim());
      localStorage.setItem("clientPhone", clientPhone.trim());
    }

    handleClose();
    navigate("/historico", { state: { showConfirmation: true } });
  };

  const handleClose = () => {
    onClose();
    setSelectedDate(undefined);
    setSelectedProfessional(null);
    setSelectedTime(null);
    setClientName("");
    setClientPhone("");
    setDateOffset(0);
    setIsSubmitting(false);
    setSubscriptionInfo(null);
    setShowExpiredWarning(false);
    setDismissedWarning(false);
  };

  const handlePrevDates = () => {
    if (dateOffset > 0) {
      setDateOffset(dateOffset - 7);
    }
  };

  const handleNextDates = () => {
    if (dateOffset < 23) {
      setDateOffset(dateOffset + 7);
    }
  };

  if (!service) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogTitle className="sr-only">{service.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Selecione data, profissional e horário para o serviço {service.name}.
        </DialogDescription>
        <div className="text-center space-y-4 p-6 overflow-y-auto flex-1">
          <h2 className="text-xl font-semibold">{service.name}</h2>
          
          {service.description && (
            <p className="text-muted-foreground text-sm">
              {service.description}
            </p>
          )}

          <div className="pt-4">
            <p className="text-sm font-medium mb-4">Selecione o dia da semana desejado:</p>
            
            {loadingBusinessHours ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando horários...
              </div>
            ) : availableDates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
                <Clock className="h-5 w-5" />
                <span>Nenhuma data disponível conforme horário de funcionamento.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevDates}
                  disabled={dateOffset === 0}
                  className="shrink-0"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                
                <div className="grid grid-cols-3 gap-1.5 w-full max-w-[320px] mx-auto">
                  {availableDates.map((date, index) => (
                    <button
                      key={date.toISOString()}
                      onClick={() => setSelectedDate(date)}
                      className={`
                        flex flex-col items-center justify-center h-[64px] rounded-lg border
                        transition-colors
                        ${index === 6 ? "col-start-2" : ""}
                        ${selectedDate?.toDateString() === date.toDateString()
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary"
                        }
                      `}
                    >
                      <span className="font-semibold text-base">
                        {format(date, "dd/MM", { locale: ptBR })}
                      </span>
                      <span className="text-sm capitalize truncate w-full text-center">
                        {getDayName(date)}
                      </span>
                    </button>
                  ))}
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNextDates}
                  disabled={dateOffset >= 23}
                  className="shrink-0"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>

          {selectedDate && (
            <div ref={professionalRef} className="pt-4">
              <p className="text-sm font-medium mb-4">Selecione o profissional:</p>
              <div className="flex justify-center gap-6">
                {professionals?.map((prof) => (
                  <button
                    key={prof.id}
                    onClick={() => setSelectedProfessional(prof)}
                    className={`flex flex-col items-center gap-2 p-2 rounded-lg transition-all ${
                      selectedProfessional?.id === prof.id
                        ? "ring-2 ring-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={prof.avatar_url || undefined} alt={prof.name} />
                      <AvatarFallback>{prof.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-center max-w-[80px] leading-tight">
                      {prof.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedDate && selectedProfessional && service && (() => {
            const isSlotOccupied = (time: string): boolean => {
              const [slotHour, slotMin] = time.split(":").map(Number);
              const slotStartMinutes = slotHour * 60 + slotMin;
              const slotEndMinutes = slotStartMinutes + service.duration_minutes;

              for (const apt of existingAppointments) {
                if (apt.professional_id !== selectedProfessional.id) continue;
                const [aptHour, aptMin] = apt.appointment_time.slice(0, 5).split(":").map(Number);
                const aptStartMinutes = aptHour * 60 + aptMin;
                const aptDuration = apt.duration_minutes || 30;
                const aptEndMinutes = aptStartMinutes + aptDuration;
                const hasOverlap = slotStartMinutes < aptEndMinutes && slotEndMinutes > aptStartMinutes;
                if (hasOverlap) return true;
              }
              return false;
            };

            const isSlotBlocked = (time: string): boolean => {
              const [slotHour, slotMin] = time.split(":").map(Number);
              const slotStartMinutes = slotHour * 60 + slotMin;
              const slotEndMinutes = slotStartMinutes + service.duration_minutes;

              for (const block of blockedTimes) {
                if (block.professional_id !== selectedProfessional.id) continue;
                const [blockStartHour, blockStartMin] = block.start_time.slice(0, 5).split(":").map(Number);
                const [blockEndHour, blockEndMin] = block.end_time.slice(0, 5).split(":").map(Number);
                const blockStartMinutes = blockStartHour * 60 + blockStartMin;
                const blockEndMinutes = blockEndHour * 60 + blockEndMin;
                const hasOverlap = slotStartMinutes < blockEndMinutes && slotEndMinutes > blockStartMinutes;
                if (hasOverlap) return true;
              }
              return false;
            };

            const schedule = businessHours.find((bh) => bh.day_of_week === selectedDate.getDay());
            const isClosed = schedule ? !schedule.is_open : false;

            const slots = schedule
              ? schedule.is_open
                ? generateSlots(
                    schedule.open_time?.slice(0, 5) || "08:00",
                    schedule.close_time?.slice(0, 5) || "19:00",
                    service.duration_minutes || 30
                  )
                : []
              : generateSlots("08:00", "19:00", service.duration_minutes || 30);

            const availableSlots = slots.filter((time) => {
              const today = new Date();
              const isToday = selectedDate.toDateString() === today.toDateString();
              if (isToday) {
                const [hours, minutes] = time.split(":").map(Number);
                const slotTime = new Date();
                slotTime.setHours(hours, minutes, 0, 0);
                if (slotTime <= today) return false;
              }
              return !isSlotOccupied(time) && !isSlotBlocked(time);
            });

            return (
              <div ref={timeRef} className="pt-4">
                <p className="text-sm font-medium mb-4">Escolha um Horário Disponível:</p>
                {isClosed ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Estamos fechados neste dia.</p>
                    <p className="text-sm mt-1">Selecione outra data.</p>
                  </div>
                ) : availableSlots.length > 0 ? (
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                    {availableSlots.map((time) => (
                      <Button
                        key={time}
                        variant={selectedTime === time ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTime(time)}
                        className="text-lg md:text-sm px-3 py-5 md:py-3 h-auto font-medium rounded-xl md:rounded-md"
                      >
                        {time}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum horário disponível para este dia.</p>
                    <p className="text-sm mt-1">Por favor, selecione outra data.</p>
                  </div>
                )}
              </div>
            );
          })()}

          {selectedDate && selectedProfessional && selectedTime && (
            <div ref={resumeRef} className="pt-6 border-t mt-6 text-center">
              <h3 className="text-xl font-bold mb-4">RESUMO</h3>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-center gap-2">
                  <Scissors className="h-4 w-4" />
                  <span>{service.name}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <User className="h-4 w-4" />
                  <span>Profissional {selectedProfessional.name}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{selectedTime}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="text-left">
                  <label className="text-sm font-medium">Nome e sobrenome:</label>
                  <Input
                    placeholder="Nome e sobrenome"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="text-left">
                  <label className="text-sm font-medium">Telefone:</label>
                  <Input
                    placeholder="(99)99999-9999"
                    value={clientPhone}
                    onChange={handlePhoneChange}
                    inputMode="numeric"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Subscription Status */}
              {checkingSubscription && (
                <div className="mt-3 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Verificando plano...
                </div>
              )}

              {subscriptionInfo?.has_active && (
                <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <div className="flex items-center justify-center gap-2">
                    <Crown className="h-4 w-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                      Cliente Assinante
                    </span>
                    <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                      Ativo ✓
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {subscriptionInfo.active_subscriptions.map(s => s.service?.name).join(", ")}
                  </p>
                </div>
              )}

              {!dismissedWarning && showExpiredWarning && subscriptionInfo && !subscriptionInfo.has_active && subscriptionInfo.expired_subscriptions.length > 0 && (
                <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-600 dark:text-amber-400 font-medium text-sm">
                      Plano Vencido
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Seu plano <strong>{subscriptionInfo.expired_subscriptions[0]?.service?.name}</strong> está vencido. Renove para continuar aproveitando os benefícios!
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => setDismissedWarning(true)}
                    >
                      Não agora
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={() => handleRenewSubscription(subscriptionInfo.expired_subscriptions[0])}
                    >
                      <Crown className="h-3 w-3 mr-1" />
                      Renovar Plano
                    </Button>
                  </div>
                </div>
              )}

              <Button
                onClick={handleBook}
                disabled={isSubmitting || !clientName.trim() || !clientPhone.trim()}
                className="w-full mt-4 bg-primary text-primary-foreground font-semibold"
              >
                {isSubmitting ? "AGENDANDO..." : "AGENDAR"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookingModal;
const defaultBusinessHours: BusinessHours[] = [
  { day_of_week: 0, is_open: false, open_time: "09:00", close_time: "18:00" },
  { day_of_week: 1, is_open: true, open_time: "08:00", close_time: "19:00" },
  { day_of_week: 2, is_open: true, open_time: "08:00", close_time: "19:00" },
  { day_of_week: 3, is_open: true, open_time: "08:00", close_time: "19:00" },
  { day_of_week: 4, is_open: true, open_time: "08:00", close_time: "19:00" },
  { day_of_week: 5, is_open: true, open_time: "08:00", close_time: "19:00" },
  { day_of_week: 6, is_open: true, open_time: "08:00", close_time: "17:00" },
];
