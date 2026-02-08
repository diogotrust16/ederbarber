import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { service_id, client_name, client_phone } = body;

    if (!service_id || !client_name || !client_phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Dados obrigatórios não fornecidos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Request data", { service_id, client_name, client_phone });

    // Fetch service details
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, name, price, duration_minutes, description, is_subscription, is_active")
      .eq("id", service_id)
      .single();

    if (serviceError || !service) {
      logStep("Service not found", { serviceError });
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

    // Check if client already has an active subscription
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

    logStep("Creating Stripe checkout session", { serviceName: service.name, price: service.price });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Convert price to cents (BRL)
    const priceInCents = Math.round(service.price * 100);

    const origin = req.headers.get("origin") || "https://barber-boutique-co.lovable.app";

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: service.name,
              description: service.description || `Plano mensal - ${service.name}`,
            },
            unit_amount: priceInCents,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/checkout-sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/planos`,
      metadata: {
        service_id: service.id,
        client_name: client_name,
        client_phone: client_phone,
      },
      subscription_data: {
        metadata: {
          service_id: service.id,
          client_name: client_name,
          client_phone: client_phone,
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(
      JSON.stringify({ success: true, url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
