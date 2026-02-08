import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit: 20 requests per minute per IP
const RATE_LIMIT_MAX_ATTEMPTS = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/**
 * JWT Signing Key Management
 * 
 * Derives a signing key from service role key using HKDF-like derivation
 * to create a separate key for session tokens.
 */
const getSigningKey = async () => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not available');
  }
  
  // Derive a session-specific key by hashing service key with a salt
  const encoder = new TextEncoder();
  const baseKey = encoder.encode(serviceKey + '_SESSION_TOKEN_SALT_v1');
  
  // Hash to derive a separate key (not using service key directly)
  const hashBuffer = await crypto.subtle.digest('SHA-256', baseKey);
  
  return await crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting check
    const clientIP = getClientIP(req);
    const rateLimit = checkRateLimit(`get-appointments:${clientIP}`, RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS);
    
    if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for get-appointments from IP: ${clientIP}`);
      return rateLimitResponse(rateLimit.retryAfterSeconds, corsHeaders);
    }

    const { session_token } = await req.json();

    if (!session_token || typeof session_token !== 'string') {
      console.log("Missing or invalid session_token");
      return new Response(
        JSON.stringify({ error: "Sessão inválida. Faça login novamente.", unauthorized: true }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get signing key
    let key;
    try {
      key = await getSigningKey();
    } catch (keyError) {
      console.error("SESSION_SECRET not configured:", keyError);
      return new Response(
        JSON.stringify({ error: "Configuração de segurança incompleta. Contate o administrador.", unauthorized: true }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify and decode the JWT
    let payload;
    try {
      payload = await verify(session_token, key);
      console.log("Token verified for phone:", payload.phone);
    } catch (jwtError) {
      console.error("JWT verification failed:", jwtError);
      return new Response(
        JSON.stringify({ error: "Sessão expirada. Faça login novamente.", unauthorized: true }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientPhone = payload.phone as string;
    if (!clientPhone) {
      console.log("No phone in token payload");
      return new Response(
        JSON.stringify({ error: "Sessão inválida", unauthorized: true }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Fetching appointments for phone:", clientPhone);

    // Create Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        appointment_time,
        client_name,
        client_phone,
        status,
        services (name, price),
        professionals (name)
      `)
      .eq("client_phone", clientPhone)
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: false });

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

  } catch (error) {
    console.error("Error in get-appointments function:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
