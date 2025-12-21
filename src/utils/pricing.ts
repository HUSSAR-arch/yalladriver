// src/utils/pricing.ts
export const calculateFare = (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(endLat - startLat);
  const dLon = deg2rad(endLng - startLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(startLat)) *
      Math.cos(deg2rad(endLat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c; // Distance in km

  // PRICING MODEL (Example for Algeria)
  const BASE_FARE = 150; // Flag drop (DZD)
  const PRICE_PER_KM = 40; // DZD per KM

  let total = BASE_FARE + distanceKm * PRICE_PER_KM;
  return Math.round(total / 10) * 10; // Round to nearest 10 DZD
};

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}
