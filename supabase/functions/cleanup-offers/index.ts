// supabase/functions/cleanup-offers/index.ts
serve(async (req) => {
  // 1. Find expired offers
  const { data: expiredOffers } = await supabase
    .from("ride_offers")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select("ride_id, driver_id");

  // 2. For every expired offer, trigger the 'reject' logic manually
  if (expiredOffers) {
    for (const offer of expiredOffers) {
      await supabase.rpc("driver_reject_ride", {
        p_ride_id: offer.ride_id,
        p_driver_id: offer.driver_id,
      });
    }
  }
});
