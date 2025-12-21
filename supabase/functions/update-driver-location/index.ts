import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { latLngToCell } from "https://esm.sh/h3-js@4.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. USE SERVICE ROLE KEY (The Master Key)
    // This bypasses RLS policies so we can write even if the user session is lost
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", // <--- CHANGED THIS
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 2. Get Data
    const { lat, lng, driver_id } = await req.json();

    if (!driver_id) {
      return new Response(JSON.stringify({ error: "No Driver ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Calculate Hexagon
    const h3Index = latLngToCell(lat, lng, 8);

    // 4. Upsert Location using the Admin Client
    const { error } = await supabaseAdmin.from("driver_locations").upsert(
      {
        driver_id: driver_id,
        lat: lat,
        lng: lng,

        // 👇 OPTION 1: Fill the empty column (h3_index)
        h3_index: h3Index,

        // 👇 OPTION 2: Keep filling the other one too (if other code uses it)
        current_h3_index: h3Index,

        updated_at: new Date().toISOString(),
      },
      { onConflict: "driver_id" }
    );

    if (error) {
      console.error("Upsert Error:", error);
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
