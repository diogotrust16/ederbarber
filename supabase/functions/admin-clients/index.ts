import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Validate admin session token
async function validateAdminSession(
  supabaseAdmin: any,
  authHeader: string | null
): Promise<{ valid: boolean; adminId?: string; error?: string }> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Token não fornecido" };
  }

  const token = authHeader.replace("Bearer ", "");

  const { data: session, error } = await supabaseAdmin
    .from("admin_sessions")
    .select("admin_id, expires_at")
    .eq("token", token)
    .single();

  if (error || !session) {
    console.error("Session validation error:", error);
    return { valid: false, error: "Sessão inválida" };
  }

  const sessionData = session as { admin_id: string; expires_at: string };

  if (new Date(sessionData.expires_at) < new Date()) {
    return { valid: false, error: "Sessão expirada" };
  }

  return { valid: true, adminId: sessionData.admin_id };
}

interface ClientData {
  id: string;
  name: string;
  phone: string;
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  total_spent: number;
  last_appointment_date: string | null;
  first_appointment_date: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Validate admin session
    const authHeader = req.headers.get("Authorization");
    const validation = await validateAdminSession(supabaseAdmin, authHeader);

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { action, search, page = 1, limit = 20 } = body;

    console.log("Admin clients action:", action);

    if (action === "list") {
      // Get all appointments with service info
      const { data: appointments, error: appointmentsError } = await supabaseAdmin
        .from("appointments")
        .select(`
          id,
          client_name,
          client_phone,
          appointment_date,
          status,
          service_id,
          services:service_id (
            price
          )
        `)
        .order("appointment_date", { ascending: false });

      if (appointmentsError) {
        console.error("Error fetching appointments:", appointmentsError);
        throw appointmentsError;
      }

      // Aggregate clients by phone number
      const clientsMap = new Map<string, ClientData>();

      for (const apt of appointments || []) {
        const phone = apt.client_phone || "";
        const name = apt.client_name || "Cliente";
        
        if (!phone) continue;

        if (!clientsMap.has(phone)) {
          clientsMap.set(phone, {
            id: phone, // Using phone as unique identifier
            name: name,
            phone: phone,
            total_appointments: 0,
            completed_appointments: 0,
            cancelled_appointments: 0,
            total_spent: 0,
            last_appointment_date: null,
            first_appointment_date: apt.appointment_date,
          });
        }

        const client = clientsMap.get(phone)!;
        client.total_appointments++;

        // Update name if this is more recent
        if (!client.last_appointment_date || apt.appointment_date > client.last_appointment_date) {
          client.name = name;
          client.last_appointment_date = apt.appointment_date;
        }

        // Track earliest appointment
        if (apt.appointment_date < client.first_appointment_date) {
          client.first_appointment_date = apt.appointment_date;
        }

        if (apt.status === "completed") {
          client.completed_appointments++;
          const price = (apt.services as any)?.price || 0;
          client.total_spent += Number(price);
        } else if (apt.status === "cancelled") {
          client.cancelled_appointments++;
        }
      }

      let clients = Array.from(clientsMap.values());

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        clients = clients.filter(
          (c) =>
            c.name.toLowerCase().includes(searchLower) ||
            c.phone.includes(search)
        );
      }

      // Sort by total appointments (most active first)
      clients.sort((a, b) => b.total_appointments - a.total_appointments);

      // Pagination
      const total = clients.length;
      const offset = (page - 1) * limit;
      const paginatedClients = clients.slice(offset, offset + limit);

      return new Response(
        JSON.stringify({
          success: true,
          clients: paginatedClients,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "get") {
      const { phone } = body;

      if (!phone) {
        return new Response(
          JSON.stringify({ success: false, error: "Telefone não fornecido" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get all appointments for this client
      const { data: appointments, error } = await supabaseAdmin
        .from("appointments")
        .select(`
          id,
          client_name,
          appointment_date,
          appointment_time,
          status,
          services:service_id (
            name,
            price
          ),
          professionals:professional_id (
            name
          )
        `)
        .eq("client_phone", phone)
        .order("appointment_date", { ascending: false });

      if (error) {
        console.error("Error fetching client appointments:", error);
        throw error;
      }

      return new Response(
        JSON.stringify({
          success: true,
          appointments: appointments || [],
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ação inválida" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Admin clients error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
