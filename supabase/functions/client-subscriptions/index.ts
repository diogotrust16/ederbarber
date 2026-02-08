import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const method = req.method;

    // GET - List client subscriptions (requires session_token in headers)
    if (method === "GET") {
      const sessionToken = req.headers.get("x-session-token");
      
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ success: false, error: "Token de sessão não fornecido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let clientPhone: string;
      try {
        clientPhone = atob(sessionToken);
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: "Token inválido" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: subscriptions, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          service:services(id, name, price, duration_minutes, description)
        `)
        .eq("client_phone", clientPhone)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching subscriptions:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao buscar assinaturas" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: subscriptions }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST - Check subscription by phone OR create subscription
    if (method === "POST") {
      const body = await req.json();

      // Action: check-by-phone - returns subscription status for a phone number
      if (body.action === "check-by-phone") {
        const { client_phone } = body;
        if (!client_phone) {
          return new Response(
            JSON.stringify({ success: false, error: "Telefone não fornecido" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Clean phone for matching (try both formatted and unformatted)
        const cleanPhone = client_phone.replace(/\D/g, "");
        const phonesToCheck = [...new Set([client_phone, cleanPhone])];

        const { data: subscriptions, error } = await supabase
          .from("subscriptions")
          .select(`
            id, status, start_date, end_date, service_id,
            service:services(id, name, price, duration_minutes, description, is_subscription)
          `)
          .in("client_phone", phonesToCheck)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error checking subscriptions:", error);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao verificar assinaturas" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const active = (subscriptions || []).filter((s: any) => s.status === "active");
        const expired = (subscriptions || []).filter((s: any) => 
          s.status === "cancelled" || s.status === "expired"
        );

        return new Response(
          JSON.stringify({
            success: true,
            has_active: active.length > 0,
            active_subscriptions: active,
            expired_subscriptions: expired,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Action: check-phones-batch - returns which phones have active subscriptions
      if (body.action === "check-phones-batch") {
        const { phones } = body;
        if (!Array.isArray(phones) || phones.length === 0) {
          return new Response(
            JSON.stringify({ success: false, error: "Telefones não fornecidos" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get all active subscriptions matching any of the phones
        const allPhones = phones.flatMap((p: string) => {
          const clean = p.replace(/\D/g, "");
          return [p, clean];
        });

        const { data: subscriptions, error } = await supabase
          .from("subscriptions")
          .select("client_phone, status")
          .in("client_phone", allPhones)
          .eq("status", "active");

        if (error) {
          console.error("Error checking batch subscriptions:", error);
          return new Response(
            JSON.stringify({ success: false, error: "Erro ao verificar assinaturas" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Build a set of subscriber phones (cleaned)
        const subscriberPhones = new Set(
          (subscriptions || []).map((s: any) => s.client_phone.replace(/\D/g, ""))
        );

        return new Response(
          JSON.stringify({
            success: true,
            subscriber_phones: Array.from(subscriberPhones),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Default POST: Create a new subscription
      const { service_id, client_name, client_phone } = body;

      if (!service_id || !client_name || !client_phone) {
        return new Response(
          JSON.stringify({ success: false, error: "Dados obrigatórios não fornecidos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: service, error: serviceError } = await supabase
        .from("services")
        .select("id, name, is_subscription, is_active")
        .eq("id", service_id)
        .single();

      if (serviceError || !service) {
        return new Response(
          JSON.stringify({ success: false, error: "Serviço não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!service.is_subscription || !service.is_active) {
        return new Response(
          JSON.stringify({ success: false, error: "Este serviço não está disponível para assinatura" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existing } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("client_phone", client_phone)
        .eq("service_id", service_id)
        .eq("status", "active")
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({ success: false, error: "Você já possui este plano ativo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: subscription, error: createError } = await supabase
        .from("subscriptions")
        .insert({
          service_id,
          client_name,
          client_phone,
          status: "active",
          start_date: new Date().toISOString().split("T")[0],
        })
        .select(`
          *,
          service:services(id, name, price, duration_minutes, description)
        `)
        .single();

      if (createError) {
        console.error("Error creating subscription:", createError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao criar assinatura" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: subscription }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
