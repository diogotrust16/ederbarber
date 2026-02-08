import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validate admin session from Authorization header
async function validateAdminSession(req: Request, supabaseUrl: string, supabaseServiceKey: string) {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false as const, error: "Token de autenticação não fornecido" };
  }
  
  const token = authHeader.substring(7);
  
  if (!token) {
    return { valid: false as const, error: "Token de autenticação inválido" };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: session, error } = await supabase
    .from("admin_sessions")
    .select("admin_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  
  if (error) {
    console.error("Session validation error:", error);
    return { valid: false as const, error: "Erro ao validar sessão" };
  }
  
  if (!session) {
    return { valid: false as const, error: "Sessão inválida" };
  }

  const expiresAt = (session as { admin_id: string; expires_at: string }).expires_at;
  const adminId = (session as { admin_id: string; expires_at: string }).admin_id;
  
  if (new Date(expiresAt) < new Date()) {
    // Clean up expired session
    await supabase.from("admin_sessions").delete().eq("token", token);
    return { valid: false as const, error: "Sessão expirada" };
  }
  
  return { valid: true as const, adminId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate admin session before processing any action
    const authResult = await validateAdminSession(req, supabaseUrl, supabaseServiceKey);
    
    if (!authResult.valid) {
      console.log("Unauthorized access attempt:", authResult.error);
      return new Response(
        JSON.stringify({ success: false, error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Admin session validated for admin_id:", authResult.adminId);

    // Handle GET requests for listing (no body needed)
    let action = "list";
    let service = null;
    
    if (req.method === "GET") {
      action = "list";
    } else {
      try {
        const body = await req.json();
        action = body.action || "list";
        service = body.service;
      } catch {
        // If body is empty or invalid, default to list
        action = "list";
      }
    }
    console.log("Admin services action:", action);

    switch (action) {
      case "list": {
        const { data, error } = await supabase
          .from("services")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, services: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create": {
        const { data, error } = await supabase
          .from("services")
          .insert({
            name: service.name,
            description: service.description,
            price: service.price,
            duration_minutes: service.duration_minutes,
            is_active: true,
            is_subscription: service.is_subscription || false,
          })
          .select()
          .single();

        if (error) throw error;
        console.log("Service created:", data.name);
        return new Response(
          JSON.stringify({ success: true, service: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update": {
        const { data, error } = await supabase
          .from("services")
          .update({
            name: service.name,
            description: service.description,
            price: service.price,
            duration_minutes: service.duration_minutes,
            is_subscription: service.is_subscription,
          })
          .eq("id", service.id)
          .select()
          .single();

        if (error) throw error;
        console.log("Service updated:", data.name);
        return new Response(
          JSON.stringify({ success: true, service: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "toggle": {
        const { data: current } = await supabase
          .from("services")
          .select("is_active")
          .eq("id", service.id)
          .single();

        const { data, error } = await supabase
          .from("services")
          .update({ is_active: !current?.is_active })
          .eq("id", service.id)
          .select()
          .single();

        if (error) throw error;
        console.log("Service toggled:", data.name, "active:", data.is_active);
        return new Response(
          JSON.stringify({ success: true, service: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        const { error } = await supabase
          .from("services")
          .delete()
          .eq("id", service.id);

        if (error) throw error;
        console.log("Service deleted:", service.id);
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error in admin-services:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
