import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit: 3 attempts per 10 minutes per IP (stricter for admin auth)
const RATE_LIMIT_MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Password Hashing using bcrypt (without workers for Deno Deploy compatibility)
 */
async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

/**
 * Password Verification - handles bcrypt and legacy plaintext
 */
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Check if it's a bcrypt hash (starts with $2)
  if (storedHash.startsWith("$2")) {
    try {
      return await bcrypt.compare(password, storedHash);
    } catch (err) {
      console.error("bcrypt compare error:", err);
      return false;
    }
  }
  
  // Fallback: plaintext comparison for migration only
  return password === storedHash;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting check
    const clientIP = getClientIP(req);
    const rateLimit = checkRateLimit(`admin-auth:${clientIP}`, RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS);
    
    if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for admin auth from IP: ${clientIP}`);
      return rateLimitResponse(rateLimit.retryAfterSeconds, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { phone, password, action } = await req.json();
    
    console.log("Admin auth action:", action || "login", "for phone:", phone);

    if (!phone || !password) {
      console.log("Missing phone or password");
      return new Response(
        JSON.stringify({ success: false, error: "Telefone e senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: "Senha deve ter pelo menos 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number - remove non-digits
    const cleanPhone = phone.replace(/\D/g, "");

    // Look up admin by phone
    const { data: admin, error: lookupError } = await supabase
      .from("admin_credentials")
      .select("*")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (lookupError) {
      console.error("Database error:", lookupError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao verificar credenciais" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!admin) {
      console.log("Admin not found for phone:", cleanPhone);
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais inválidas" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check password
    let isPasswordValid = false;
    let needsRehash = false;
    
    // Check if password is already properly hashed with bcrypt
    if (admin.password_hash.startsWith("$2")) {
      // Properly hashed password - use bcrypt compare
      isPasswordValid = await verifyPassword(password, admin.password_hash);
    } else {
      // Legacy format (plaintext) - compare directly and mark for rehash
      isPasswordValid = password === admin.password_hash;
      needsRehash = isPasswordValid;
    }

    // Migrate to bcrypt if needed
    if (isPasswordValid && needsRehash) {
      try {
        const newHash = await hashPassword(password);
        const { error: updateError } = await supabase
          .from("admin_credentials")
          .update({ password_hash: newHash, needs_rehash: false })
          .eq("id", admin.id);
        
        if (updateError) {
          console.error("Failed to update password hash:", updateError);
        } else {
          console.log("Password migrated to bcrypt for admin:", admin.name);
        }
      } catch (hashError) {
        console.error("Failed to hash password for migration:", hashError);
        // Don't fail login, just log the error
      }
    }

    if (!isPasswordValid) {
      console.log("Invalid password for admin:", cleanPhone);
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais inválidas" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a session token
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Get client info for session
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Store session in database
    const { error: sessionError } = await supabase
      .from("admin_sessions")
      .insert({
        admin_id: admin.id,
        token: sessionToken,
        expires_at: expiresAt.toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao criar sessão" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean up expired sessions for this admin
    await supabase
      .from("admin_sessions")
      .delete()
      .eq("admin_id", admin.id)
      .lt("expires_at", new Date().toISOString());

    console.log("Admin login successful:", admin.name);

    return new Response(
      JSON.stringify({
        success: true,
        admin: {
          id: admin.id,
          name: admin.name,
          phone: admin.phone,
        },
        sessionToken,
        expiresAt: expiresAt.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in admin-auth:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
