import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { date, professional_id } = await req.json();

    if (!date) {
      return new Response(
        JSON.stringify({ error: "Date is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get appointments for the date
    let appointmentsQuery = supabase
      .from("appointments")
      .select("appointment_time, professional_id, services(duration_minutes)")
      .eq("appointment_date", date)
      .neq("status", "cancelled");

    if (professional_id) {
      appointmentsQuery = appointmentsQuery.eq("professional_id", professional_id);
    }

    const { data: appointmentsData, error: appointmentsError } = await appointmentsQuery;

    if (appointmentsError) {
      console.error("Database error (appointments):", appointmentsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch availability" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get day of week for recurring blocks (0=Sunday, 1=Monday, etc.)
    const dateObj = new Date(date + "T00:00:00");
    const dayOfWeek = dateObj.getDay();

    // Get blocked times for this date (both specific date and recurring by day of week)
    let blockedQuery = supabase
      .from("blocked_times")
      .select("professional_id, start_time, end_time, block_type")
      .eq("is_active", true)
      .or(`and(block_type.eq.specific,specific_date.eq.${date}),and(block_type.eq.recurring,day_of_week.eq.${dayOfWeek})`);

    if (professional_id) {
      blockedQuery = blockedQuery.eq("professional_id", professional_id);
    }

    const { data: blockedData, error: blockedError } = await blockedQuery;

    if (blockedError) {
      console.error("Database error (blocked_times):", blockedError);
      // Continue without blocked times data - non-critical
    }

    // Get business hours (seed defaults if empty)
    let { data: businessHours, error: businessHoursError } = await supabase
      .from("business_hours")
      .select("day_of_week,is_open,open_time,close_time")
      .order("day_of_week");

    if (businessHoursError) {
      console.error("Database error (business_hours):", businessHoursError);
    }

    if (!businessHours || businessHours.length === 0) {
      const defaultRows = [
        { day_of_week: 0, is_open: false, open_time: "09:00", close_time: "18:00" },
        { day_of_week: 1, is_open: true, open_time: "08:00", close_time: "19:00" },
        { day_of_week: 2, is_open: true, open_time: "08:00", close_time: "19:00" },
        { day_of_week: 3, is_open: true, open_time: "08:00", close_time: "19:00" },
        { day_of_week: 4, is_open: true, open_time: "08:00", close_time: "19:00" },
        { day_of_week: 5, is_open: true, open_time: "08:00", close_time: "19:00" },
        { day_of_week: 6, is_open: true, open_time: "08:00", close_time: "17:00" },
      ];
      const { error: seedError } = await supabase.from("business_hours").upsert(defaultRows, {
        onConflict: "day_of_week",
      });
      if (seedError) {
        console.error("Failed seeding default business_hours:", seedError);
      } else {
        const reload = await supabase
          .from("business_hours")
          .select("day_of_week,is_open,open_time,close_time")
          .order("day_of_week");
        businessHours = reload.data || [];
      }
    }

    // Return appointments data
    const availability = appointmentsData?.map((apt: any) => ({
      appointment_time: apt.appointment_time,
      professional_id: apt.professional_id,
      duration_minutes: apt.services?.duration_minutes || 30
    })) || [];

    // Return blocked times data
    const blockedTimes = blockedData?.map((block: any) => ({
      professional_id: block.professional_id,
      start_time: block.start_time,
      end_time: block.end_time
    })) || [];

    return new Response(
      JSON.stringify({ availability, blockedTimes, businessHours }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
