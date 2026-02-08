import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit: 5 attempts per 15 minutes per IP
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

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
    const rateLimit = checkRateLimit(`check-phone:${clientIP}`, RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS);
    
    if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`);
      return rateLimitResponse(rateLimit.retryAfterSeconds, corsHeaders);
    }

    const { client_phone } = await req.json();

    if (!client_phone || typeof client_phone !== 'string') {
      console.log("Missing or invalid client_phone");
      return new Response(
        JSON.stringify({ error: "Número de telefone é obrigatório", found: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanPhone = client_phone.trim();
    if (cleanPhone.length < 8) {
      console.log("Phone number too short:", cleanPhone);
      return new Response(
        JSON.stringify({ error: "Número de telefone inválido", found: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Checking phone:", cleanPhone);

    // Create Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("appointments")
      .select("client_name, client_phone")
      .eq("client_phone", cleanPhone)
      .limit(1);

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar telefone", found: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data || data.length === 0) {
      console.log("No appointments found for phone:", cleanPhone);
      return new Response(
        JSON.stringify({ found: false, message: "Nenhum agendamento encontrado" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Found appointment for:", data[0].client_name);

    // Generate signed JWT session token
    let key;
    try {
      key = await getSigningKey();
    } catch (keyError) {
      console.error("SESSION_SECRET not configured:", keyError);
      return new Response(
        JSON.stringify({ error: "Configuração de segurança incompleta. Contate o administrador.", found: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 24 * 60 * 60; // 24 hours
    
    const sessionToken = await create(
      { alg: "HS256", typ: "JWT" },
      { 
        phone: cleanPhone,
        name: data[0].client_name,
        iat: now,
        exp: now + expiresIn
      },
      key
    );

    console.log("Session token generated for phone:", cleanPhone);

    return new Response(
      JSON.stringify({ 
        found: true, 
        client_name: data[0].client_name,
        client_phone: data[0].client_phone,
        session_token: sessionToken
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in check-phone function:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor", found: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
