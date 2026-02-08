import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ADMIN-STRIPE-STATUS] ${step}${detailsStr}`);
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

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ success: false, error: "STRIPE_SECRET_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const url = new URL(req.url);

    // GET with stripe_subscription_id param - single subscription status
    if (req.method === "GET") {
      const stripeSubId = url.searchParams.get("stripe_subscription_id");

      if (stripeSubId) {
        logStep("Fetching single Stripe subscription", { stripeSubId });
        try {
          const sub = await stripe.subscriptions.retrieve(stripeSubId);
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                id: sub.id,
                status: sub.status,
                current_period_start: sub.current_period_start,
                current_period_end: sub.current_period_end,
                cancel_at_period_end: sub.cancel_at_period_end,
                canceled_at: sub.canceled_at,
                latest_invoice: sub.latest_invoice,
              },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (err) {
          logStep("Error fetching Stripe subscription", { error: String(err) });
          return new Response(
            JSON.stringify({ success: false, error: "Assinatura Stripe não encontrada" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // POST with array of stripe_subscription_ids - batch status
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { stripe_subscription_ids } = body;

      if (!Array.isArray(stripe_subscription_ids) || stripe_subscription_ids.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "IDs não fornecidos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      logStep("Fetching batch Stripe subscriptions", { count: stripe_subscription_ids.length });

      const results: Record<string, unknown> = {};

      // Process in parallel (max 10 at a time)
      const ids = stripe_subscription_ids.slice(0, 20);
      const promises = ids.map(async (subId: string) => {
        try {
          const sub = await stripe.subscriptions.retrieve(subId);
          results[subId] = {
            status: sub.status,
            current_period_end: sub.current_period_end,
            cancel_at_period_end: sub.cancel_at_period_end,
            latest_invoice: sub.latest_invoice,
          };
        } catch {
          results[subId] = { status: "not_found", error: true };
        }
      });

      await Promise.all(promises);

      logStep("Batch results", { found: Object.keys(results).length });

      return new Response(
        JSON.stringify({ success: true, data: results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Método não suportado" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
