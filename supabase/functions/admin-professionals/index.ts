import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function validateAdminSession(
  req: Request,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<{ valid: boolean; adminId?: string; error?: string }> {
  const authHeader = req.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Token não fornecido" };
  }

  const token = authHeader.replace("Bearer ", "");
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: session, error } = await supabase
    .from("admin_sessions")
    .select("admin_id, expires_at")
    .eq("token", token)
    .single();

  if (error || !session) {
    return { valid: false, error: "Sessão inválida" };
  }

  if (new Date(session.expires_at) < new Date()) {
    return { valid: false, error: "Sessão expirada" };
  }

  return { valid: true, adminId: session.admin_id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authResult = await validateAdminSession(req, supabaseUrl, supabaseServiceKey);
    
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, professional } = await req.json();

    switch (action) {
      case "list": {
        const { data, error } = await supabase
          .from("professionals")
          .select("*")
          .order("name");

        if (error) throw error;

        return new Response(
          JSON.stringify({ professionals: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create": {
        const { data, error } = await supabase
          .from("professionals")
          .insert({
            name: professional.name,
            avatar_url: professional.avatar_url || null,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ professional: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update": {
        const { data, error } = await supabase
          .from("professionals")
          .update({
            name: professional.name,
            avatar_url: professional.avatar_url || null,
          })
          .eq("id", professional.id)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ professional: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "toggle": {
        // First get current status
        const { data: current, error: fetchError } = await supabase
          .from("professionals")
          .select("is_active")
          .eq("id", professional.id)
          .single();

        if (fetchError) throw fetchError;

        // Toggle it
        const { data, error } = await supabase
          .from("professionals")
          .update({ is_active: !current.is_active })
          .eq("id", professional.id)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ professional: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        const { error } = await supabase
          .from("professionals")
          .delete()
          .eq("id", professional.id);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação não reconhecida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
