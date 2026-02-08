import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verify admin session token from database
async function verifyAdminSession(supabase: any, token: string): Promise<{ valid: boolean; adminId?: string }> {
  if (!token) {
    return { valid: false };
  }

  const { data: session, error } = await supabase
    .from("admin_sessions")
    .select("admin_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !session) {
    console.log("Session not found or error:", error);
    return { valid: false };
  }

  // Check if session is expired
  if (new Date(session.expires_at) < new Date()) {
    console.log("Session expired");
    return { valid: false };
  }

  return { valid: true, adminId: session.admin_id };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get admin session token from Authorization header
    const authHeader = req.headers.get('Authorization');
    const sessionToken = authHeader?.replace('Bearer ', '');

    // Verify admin session
    const { valid, adminId } = await verifyAdminSession(supabase, sessionToken || '');
    if (!valid) {
      console.log("Invalid or expired admin session");
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada. Faça login novamente.", unauthorized: true }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Admin session verified for admin:", adminId);

    const { action, ...params } = await req.json();

    switch (action) {
      case 'list': {
        // List appointments for a specific date
        const { date, professional_id } = params;
        
        let query = supabase
          .from("appointments")
          .select(`
            id,
            client_name,
            client_phone,
            appointment_date,
            appointment_time,
            status,
            professional_id,
            service_id,
            notes,
            services(id, name, price, duration_minutes),
            professionals(id, name)
          `)
          .neq("status", "cancelled");

        if (date) {
          query = query.eq("appointment_date", date);
        }

        if (professional_id) {
          query = query.eq("professional_id", professional_id);
        }

        query = query.order("appointment_date", { ascending: false })
                     .order("appointment_time", { ascending: true });

        const { data, error } = await query;

        if (error) {
          console.error("Database error:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao buscar agendamentos" }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Found ${data?.length || 0} appointments`);

        return new Response(
          JSON.stringify({ appointments: data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        // Update an appointment
        const { id, updates } = params;

        if (!id) {
          return new Response(
            JSON.stringify({ error: "ID do agendamento é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Only allow specific fields to be updated
        const allowedFields = ['status', 'service_id', 'notes', 'professional_id', 'appointment_date', 'appointment_time'];
        const sanitizedUpdates: Record<string, any> = {};
        
        for (const field of allowedFields) {
          if (updates[field] !== undefined) {
            sanitizedUpdates[field] = updates[field];
          }
        }

        if (Object.keys(sanitizedUpdates).length === 0) {
          return new Response(
            JSON.stringify({ error: "Nenhum campo válido para atualizar" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from("appointments")
          .update(sanitizedUpdates)
          .eq("id", id)
          .select()
          .single();

        if (error) {
          console.error("Update error:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao atualizar agendamento" }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log("Appointment updated:", id);

        return new Response(
          JSON.stringify({ success: true, appointment: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create': {
        // Create a new appointment
        const { 
          client_name, 
          client_phone, 
          appointment_date, 
          appointment_time, 
          service_id, 
          professional_id,
          notes 
        } = params;

        // Validate required fields
        if (!client_name || !client_phone || !appointment_date || !appointment_time || !service_id) {
          return new Response(
            JSON.stringify({ error: "Campos obrigatórios: client_name, client_phone, appointment_date, appointment_time, service_id" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabase
          .from("appointments")
          .insert({
            client_name,
            client_phone,
            appointment_date,
            appointment_time,
            service_id,
            professional_id: professional_id || null,
            notes: notes || null,
            status: 'scheduled'
          })
          .select()
          .single();

        if (error) {
          console.error("Create error:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao criar agendamento" }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log("Appointment created:", data.id);

        return new Response(
          JSON.stringify({ success: true, appointment: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        // Delete (cancel) an appointment
        const { id } = params;

        if (!id) {
          return new Response(
            JSON.stringify({ error: "ID do agendamento é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from("appointments")
          .update({ status: 'cancelled' })
          .eq("id", id);

        if (error) {
          console.error("Delete error:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao cancelar agendamento" }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log("Appointment cancelled:", id);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'dashboard': {
        // Get dashboard stats
        const today = new Date().toISOString().split('T')[0];
        const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Get appointments for today and next 7 days
        const { data: appointments, error } = await supabase
          .from("appointments")
          .select(`
            id,
            client_name,
            client_phone,
            appointment_date,
            appointment_time,
            status,
            professional_id,
            service_id,
            services(id, name, price, duration_minutes),
            professionals(id, name)
          `)
          .gte("appointment_date", today)
          .lte("appointment_date", next7Days)
          .neq("status", "cancelled")
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true });

        if (error) {
          console.error("Dashboard query error:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao buscar dados do dashboard" }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Calculate stats
        const todayAppointments = appointments?.filter((a: any) => a.appointment_date === today) || [];
        const totalRevenue = appointments?.reduce((sum: number, a: any) => {
          const service = Array.isArray(a.services) ? a.services[0] : a.services;
          return sum + (service?.price || 0);
        }, 0) || 0;

        return new Response(
          JSON.stringify({ 
            appointments: appointments || [],
            stats: {
              todayCount: todayAppointments.length,
              next7DaysCount: appointments?.length || 0,
              totalRevenue
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list-range': {
        // List appointments for a date range (for reports)
        const { start_date, end_date } = params;

        if (!start_date || !end_date) {
          return new Response(
            JSON.stringify({ error: "start_date e end_date são obrigatórios" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: rangeData, error: rangeError } = await supabase
          .from("appointments")
          .select(`
            id,
            client_name,
            client_phone,
            appointment_date,
            appointment_time,
            status,
            professional_id,
            service_id,
            services(id, name, price, duration_minutes),
            professionals(id, name)
          `)
          .gte("appointment_date", start_date)
          .lte("appointment_date", end_date)
          .order("appointment_date", { ascending: true })
          .order("appointment_time", { ascending: true });

        if (rangeError) {
          console.error("List-range query error:", rangeError);
          return new Response(
            JSON.stringify({ error: "Erro ao buscar agendamentos do período" }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Found ${rangeData?.length || 0} appointments in range ${start_date} to ${end_date}`);

        return new Response(
          JSON.stringify({ appointments: rangeData || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error("Error in admin-appointments function:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
