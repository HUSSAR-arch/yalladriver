import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// H3-js can be imported via a CDN/ESM URL for Deno
import { latLngToCell } from "https://unpkg.com/h3-js@4.1.0/lib/h3.js";

serve(async (req: Request) => {
  try {
    const { lat, lng } = await req.json();

    // Define your desired resolution (e.g., 8)
    const resolution = 8;

    // Calculate the H3 index using the standard library
    const h3Index = latLngToCell(lat, lng, resolution);

    return new Response(JSON.stringify({ h3_index: h3Index }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
