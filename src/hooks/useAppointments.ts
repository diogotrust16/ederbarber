import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Appointment {
  id: string;
  user_id: string;
  service_id: string;
  appointment_date: string;
  appointment_time: string;
  status: "scheduled" | "completed" | "cancelled";
  notes: string | null;
  created_at: string;
  services?: {
    name: string;
    price: number;
    duration_minutes: number;
  };
}

export interface CreateAppointmentData {
  service_id: string;
  appointment_date: string;
  appointment_time: string;
  notes?: string;
}

export const useAppointments = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          services (
            name,
            price,
            duration_minutes
          )
        `)
        .eq("user_id", user.id)
        .order("appointment_date", { ascending: false });

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!user,
  });

  const createAppointment = useMutation({
    mutationFn: async (data: CreateAppointmentData) => {
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("appointments").insert({
        user_id: user.id,
        service_id: data.service_id,
        appointment_date: data.appointment_date,
        appointment_time: data.appointment_time,
        notes: data.notes,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  const cancelAppointment = useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  return {
    appointments: appointmentsQuery.data ?? [],
    isLoading: appointmentsQuery.isLoading,
    error: appointmentsQuery.error,
    createAppointment,
    cancelAppointment,
  };
};
