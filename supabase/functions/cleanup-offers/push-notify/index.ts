import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const { record } = await req.json(); // 'record' comes from the Database Webhook

    // 1. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 2. Get the Driver's Push Token
    const { data: driverData, error } = await supabaseAdmin
      .from("profiles")
      .select("push_token")
      .eq("id", record.driver_id)
      .single();

    if (error || !driverData?.push_token) {
      console.log("No token found for driver:", record.driver_id);
      return new Response(JSON.stringify({ message: "No token" }), {
        headers: corsHeaders,
      });
    }

    if (!driverData.push_token.startsWith("ExponentPushToken")) {
      return new Response(JSON.stringify({ message: "Invalid token format" }), {
        headers: corsHeaders,
      });
    }

    // 3. Construct the Notification Payload
    // Note: We use the channelId defined in your DriverDashboard
    const message = {
      to: driverData.push_token,
      sound: "default",
      title: "New Ride Request! 🚗",
      body: `Earn ${record.fare_estimate} DZD - Tap to accept!`,
      data: { rideId: record.ride_id }, // Payload for navigation
      priority: "high",
      channelId: "ride-requests-v4", // MATCHES your Android Channel ID
      ttl: 15, // Time to live: 15 seconds (expires if not delivered quickly)
    };

    // 4. Send to Expo
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log("Expo Result:", result);

    return new Response(JSON.stringify(result), { headers: corsHeaders });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
