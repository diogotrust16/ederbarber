import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    
    // Try to verify signature if webhook secret is available
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    let event: Stripe.Event;

    if (webhookSecret) {
      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        logStep("Missing stripe-signature header");
        return new Response("Missing signature", { status: 400 });
      }
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      } catch (err) {
        logStep("Signature verification failed", { error: String(err) });
        return new Response("Invalid signature", { status: 400 });
      }
    } else {
      // Parse without verification (for development)
      event = JSON.parse(body) as Stripe.Event;
      logStep("No webhook secret configured, parsing event without verification");
    }

    logStep("Event type", { type: event.type });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;

      if (!metadata?.service_id || !metadata?.client_name || !metadata?.client_phone) {
        logStep("Missing metadata in session", { metadata });
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      logStep("Processing subscription", {
        serviceId: metadata.service_id,
        clientName: metadata.client_name,
        clientPhone: metadata.client_phone,
        stripeSubscriptionId: session.subscription,
      });

      // Check for existing active subscription
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("client_phone", metadata.client_phone)
        .eq("service_id", metadata.service_id)
        .eq("status", "active")
        .single();

      if (existing) {
        logStep("Subscription already exists", { existingId: existing.id });
        return new Response(JSON.stringify({ received: true, existing: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create subscription record
      const { data: subscription, error: createError } = await supabase
        .from("subscriptions")
        .insert({
          service_id: metadata.service_id,
          client_name: metadata.client_name,
          client_phone: metadata.client_phone,
          status: "active",
          start_date: new Date().toISOString().split("T")[0],
          notes: `Stripe subscription: ${session.subscription || "N/A"}`,
        })
        .select()
        .single();

      if (createError) {
        logStep("Error creating subscription", { error: createError });
        return new Response(JSON.stringify({ error: "Failed to create subscription" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      logStep("Subscription created successfully", { subscriptionId: subscription.id });
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const metadata = subscription.metadata;

      if (metadata?.client_phone && metadata?.service_id) {
        logStep("Cancelling subscription", { clientPhone: metadata.client_phone, serviceId: metadata.service_id });

        const { error } = await supabase
          .from("subscriptions")
          .update({ status: "cancelled", end_date: new Date().toISOString().split("T")[0] })
          .eq("client_phone", metadata.client_phone)
          .eq("service_id", metadata.service_id)
          .eq("status", "active");

        if (error) {
          logStep("Error cancelling subscription", { error });
        } else {
          logStep("Subscription cancelled successfully");
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
