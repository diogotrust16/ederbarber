import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate admin session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Token não fornecido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: session } = await supabase
      .from("admin_sessions")
      .select("id, expires_at")
      .eq("token", token)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!session) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const method = req.method;
    const url = new URL(req.url);

    // GET - List subscriptions
    if (method === "GET") {
      const status = url.searchParams.get("status");
      const serviceId = url.searchParams.get("service_id");
      
      let query = supabase
        .from("subscriptions")
        .select(`
          *,
          service:services(id, name, price, duration_minutes)
        `)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }
      if (serviceId) {
        query = query.eq("service_id", serviceId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching subscriptions:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao buscar assinaturas" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST - Create subscription
    if (method === "POST") {
      const body = await req.json();
      const { service_id, client_name, client_phone, start_date, end_date, notes, status } = body;

      if (!service_id || !client_name || !client_phone) {
        return new Response(
          JSON.stringify({ success: false, error: "Dados obrigatórios não fornecidos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .insert({
          service_id,
          client_name,
          client_phone,
          start_date: start_date || new Date().toISOString().split("T")[0],
          end_date,
          notes,
          status: status || "active",
        })
        .select(`
          *,
          service:services(id, name, price, duration_minutes)
        `)
        .single();

      if (error) {
        console.error("Error creating subscription:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao criar assinatura" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PUT - Update subscription
    if (method === "PUT") {
      const body = await req.json();
      const { id, ...updateData } = body;

      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: "ID não fornecido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("subscriptions")
        .update(updateData)
        .eq("id", id)
        .select(`
          *,
          service:services(id, name, price, duration_minutes)
        `)
        .single();

      if (error) {
        console.error("Error updating subscription:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao atualizar assinatura" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE - Remove subscription
    if (method === "DELETE") {
      const id = url.searchParams.get("id");

      if (!id) {
        return new Response(
          JSON.stringify({ success: false, error: "ID não fornecido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("subscriptions")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting subscription:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao excluir assinatura" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Método não suportado" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
