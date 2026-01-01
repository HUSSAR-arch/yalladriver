import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
} from "react-native";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  Clock,
  MapPin,
  AlertCircle,
  Calendar, // <--- Added
  CheckCircle, // <--- Added
  User, // <--- Added
  Car,
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";

// --- RTL/LTR Configuration ---
const rtlStyles = {
  flexDirectionRow: { flexDirection: "row-reverse" as const },
  textAlign: { textAlign: "right" as const },
  alignItems: { alignItems: "flex-end" as const },
};

const ltrStyles = {
  flexDirectionRow: { flexDirection: "row" as const },
  textAlign: { textAlign: "left" as const },
  alignItems: { alignItems: "flex-start" as const },
};

export default function HistoryScreen({ navigation, route }: any) {
  const { t, language } = useLanguage();
  const paramsSession = route.params?.session;
  const [session, setSession] = useState<any>(paramsSession);

  // --- Determine Styles based on Language ---
  const isRTL = language === "ar";
  const alignStyle = isRTL ? rtlStyles : ltrStyles;

  // State
  const [activeTab, setActiveTab] = useState<"history" | "scheduled">(
    "history"
  ); // <--- NEW STATE
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataList, setDataList] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Session Check
  useEffect(() => {
    if (!session) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setSession(data.session);
        } else {
          setLoading(false);
        }
      });
    }
  }, []);

  // 2. Fetch Data (Dependent on Tab)
  useEffect(() => {
    if (session?.user?.id) {
      fetchData();
    }
  }, [session, activeTab]); // <--- Re-fetch when tab changes

  const fetchData = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMsg(null);

    try {
      let query = supabase.from("rides").select("*");

      if (activeTab === "history") {
        // --- HISTORY LOGIC (Completed/Cancelled) ---
        query = query
          .or(
            `passenger_id.eq.${session.user.id},driver_id.eq.${session.user.id}`
          )
          .in("status", ["COMPLETED", "CANCELLED"])
          .order("created_at", { ascending: false })
          .limit(50);
      } else {
        // --- SCHEDULED LOGIC (Future Rides) ---
        // Fetch rides that are SCHEDULED and either:
        // 1. I am the passenger
        // 2. I am the driver (assigned)
        // 3. No driver is assigned (Marketplace for drivers)
        query = query
          .eq("status", "SCHEDULED")
          // Order by scheduled time (soonest first)
          .order("scheduled_time", { ascending: true });
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        if (activeTab === "scheduled") {
          // Client-side filter to ensure privacy/relevance
          // We want:
          // 1. My rides (Passenger or Driver)
          // 2. Open rides (Driver ID is null) -> ONLY if I'm looking for work
          // Since we don't strictly know if user is "Driver Mode", we show open rides to everyone
          // but the "Accept" button will handle the logic.
          const relevantRides = data.filter(
            (ride) =>
              ride.passenger_id === session.user.id ||
              ride.driver_id === session.user.id ||
              ride.driver_id === null
          );
          setDataList(relevantRides);
        } else {
          setDataList(data);
        }
      }
    } catch (err: any) {
      console.log("Fetch Error:", err);
      setErrorMsg(t("networkError") || "Could not load data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [session, activeTab]);

  // --- ACTIONS ---
  const handleAcceptScheduledRide = async (ride: any) => {
    Alert.alert(
      t("acceptRide") || "Accept Ride",
      t("confirmSchedule") ||
        `Confirm pickup for ${formatDate(ride.scheduled_time)}?`,
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("confirm"),
          onPress: async () => {
            setLoading(true);

            try {
              // REPLACE DIRECT SUPABASE CALL WITH API FETCH
              const response = await fetch(
                "https://my-ride-service.onrender.com/rides/accept",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    rideId: ride.id,
                    driverId: session.user.id,
                  }),
                }
              );

              const result = await response.json();

              if (!response.ok) {
                // Handle API errors (e.g., "Ride no longer available")
                Alert.alert(
                  "Error",
                  result.message || "Could not accept ride."
                );
              } else {
                Alert.alert("Success", "Ride added to your schedule!");
                fetchData(true);
              }
            } catch (error) {
              console.log("Accept Error", error);
              Alert.alert("Network Error", "Could not connect to server.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCancelScheduledRide = async (ride: any) => {
    // If I am the passenger -> Cancel Request
    // If I am the driver -> Unassign myself
    const isMyPassengerRide = ride.passenger_id === session.user.id;

    Alert.alert(
      t("cancel"),
      isMyPassengerRide ? "Cancel this request?" : "Remove from your schedule?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            let update = {};

            if (isMyPassengerRide) {
              // Passenger cancelling -> Kill the ride
              update = { status: "CANCELLED" };
            } else {
              // Driver cancelling -> Release the ride back to pool
              update = { driver_id: null };
            }

            const { error } = await supabase
              .from("rides")
              .update(update)
              .eq("id", ride.id);
            if (!error) fetchData(true);
            setLoading(false);
          },
        },
      ]
    );
  };

  // --- UI HELPERS ---
  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  const getStatusText = (status: string) => {
    if (status === "COMPLETED") return t("statusCompleted") || "Completed";
    if (status === "CANCELLED") return t("statusCancelled") || "Cancelled";
    if (status === "SCHEDULED") return t("statusScheduled") || "Scheduled";
    return status;
  };

  const renderItem = ({ item }: { item: any }) => {
    // --- SCHEDULED ITEM ---
    if (activeTab === "scheduled") {
      const isAssignedToMe = item.driver_id === session.user.id;
      const isMyRequest = item.passenger_id === session.user.id;
      const isOpen = item.driver_id === null;

      return (
        <View
          style={[
            styles.card,
            {
              borderLeftWidth: 4,
              borderLeftColor: isAssignedToMe ? "#775BD4" : "#E5E7EB",
            },
          ]}
        >
          {/* Header: Date & Status */}
          <View style={[styles.rowBetween, alignStyle.flexDirectionRow]}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Calendar size={16} color="#775BD4" />
              <Text
                style={[
                  styles.dateText,
                  { color: "#775BD4", fontFamily: "Tajawal-Bold" },
                ]}
              >
                {formatDate(item.scheduled_time)}
              </Text>
            </View>
            <Text style={styles.price}>
              {item.fare_estimate}{" "}
              <Text style={{ fontSize: 12, color: "gray" }}>DZD</Text>
            </Text>
          </View>

          {/* Timeline */}
          <View style={styles.timeline}>
            <View style={[styles.locRow, alignStyle.flexDirectionRow]}>
              <MapPin size={16} color="#059669" />
              <Text
                style={[styles.address, alignStyle.textAlign]}
                numberOfLines={1}
              >
                {item.pickup_address}
              </Text>
            </View>
            <View
              style={[
                styles.line,
                isRTL ? { marginRight: 7 } : { marginLeft: 7 },
              ]}
            />
            <View style={[styles.locRow, alignStyle.flexDirectionRow]}>
              <MapPin size={16} color="#dc2626" />
              <Text
                style={[styles.address, alignStyle.textAlign]}
                numberOfLines={1}
              >
                {item.dropoff_address}
              </Text>
            </View>
          </View>

          {/* ACTION BUTTONS */}
          <View
            style={{
              marginTop: 15,
              paddingTop: 10,
              borderTopWidth: 1,
              borderTopColor: "#f3f4f6",
            }}
          >
            {isOpen && !isMyRequest ? (
              <TouchableOpacity
                onPress={() => handleAcceptScheduledRide(item)}
                style={styles.actionBtnPrimary}
              >
                <Text style={styles.actionBtnTextPrimary}>
                  {t("acceptJob") || "Accept Job"}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.rowBetween, alignStyle.flexDirectionRow]}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: isMyRequest ? "#e0f2fe" : "#f0fdf4" },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: isMyRequest ? "#0284c7" : "#15803d" },
                    ]}
                  >
                    {isMyRequest
                      ? t("yourRequest") || "Your Request"
                      : t("assignedToYou") || "Assigned to You"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleCancelScheduledRide(item)}
                >
                  <Text
                    style={{
                      color: "#ef4444",
                      fontFamily: "Tajawal-Bold",
                      fontSize: 13,
                    }}
                  >
                    {t("cancel") || "Cancel"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      );
    }

    // --- HISTORY ITEM (Existing Logic) ---
    return (
      <View style={styles.card}>
        <View style={[styles.rowBetween, alignStyle.flexDirectionRow]}>
          <Text
            style={[
              styles.status,
              item.status === "COMPLETED"
                ? { color: "#51009cff" }
                : { color: "red" },
            ]}
          >
            {getStatusText(item.status)}
          </Text>
          <Text style={styles.price}>
            {item.fare_estimate || "0"}{" "}
            <Text
              style={{
                fontSize: 12,
                color: "gray",
                fontFamily: "Tajawal-Regular",
              }}
            >
              DZD
            </Text>
          </Text>
        </View>

        <View style={[styles.dateRow, alignStyle.flexDirectionRow]}>
          <Clock size={14} color="gray" />
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        </View>

        <View style={styles.timeline}>
          <View style={[styles.locRow, alignStyle.flexDirectionRow]}>
            <MapPin size={16} color="#059669" />
            <Text
              style={[styles.address, alignStyle.textAlign]}
              numberOfLines={1}
            >
              {item.pickup_address || "Unknown Pickup"}
            </Text>
          </View>

          <View
            style={[
              styles.line,
              isRTL ? { marginRight: 7 } : { marginLeft: 7 },
            ]}
          />

          <View style={[styles.locRow, alignStyle.flexDirectionRow]}>
            <MapPin size={16} color="#dc2626" />
            <Text
              style={[styles.address, alignStyle.textAlign]}
              numberOfLines={1}
            >
              {item.dropoff_address || "Unknown Dropoff"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* --- HEADER --- */}
      <View style={[styles.headerContainer, alignStyle.flexDirectionRow]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, isRTL && { transform: [{ scaleX: -1 }] }]}
        >
          <ArrowLeft size={28} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("myActivity") || "My Activity"}
        </Text>
      </View>

      {/* --- TABS --- */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === "history" && styles.tabBtnActive,
          ]}
          onPress={() => setActiveTab("history")}
        >
          <Clock
            size={18}
            color={activeTab === "history" ? "white" : "#6B7280"}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "history" && styles.tabTextActive,
            ]}
          >
            {t("history") || "History"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === "scheduled" && styles.tabBtnActive,
          ]}
          onPress={() => setActiveTab("scheduled")}
        >
          <Calendar
            size={18}
            color={activeTab === "scheduled" ? "white" : "#6B7280"}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "scheduled" && styles.tabTextActive,
            ]}
          >
            {t("scheduled") || "Scheduled"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* --- CONTENT --- */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FFC107" />
        </View>
      ) : errorMsg ? (
        <View style={styles.centerContainer}>
          <AlertCircle size={40} color="#ef4444" style={{ marginBottom: 10 }} />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity
            onPress={() => fetchData(false)}
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={dataList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#FFC107"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>
                {activeTab === "scheduled"
                  ? t("noScheduledRides") || "No upcoming rides found."
                  : t("emptyNoRides") || "No past rides found."}
              </Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  // --- Header Styles ---
  headerContainer: {
    marginBottom: 5,
    marginTop: 10,
    padding: 20,
    alignItems: "center",
  },
  headerTitle: {
    marginTop: 30,
    fontSize: 18,
    fontFamily: "Tajawal-Bold",
    color: "#1F2937",
    marginHorizontal: 10,
  },
  backBtn: {
    marginTop: 30,
    padding: 5,
    marginHorizontal: 5,
  },
  // --- TABS ---
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 4,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  tabBtnActive: {
    backgroundColor: "#111827", // Dark Black
  },
  tabText: {
    fontFamily: "Tajawal-Medium",
    color: "#6B7280",
    fontSize: 14,
  },
  tabTextActive: {
    fontFamily: "Tajawal-Bold",
    color: "white",
  },
  // --- Card Styles ---
  card: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rowBetween: {
    justifyContent: "space-between",
    marginBottom: 10,
    alignItems: "center",
  },
  status: {
    fontFamily: "Tajawal-Bold",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  price: {
    fontFamily: "Tajawal-Bold",
    fontSize: 18,
    color: "#111827",
  },
  dateRow: {
    alignItems: "center",
    gap: 6,
    marginBottom: 15,
  },
  dateText: {
    color: "#6b7280",
    fontSize: 13,
    fontFamily: "Tajawal-Medium",
  },
  // --- Timeline ---
  timeline: { gap: 0 },
  locRow: {
    gap: 12,
    alignItems: "center",
  },
  address: {
    fontSize: 15,
    color: "#374151",
    flex: 1,
    fontFamily: "Tajawal-Medium",
  },
  line: {
    height: 15,
    width: 2,
    backgroundColor: "#e5e7eb",
    marginVertical: 2,
  },
  // --- Action Buttons ---
  actionBtnPrimary: {
    backgroundColor: "#775BD4",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnTextPrimary: {
    color: "white",
    fontFamily: "Tajawal-Bold",
    fontSize: 14,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Tajawal-Bold",
  },
  // --- States ---
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    marginTop: 50,
  },
  emptyText: {
    color: "#9ca3af",
    fontSize: 16,
    fontFamily: "Tajawal-Regular",
    textAlign: "center",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 15,
    fontFamily: "Tajawal-Regular",
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#e5e7eb",
    borderRadius: 20,
  },
  retryText: {
    fontFamily: "Tajawal-Bold",
  },
});
