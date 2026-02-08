import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Eye, CalendarX, X, Ban, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminSidebar from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useProfessionals, Professional } from "@/hooks/useProfessionals";
import { useAdminSession } from "@/hooks/useAdminSession";
import { useSwipe } from "@/hooks/useSwipe";
import AppointmentDetailModal from "@/components/admin/AppointmentDetailModal";
import CreateAppointmentModal from "@/components/admin/CreateAppointmentModal";

interface Appointment {
  id: string;
  client_name: string;
  client_phone: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  professional_id: string | null;
  service_id: string;
  service: {
    name: string;
    price: number;
    duration_minutes: number;
  } | null;
}

interface BlockedTime {
  professional_id: string;
  start_time: string;
  end_time: string;
  reason?: string;
}

interface BusinessHour {
  day_of_week: number;
  is_open: boolean;
  open_time?: string | null;
  close_time?: string | null;
}

// Default time slots (fallback) from 08:00 to 21:00 with 15min intervals
const generateDefaultTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 8; hour <= 21; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      if (hour === 21 && minute > 0) break;
      slots.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
    }
  }
  return slots;
};

const DEFAULT_TIME_SLOTS = generateDefaultTimeSlots();

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const generateTimeSlotsForRange = (openTime: string, closeTime: string) => {
  const slots: string[] = [];
  let current = toMinutes(openTime);
  const end = toMinutes(closeTime);

  // include slots while start time is before closing time
  while (current < end) {
    const hours = Math.floor(current / 60)
      .toString()
      .padStart(2, "0");
    const minutes = (current % 60).toString().padStart(2, "0");
    slots.push(`${hours}:${minutes}`);
    current += 15;
  }
  return slots;
};

