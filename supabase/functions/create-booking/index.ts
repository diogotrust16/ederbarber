import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limit: 3 bookings per hour per IP
const RATE_LIMIT_MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Rate limiting check
    const clientIP = getClientIP(req);
    const rateLimit = checkRateLimit(`create-booking:${clientIP}`, RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS);
    
    if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for booking from IP: ${clientIP}`);
      return rateLimitResponse(rateLimit.retryAfterSeconds, corsHeaders);
    }

    const { service_id, professional_id, appointment_date, appointment_time, client_name, client_phone } = await req.json()

    // Validate required fields
    if (!service_id || !professional_id || !appointment_date || !appointment_time || !client_name || !client_phone) {
      console.error('Missing required fields:', { service_id, professional_id, appointment_date, appointment_time, client_name, client_phone })
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role for RLS bypass
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check for conflicting appointments
    const { data: existingAppointments, error: checkError } = await supabase
      .from('appointments')
      .select('id, appointment_time, services!inner(duration_minutes)')
      .eq('appointment_date', appointment_date)
      .eq('professional_id', professional_id)
      .in('status', ['scheduled', 'confirmed'])

    if (checkError) {
      console.error('Error checking existing appointments:', checkError)
      return new Response(
        JSON.stringify({ error: 'Failed to check availability' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the service duration for the new appointment
    const { data: serviceData, error: serviceError } = await supabase
      .from('services')
      .select('duration_minutes')
      .eq('id', service_id)
      .single()

    if (serviceError || !serviceData) {
      console.error('Error fetching service:', serviceError)
      return new Response(
        JSON.stringify({ error: 'Invalid service' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for time conflicts
    const [newHour, newMin] = appointment_time.split(':').map(Number)
    const newStartMinutes = newHour * 60 + newMin
    const newEndMinutes = newStartMinutes + serviceData.duration_minutes

    for (const apt of existingAppointments || []) {
      const [aptHour, aptMin] = apt.appointment_time.slice(0, 5).split(':').map(Number)
      const aptStartMinutes = aptHour * 60 + aptMin
      const aptDuration = (apt.services as any)?.duration_minutes || 30
      const aptEndMinutes = aptStartMinutes + aptDuration

      // Check if ranges overlap
      if (newStartMinutes < aptEndMinutes && newEndMinutes > aptStartMinutes) {
        console.log('Time conflict detected:', { newStartMinutes, newEndMinutes, aptStartMinutes, aptEndMinutes })
        return new Response(
          JSON.stringify({ error: 'Time slot is no longer available' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Create the appointment
    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        service_id,
        professional_id,
        appointment_date,
        appointment_time,
        client_name: client_name.trim(),
        client_phone: client_phone.trim(),
        status: 'scheduled'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating appointment:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create appointment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Appointment created successfully:', appointment.id)

    return new Response(
      JSON.stringify({ success: true, appointment }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
