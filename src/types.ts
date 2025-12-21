// src/types.ts

// types.ts
export enum RideStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  ARRIVED = "ARRIVED", // << Add this
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_DRIVERS = "NO_DRIVERS_AVAILABLE",
}

export enum PaymentMethod {
  CASH = "CASH",
  CIB = "CIB",
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface SavedPlace {
  id: string;
  label: string; // "Home", "Work", etc.
  address: string;
  latitude: number;
  longitude: number;
}

export interface RideRequest {
  id?: string; // Supabase will generate this
  passenger_id: string;
  driver_id: string | null;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string;
  status: RideStatus;
  fare_estimate: number;
  created_at?: string;
  start_code?: string;
}

export type UserRole = "PASSENGER" | "DRIVER";

export interface UserProfile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string;
}