const AdminAgenda = () => {
  const navigate = useNavigate();
  const { isAuthenticated, logout, invokeAdminFunction } = useAdminSession();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [subscriberPhones, setSubscriberPhones] = useState<Set<string>>(new Set());
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [businessHoursLoading, setBusinessHoursLoading] = useState(true);

  const { data: professionals = [] } = useProfessionals();

  // Check admin session
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/admin/login");
    }
  }, [navigate, isAuthenticated]);

  // Set first professional as selected when loaded
  useEffect(() => {
    if (professionals.length > 0 && !selectedProfessional) {
      setSelectedProfessional(professionals[0]);
    }
  }, [professionals, selectedProfessional]);

  // Check which appointment clients are subscribers
  const checkSubscriberPhones = useCallback(async (appts: Appointment[]) => {
    const phones = [...new Set(appts.map(a => a.client_phone).filter(Boolean))];
    if (phones.length === 0) {
      setSubscriberPhones(new Set());
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('client-subscriptions', {
        body: { action: "check-phones-batch", phones }
      });

      // Handle case where data might be a string instead of parsed JSON
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      
      console.log("[AdminAgenda] check-phones-batch response:", { parsed, error, rawType: typeof data });
      
      if (!error && parsed?.success && parsed.subscriber_phones) {
        console.log("[AdminAgenda] Subscriber phones set:", parsed.subscriber_phones);
        setSubscriberPhones(new Set(parsed.subscriber_phones));
      } else {
        console.log("[AdminAgenda] No subscriber data:", { error, parsed });
        setSubscriberPhones(new Set());
      }
    } catch (err) {
      console.error("Error checking subscriber phones:", err);
    }
  }, []);

  // Fetch appointments and blocked times for selected date
  useEffect(() => {
    const fetchDataForDate = async () => {
      setLoading(true);
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      try {
        // Fetch appointments
        const appointmentsRes = await invokeAdminFunction("admin-appointments", {
          action: "list",
          date: dateStr,
        });

        const list = (appointmentsRes?.appointments || []) as any[];
        const mappedAppointments = list.map((item: any) => ({
          id: item.id,
          client_name: item.client_name,
          client_phone: item.client_phone,
          appointment_date: item.appointment_date,
          appointment_time: item.appointment_time,
          status: item.status,
          professional_id: item.professional_id,
          service_id: item.service_id,
          service: item.services || null,
        }));
        setAppointments(mappedAppointments);

        // Check subscribers
        checkSubscriberPhones(mappedAppointments);

        // Fetch blocked times
        const blockedRes = await invokeAdminFunction("admin-blocked-times", {
          action: "list",
          date: dateStr,
        });

        setBlockedTimes(blockedRes?.blockedTimes || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        setAppointments([]);
        setBlockedTimes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDataForDate();
  }, [selectedDate, invokeAdminFunction, checkSubscriberPhones]);

  // Load business hours so agenda respects operating times
  useEffect(() => {
    const loadBusinessHours = async () => {
      try {
        const response = await invokeAdminFunction("admin-business-hours", { action: "list" });
        if (response?.success && Array.isArray(response.data)) {
          setBusinessHours(response.data as BusinessHour[]);
        }
      } catch (error) {
        console.error("Error fetching business hours:", error);
      } finally {
        setBusinessHoursLoading(false);
      }
    };

    loadBusinessHours();
  }, [invokeAdminFunction]);

  // Real-time subscription for appointments
  useEffect(() => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    const channel = supabase
      .channel(`appointments-${dateStr}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `appointment_date=eq.${dateStr}`,
        },
        (payload) => {
          console.log("Realtime update:", payload);

          if (payload.eventType === "INSERT") {
            // Refetch to get full service data
            fetchData();
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as any;
            if (updated.status === "cancelled") {
              setAppointments((prev) => prev.filter((a) => a.id !== updated.id));
            } else {
              // Refetch to get updated data with service info
              fetchData();
            }
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as any;
            setAppointments((prev) => prev.filter((a) => a.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      const appointmentsRes = await invokeAdminFunction("admin-appointments", {
        action: "list",
        date: dateStr,
      });

      const list = (appointmentsRes?.appointments || []) as any[];
      const mappedAppointments = list.map((item: any) => ({
        id: item.id,
        client_name: item.client_name,
        client_phone: item.client_phone,
        appointment_date: item.appointment_date,
        appointment_time: item.appointment_time,
        status: item.status,
        professional_id: item.professional_id,
        service_id: item.service_id,
        service: item.services || null,
      }));
      setAppointments(mappedAppointments);
      
      // Check subscribers
      checkSubscriberPhones(mappedAppointments);

      const blockedRes = await invokeAdminFunction("admin-blocked-times", {
        action: "list",
        date: dateStr,
      });
      setBlockedTimes(blockedRes?.blockedTimes || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      setAppointments([]);
      setBlockedTimes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handlePrevDay = () => setSelectedDate(subDays(selectedDate, 1));
  const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));

  // Swipe handlers for professional navigation
  const handleNextProfessional = () => {
    if (!selectedProfessional || professionals.length <= 1 || isTransitioning) return;
    const currentIndex = professionals.findIndex(p => p.id === selectedProfessional.id);
    const nextIndex = (currentIndex + 1) % professionals.length;
    setIsTransitioning(true);
    setSwipeDirection("left");
    setSelectedProfessional(professionals[nextIndex]);
    setTimeout(() => {
      setSwipeDirection(null);
      setIsTransitioning(false);
    }, 300);
  };

  const handlePrevProfessional = () => {
    if (!selectedProfessional || professionals.length <= 1 || isTransitioning) return;
    const currentIndex = professionals.findIndex(p => p.id === selectedProfessional.id);
    const prevIndex = currentIndex === 0 ? professionals.length - 1 : currentIndex - 1;
    setIsTransitioning(true);
    setSwipeDirection("right");
    setSelectedProfessional(professionals[prevIndex]);
    setTimeout(() => {
      setSwipeDirection(null);
      setIsTransitioning(false);
    }, 300);
  };

  const professionalSwipeHandlers = useSwipe({
    onSwipeLeft: handleNextProfessional,
    onSwipeRight: handlePrevProfessional,
  });

  const getDayName = (date: Date) => {
    return format(date, "EEEE", { locale: ptBR });
  };

  // Get appointments for selected professional
  const professionalAppointments = appointments.filter(
    (a) => a.professional_id === selectedProfessional?.id
  );

  // Get blocked times for selected professional
  const professionalBlockedTimes = blockedTimes.filter(
    (b) => b.professional_id === selectedProfessional?.id
  );

  const daySchedule = useMemo(() => {
    const dow = selectedDate.getDay();
    return businessHours.find((bh) => bh.day_of_week === dow);
  }, [businessHours, selectedDate]);

  const timeSlotsForSelectedDay = useMemo(() => {
    if (!daySchedule) {
      // while loading, keep default slots; after loading and no schedule, stay safe with defaults
      return DEFAULT_TIME_SLOTS;
    }

    if (!daySchedule.is_open) {
      return [];
    }

    const open = daySchedule.open_time?.slice(0, 5) || "08:00";
    const close = daySchedule.close_time?.slice(0, 5) || "21:00";
    return generateTimeSlotsForRange(open, close);
  }, [daySchedule]);

  // Check if a time slot is blocked
  const isTimeBlocked = (time: string): BlockedTime | null => {
    const [slotHour, slotMin] = time.split(":").map(Number);
    const slotMinutes = slotHour * 60 + slotMin;

    for (const block of professionalBlockedTimes) {
      const [startHour, startMin] = block.start_time.slice(0, 5).split(":").map(Number);
      const [endHour, endMin] = block.end_time.slice(0, 5).split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
        return block;
      }
    }
    return null;
  };

  // Check if a time slot is occupied by an appointment
  const getAppointmentAtTime = (time: string) => {
    return professionalAppointments.find((a) => {
      const appointmentTime = a.appointment_time.slice(0, 5);
      if (appointmentTime === time) return true;

      // Check if this slot falls within the duration of an appointment
      if (a.service?.duration_minutes) {
        const [startHour, startMin] = appointmentTime.split(":").map(Number);
        const [slotHour, slotMin] = time.split(":").map(Number);
        const startMinutes = startHour * 60 + startMin;
        const slotMinutes = slotHour * 60 + slotMin;
        const endMinutes = startMinutes + a.service.duration_minutes;

        if (slotMinutes > startMinutes && slotMinutes < endMinutes) {
          return true;
        }
      }
      return false;
    });
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsModalOpen(true);
  };

  const handleEmptySlotClick = (time: string) => {
    setSelectedTimeSlot(time);
    setIsCreateModalOpen(true);
  };

  const handleStatusChange = () => {
    fetchData();
  };

  const handleAppointmentStatusUpdated = (
    appointmentId: string,
    nextStatus: "cancelled" | "completed"
  ) => {
    setAppointments((prev) => {
      if (nextStatus === "cancelled") {
        return prev.filter((a) => a.id !== appointmentId);
      }
      return prev.map((a) => (a.id === appointmentId ? { ...a, status: nextStatus } : a));
    });

    setSelectedAppointment((prev) => {
      if (!prev || prev.id !== appointmentId) return prev;
      if (nextStatus === "cancelled") return null;
      return { ...prev, status: nextStatus };
    });
  };

  const handleAppointmentCreated = () => {
    fetchData();
  };

  return (
    <div className="min-h-screen bg-[#0a1628] flex">
      <AdminSidebar onLogout={handleLogout} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Date Navigation */}
        <div className="flex items-center justify-center gap-4 px-4 py-3 bg-[#1a2d4a]">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevDay}
            className="text-white hover:bg-[#2a3d5a]"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <div className="text-center min-w-[180px]">
            <p className="text-white font-medium">
              {format(selectedDate, "dd 'de' MMM. 'de' yyyy", { locale: ptBR })}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextDay}
            className="text-white hover:bg-[#2a3d5a]"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        {/* Professionals Row */}
        <div className="flex items-center justify-center gap-3 px-4 py-4 overflow-x-auto bg-[#0a1628]">
          {professionals.map((prof) => (
            <button
              key={prof.id}
              onClick={() => setSelectedProfessional(prof)}
              className={cn(
                "relative flex-shrink-0 transition-transform",
                selectedProfessional?.id === prof.id ? "scale-110" : "opacity-70"
              )}
            >
              <Avatar className="h-14 w-14 border-2 border-[#2a3d5a]">
                <AvatarImage src={prof.avatar_url || undefined} alt={prof.name} />
                <AvatarFallback className="bg-[#1a2d4a] text-white">
                  {prof.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          ))}
        </div>

        {/* Selected Professional Info - Swipeable */}
        {selectedProfessional && (
          <div 
            key={selectedProfessional.id}
            className={cn(
              "flex items-center gap-4 px-4 py-3 bg-[#2a3d5a]",
              swipeDirection === "left" && "animate-slide-in-left",
              swipeDirection === "right" && "animate-slide-in-right"
            )}
            onTouchStart={professionalSwipeHandlers.onTouchStart}
            onTouchEnd={professionalSwipeHandlers.onTouchEnd}
          >
            <div className="relative">
              <Avatar className="h-16 w-16 border-2 border-[#00d9a5]">
                <AvatarImage
                  src={selectedProfessional.avatar_url || undefined}
                  alt={selectedProfessional.name}
                />
                <AvatarFallback className="bg-[#1a2d4a] text-white text-lg">
                  {selectedProfessional.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <button className="absolute -top-1 -left-1 bg-red-500 rounded-full p-0.5">
                <X className="h-3 w-3 text-white" />
              </button>
            </div>

            <div className="flex-1">
              <h3 className="text-white font-semibold text-lg">
                {selectedProfessional.name}
              </h3>
              <p className="text-[#00d9a5]/70 text-sm capitalize">
                {getDayName(selectedDate)}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-[#1a2d4a]"
              >
                <Eye className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-[#1a2d4a]"
              >
                <CalendarX className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Time Slots Grid */}
        <div 
          className={cn(
            "flex-1 overflow-y-auto bg-[#2a3d5a] transition-opacity duration-200",
            isTransitioning && "opacity-50"
          )}
          onTouchStart={professionalSwipeHandlers.onTouchStart}
          onTouchEnd={professionalSwipeHandlers.onTouchEnd}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-[#00d9a5]">Carregando...</div>
            </div>
          ) : businessHoursLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-[#00d9a5]">Carregando horários...</div>
            </div>
          ) : daySchedule && !daySchedule.is_open ? (
            <div className="flex items-center justify-center h-full px-4 text-center">
              <div className="text-white/80">
                Estabelecimento fechado neste dia conforme os horários de funcionamento.
              </div>
            </div>
          ) : isTransitioning ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-pulse text-[#00d9a5] text-sm">Trocando profissional...</div>
            </div>
          ) : timeSlotsForSelectedDay.length === 0 ? (
            <div className="flex items-center justify-center h-full px-4 text-center">
              <div className="text-white/80">
                Nenhum horário configurado para este dia.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#3a4d6a]/50">
              {timeSlotsForSelectedDay.map((time) => {
                const appointment = getAppointmentAtTime(time);
                const blockedTime = isTimeBlocked(time);
                const isBlocked = !!blockedTime;
                const isOccupied = !!appointment;
                const isStart = appointment?.appointment_time.slice(0, 5) === time;
                const isCompleted = appointment?.status === "completed";
                
                // Check if this appointment's client is a subscriber
                const isSubscriber = appointment?.client_phone
                  ? subscriberPhones.has(appointment.client_phone.replace(/\D/g, ""))
                  : false;

                // Determine if this is the start of a blocked range
                const isBlockStart = isBlocked && (() => {
                  const [blockStartHour, blockStartMin] = blockedTime.start_time.slice(0, 5).split(":").map(Number);
                  const [slotHour, slotMin] = time.split(":").map(Number);
                  return blockStartHour === slotHour && blockStartMin === slotMin;
                })();

                return (
                  <div
                    key={time}
                    onClick={() => {
                      if (isBlocked) return;
                      if (isStart && appointment) {
                        handleAppointmentClick(appointment);
                      } else if (!isOccupied) {
                        handleEmptySlotClick(time);
                      }
                    }}
                    className={cn(
                      "flex items-center px-4 py-3 transition-colors",
                      isBlocked
                        ? "bg-red-500/20 cursor-not-allowed"
                        : isOccupied
                          ? isCompleted
                            ? "bg-blue-500/30 hover:bg-blue-500/50 cursor-pointer"
                            : isSubscriber
                              ? "bg-emerald-500/25 hover:bg-emerald-500/40 cursor-pointer border-l-4 border-emerald-400"
                              : "bg-gray-500/30 hover:bg-gray-500/50 cursor-pointer"
                          : "hover:bg-[#00d9a5]/20 cursor-pointer"
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-medium w-16",
                        isBlocked
                          ? "text-red-300"
                          : isOccupied 
                            ? isCompleted 
                              ? "text-blue-300"
                              : isSubscriber
                                ? "text-emerald-300"
                                : "text-gray-300" 
                            : "text-white/70"
                      )}
                    >
                      {time}
                    </span>

                    {isBlockStart && blockedTime && (
                      <div className="flex-1 ml-4 flex items-center gap-2">
                        <Ban className="h-4 w-4 text-red-400" />
                        <div>
                          <p className="text-red-300 font-medium text-sm">
                            Bloqueado
                          </p>
                          {blockedTime.reason && (
                            <p className="text-red-200/60 text-xs">
                              {blockedTime.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {!isBlocked && isStart && appointment && (
                      <div className="flex-1 ml-4 flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className={cn(
                              "font-medium text-sm",
                              isSubscriber ? "text-emerald-100" : "text-white"
                            )}>
                              {appointment.client_name}
                            </p>
                            {isSubscriber && (
                              <span className="inline-flex items-center gap-1 bg-emerald-500/30 text-emerald-300 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                                <Crown className="h-2.5 w-2.5" />
                                Assinante
                              </span>
                            )}
                          </div>
                          <p className={cn(
                            "text-xs",
                            isCompleted ? "text-blue-200/60" : isSubscriber ? "text-emerald-200/60" : "text-gray-300/60"
                          )}>
                            {appointment.service?.name}
                            {isCompleted && " • Finalizado"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Appointment Detail Modal */}
        <AppointmentDetailModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          appointment={selectedAppointment}
          onStatusChange={handleStatusChange}
          onAppointmentStatusUpdated={handleAppointmentStatusUpdated}
        />

        {/* Create Appointment Modal */}
        <CreateAppointmentModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          selectedDate={selectedDate}
          selectedTime={selectedTimeSlot}
          selectedProfessional={selectedProfessional}
          existingAppointments={professionalAppointments}
          onAppointmentCreated={handleAppointmentCreated}
        />
      </main>
    </div>
  );
};

export default AdminAgenda;
