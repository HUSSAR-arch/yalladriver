// index.ts

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      passenger_id,
      pickup_lat,
      pickup_lng,
      pickup_address,
      dropoff_lat,
      dropoff_lng,
      dropoff_address,
      fare_estimate,
    } = await req.json();

    // 1. Create Ride
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

    // 2. Find Drivers (Fetch their Push Tokens too!)
    const { data: nearbyDrivers } = await supabase
      .from("profiles")
      .select("id, push_token")
      .eq("role", "driver")
      .not("push_token", "is", null); // Only get drivers with tokens

    const notifications = [];

    // 2. Prepare Notifications
    if (nearbyDrivers) {
      for (const driver of nearbyDrivers) {
        notifications.push({
          to: driver.push_token,
          sound: "default", // Plays the default phone notification sound
          title: "New Ride Request! 🚕",
          body: `Fare: ${fare_estimate} DZD - Tap to view`,
          data: { rideId: ride.id }, // HIDDEN DATA: Used when driver taps the notification
          priority: "high",
          channelId: "ride-requests-v3", // MUST match the channel ID in your Frontend code
        });
      }
    }

    // 3. Send to Expo
    if (notifications.length > 0) {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notifications),
      });
    }

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
