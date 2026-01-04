import React, { useRef, useEffect, useState } from "react";
import MapViewDirections from "react-native-maps-directions";
import * as Clipboard from "expo-clipboard";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
  StatusBar,
  Platform,
  Linking,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import {
  ArrowLeft,
  ArrowRight,
  User,
  Star,
  Wallet,
  Copy,
  CheckCircle2,
  Phone,
  MapPin,
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";
import { supabase } from "../lib/supabase";

// --- THEME CONSTANTS (MATCHING DRIVER DASHBOARD) ---
const COLORS = {
  primary: "#111827", // Dark Charcoal
  mainPurple: "#775BD4", // Brand Purple
  accent: "#960082ff", // Magenta Accent
  background: "#F3F4F6", // Light Gray
  card: "#FFFFFF",
  text: "#1F2937",
  textLight: "#6B7280",
  border: "#E5E7EB",
  success: "#10b981", // Green
  danger: "#ef4444", // Red
};

const { width, height } = Dimensions.get("window");
const GOOGLE_API_KEY = "AIzaSyBmq7ZMAkkbnzvEywiWDlX1sO6Pu27sJrU"; // Use your actual key

// --- MAP STYLE (Clean Grayscale for Driver) ---
const CUSTOM_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9c9c9" }],
  },
];

