import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Get Data from Passenger App
    const {
      passenger_id,
      pickup_lat,
      pickup_lng,
      pickup_address,
      dropoff_lat,
      dropoff_lng,
      dropoff_address,
      fare_estimate,
      status,
    } = await req.json();

    // 2. Insert into 'rides' table
    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .insert({
        passenger_id,
        pickup_lat,
        pickup_lng,
        pickup_address,
        dropoff_lat,
        dropoff_lng,
        dropoff_address,
        fare_estimate,
        status: "PENDING",
      })
      .select()
      .single();

    if (rideError) throw rideError;

    // 3. FIND NEARBY DRIVERS & CREATE OFFERS
    // (This logic is simplified. In production, use PostGIS functions to find drivers within X km)

    // For now, we fetch ALL online drivers to ensure your testing works
    const { data: nearbyDrivers } = await supabase
      .from("profiles") // Assuming profiles has 'is_online' or similar
      .select("id");
    // .eq('role', 'driver') // Uncomment if you use roles
    // .eq('is_online', true) // Uncomment if you track online status in DB

    if (nearbyDrivers && nearbyDrivers.length > 0) {
      const offers = nearbyDrivers.map((driver) => ({
        ride_id: ride.id,
        driver_id: driver.id,
        status: "pending",
        expires_at: new Date(Date.now() + 15000).toISOString(), // 15 seconds from now
      }));

      // Insert offers so DriverDashboard listener fires
      const { error: offerError } = await supabase
        .from("ride_offers")
        .insert(offers);

      if (offerError) console.error("Error creating offers:", offerError);
    }

    // 4. Return the ride to the Passenger App
    return new Response(JSON.stringify({ ride }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
