import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BlockedTime {
  id?: string;
  professional_id: string;
  block_type: "recurring" | "specific";
  day_of_week?: number | null;
  specific_date?: string | null;
  start_time: string;
  end_time: string;
  reason?: string | null;
  is_active?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ success: false, error: "Token não fornecido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: session, error: sessionError } = await supabase
      .from("admin_sessions")
      .select("admin_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (sessionError || !session) {
      console.log("Invalid session:", sessionError);
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(session.expires_at) < new Date()) {
      console.log("Session expired");
      return new Response(
        JSON.stringify({ success: false, error: "Sessão expirada" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, ...params } = body;

    console.log("Admin blocked-times action:", action, params);

    switch (action) {
      case "list": {
        const { professional_id, date } = params;
        
        // If date is provided, filter by that date (for agenda view)
        if (date) {
          // Get day of week for recurring blocks (0=Sunday, 1=Monday, etc.)
          const dateObj = new Date(date + "T00:00:00");
          const dayOfWeek = dateObj.getDay();

          let query = supabase
            .from("blocked_times")
            .select("professional_id, start_time, end_time, reason, block_type")
            .eq("is_active", true);

          // Build filter for specific date OR recurring day of week
          const { data, error } = await query.or(
            `specific_date.eq.${date},day_of_week.eq.${dayOfWeek}`
          );

          if (error) {
            console.error("Error listing blocked times for date:", error);
            return new Response(
              JSON.stringify({ success: false, error: "Erro ao listar bloqueios" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          return new Response(
            JSON.stringify({ success: true, blockedTimes: data }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Otherwise return all blocked times (for management view)
        let query = supabase
          .from("blocked_times")
          .select("*, professionals(name)")
          .order("created_at", { ascending: false });
        
        if (professional_id) {
          query = query.eq("professional_id", professional_id);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error listing blocked times:", error);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao listar bloqueios" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create": {
        const { professional_id, block_type, day_of_week, specific_date, start_time, end_time, reason } = params as BlockedTime;

        if (!professional_id || !block_type || !start_time || !end_time) {
          return new Response(
            JSON.stringify({ success: false, error: "Campos obrigatórios faltando" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (block_type === "recurring" && day_of_week === undefined) {
          return new Response(
            JSON.stringify({ success: false, error: "Dia da semana é obrigatório para bloqueios recorrentes" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (block_type === "specific" && !specific_date) {
          return new Response(
            JSON.stringify({ success: false, error: "Data é obrigatória para bloqueios específicos" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const insertData: BlockedTime = {
          professional_id,
          block_type,
          start_time,
          end_time,
          reason: reason || null,
          day_of_week: block_type === "recurring" ? day_of_week : null,
          specific_date: block_type === "specific" ? specific_date : null,
        };

        const { data, error } = await supabase
          .from("blocked_times")
          .insert(insertData)
          .select()
          .single();

        if (error) {
          console.error("Error creating blocked time:", error);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao criar bloqueio: " + error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("Blocked time created:", data.id);
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update": {
        const { id, ...updateFields } = params;

        if (!id) {
          return new Response(
            JSON.stringify({ success: false, error: "ID é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await supabase
          .from("blocked_times")
          .update(updateFields)
          .eq("id", id)
          .select()
          .single();

        if (error) {
          console.error("Error updating blocked time:", error);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao atualizar bloqueio" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("Blocked time updated:", id);
        return new Response(
          JSON.stringify({ success: true, data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        const { id } = params;

        if (!id) {
          return new Response(
            JSON.stringify({ success: false, error: "ID é obrigatório" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabase
          .from("blocked_times")
          .delete()
          .eq("id", id);

        if (error) {
          console.error("Error deleting blocked time:", error);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao excluir bloqueio" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log("Blocked time deleted:", id);
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Ação inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