export default function DriverRideDetails({ navigation, route }: any) {
  const { ride: initialRide } = route.params;
  const [ride, setRide] = useState(initialRide);
  const [passenger, setPassenger] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const { t, language } = useLanguage();

  const mapRef = useRef<MapView>(null);
  const isRTL = language === "ar";
  const alignText = isRTL ? "right" : "left";
  const flexDirection = isRTL ? "row-reverse" : "row";

  // 1. Fetch Passenger Details
  useEffect(() => {
    const fetchPassenger = async () => {
      if (!ride.passenger_id) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", ride.passenger_id)
        .single();

      if (data) setPassenger(data);
    };
    fetchPassenger();
  }, [ride.passenger_id]);

  // 2. Fit Map
  useEffect(() => {
    if (mapRef.current && ride.pickup_lat && ride.dropoff_lat) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [
            { latitude: ride.pickup_lat, longitude: ride.pickup_lng },
            { latitude: ride.dropoff_lat, longitude: ride.dropoff_lng },
          ],
          {
            edgePadding: { top: 80, right: 50, bottom: 50, left: 50 },
            animated: true,
          }
        );
      }, 500);
    }
  }, []);

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(ride.short_id || ride.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString(isRTL ? "ar-DZ" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleTimeString(isRTL ? "ar-DZ" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* --- MAP SECTION --- */}
      <View style={styles.mapHeader}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: ride.pickup_lat || 36.75,
            longitude: ride.pickup_lng || 3.05,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          customMapStyle={CUSTOM_MAP_STYLE}
        >
          {/* Pick Up Marker */}
          <Marker
            coordinate={{
              latitude: ride.pickup_lat,
              longitude: ride.pickup_lng,
            }}
          >
            <View
              style={[styles.markerBase, { borderColor: COLORS.mainPurple }]}
            >
              <User size={14} color={COLORS.mainPurple} />
            </View>
          </Marker>

          {/* Drop Off Marker */}
          <Marker
            coordinate={{
              latitude: ride.dropoff_lat,
              longitude: ride.dropoff_lng,
            }}
          >
            <View style={[styles.markerBase, { borderColor: COLORS.accent }]}>
              <MapPin size={14} color={COLORS.accent} />
            </View>
          </Marker>

          <MapViewDirections
            origin={{ latitude: ride.pickup_lat, longitude: ride.pickup_lng }}
            destination={{
              latitude: ride.dropoff_lat,
              longitude: ride.dropoff_lng,
            }}
            apikey={GOOGLE_API_KEY}
            strokeWidth={4}
            strokeColor={COLORS.mainPurple}
            mode="DRIVING"
          />
        </MapView>

        {/* Back Button */}
        <SafeAreaView style={styles.headerOverlay}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            {isRTL ? (
              <ArrowRight size={24} color={COLORS.text} />
            ) : (
              <ArrowLeft size={24} color={COLORS.text} />
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      {/* --- DETAILS SHEET --- */}
      <View style={styles.sheetContainer}>
        <View style={styles.dragHandle} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Header: ID & Status */}
          <View style={[styles.headerRow, { flexDirection }]}>
            <View>
              <Text style={styles.label}>{t("rideId") || "RIDE ID"}</Text>
              <TouchableOpacity
                onPress={copyToClipboard}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={styles.rideId}>
                  #{ride.short_id || ride.id.slice(0, 8).toUpperCase()}
                </Text>
                {copied ? (
                  <CheckCircle2 size={16} color={COLORS.success} />
                ) : (
                  <Copy size={16} color={COLORS.mainPurple} />
                )}
              </TouchableOpacity>
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    ride.status === "COMPLETED" ? "#d1fae5" : "#fee2e2",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: ride.status === "COMPLETED" ? "#047857" : "#b91c1c",
                  },
                ]}
              >
                {ride.status}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* 2. Earnings Card */}
          <View style={[styles.card, { flexDirection }]}>
            <View style={[styles.iconBox, { backgroundColor: "#F3E8FF" }]}>
              <Wallet size={24} color={COLORS.mainPurple} />
            </View>
            <View
              style={{
                flex: 1,
                marginHorizontal: 12,
                alignItems: isRTL ? "flex-end" : "flex-start",
              }}
            >
              <Text style={styles.label}>
                {t("earnings") || "Total Earnings"}
              </Text>
              <Text style={styles.priceValue}>
                {ride.fare_estimate}{" "}
                <Text style={{ fontSize: 14, color: COLORS.textLight }}>
                  DZD
                </Text>
              </Text>
            </View>
          </View>

          {/* 3. Passenger Info */}
          {passenger && (
            <View style={styles.card}>
              <Text style={[styles.sectionTitle, { textAlign: alignText }]}>
                {t("passenger") || "PASSENGER"}
              </Text>
              <View style={[styles.passengerRow, { flexDirection }]}>
                <View style={styles.avatar}>
                  <User size={24} color={COLORS.textLight} />
                </View>
                <View
                  style={{
                    flex: 1,
                    marginHorizontal: 12,
                    alignItems: isRTL ? "flex-end" : "flex-start",
                  }}
                >
                  <Text style={styles.passengerName}>
                    {passenger.full_name || "Guest User"}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Star size={12} color="#FBBF24" fill="#FBBF24" />
                    <Text style={styles.ratingText}>
                      {passenger.average_rating
                        ? Number(passenger.average_rating).toFixed(1)
                        : "5.0"}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => Linking.openURL(`tel:${passenger.phone}`)}
                >
                  <Phone size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 4. Timeline */}
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, { textAlign: alignText }]}>
              {t("tripRoute") || "TRIP ROUTE"}
            </Text>

            {/* Pickup */}
            <View style={[styles.timelineItem, { flexDirection }]}>
              <View style={styles.timelineIconColumn}>
                <View
                  style={[styles.dot, { backgroundColor: COLORS.mainPurple }]}
                />
                <View style={styles.line} />
              </View>
              <View
                style={{
                  flex: 1,
                  marginHorizontal: 12,
                  alignItems: isRTL ? "flex-end" : "flex-start",
                }}
              >
                <Text style={styles.timelineLabel}>{t("pickup")}</Text>
                <Text style={styles.addressText}>{ride.pickup_address}</Text>
                <Text style={styles.timeText}>
                  {formatTime(ride.created_at)}
                </Text>
              </View>
            </View>

            {/* Dropoff */}
            <View style={[styles.timelineItem, { flexDirection }]}>
              <View style={styles.timelineIconColumn}>
                <View
                  style={[styles.dot, { backgroundColor: COLORS.accent }]}
                />
              </View>
              <View
                style={{
                  flex: 1,
                  marginHorizontal: 12,
                  alignItems: isRTL ? "flex-end" : "flex-start",
                }}
              >
                <Text style={styles.timelineLabel}>{t("dropoff")}</Text>
                <Text style={styles.addressText}>{ride.dropoff_address}</Text>
              </View>
            </View>
          </View>

          {/* 5. Date Footer */}
          <View style={{ alignItems: "center", marginBottom: 30 }}>
            <Text style={styles.footerDate}>
              {t("tripDate") || "Trip Date"}: {formatDate(ride.created_at)}
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  mapHeader: { height: height * 0.35, width: "100%" },
  headerOverlay: {
    position: "absolute",
    top: Platform.OS === "android" ? 40 : 10,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },

  sheetContainer: {
    flex: 1,
    marginTop: -25,
    backgroundColor: "#fff",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    overflow: "hidden",
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2.5,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 5,
  },
  scrollContent: { padding: 20 },

  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  label: {
    fontSize: 12,
    color: COLORS.textLight,
    fontFamily: "Tajawal_500Medium",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  rideId: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.primary,
  },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
    textTransform: "uppercase",
  },

  divider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 15 },

  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  priceValue: {
    fontSize: 24,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.mainPurple,
  },

  sectionTitle: {
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.textLight,
    marginBottom: 12,
    letterSpacing: 0.5,
  },

  passengerRow: { alignItems: "center" },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  passengerName: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.text,
  },
  ratingText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: COLORS.textLight,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.success,
    justifyContent: "center",
    alignItems: "center",
  },

  timelineItem: { minHeight: 60 },
  timelineIconColumn: { alignItems: "center", width: 20 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "white",
    shadowOpacity: 0.2,
  },
  line: { width: 2, flex: 1, backgroundColor: "#E5E7EB", marginVertical: 4 },
  timelineLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    fontFamily: "Tajawal_700Bold",
    marginBottom: 2,
  },
  addressText: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    color: COLORS.text,
    lineHeight: 20,
  },
  timeText: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },

  footerDate: {
    fontSize: 13,
    color: COLORS.textLight,
    fontFamily: "Tajawal_500Medium",
  },

  markerBase: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
  },
});
