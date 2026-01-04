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
  ArrowRight, // Keep specific arrow if you want, or just use Chevron
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Clock,
  MapPin,
  Calendar,
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";

// --- THEME CONSTANTS ---
const COLORS = {
  primary: "#111827",
  secondary: "#775BD4",
  background: "#f8fafc",
  white: "#FFFFFF",
  gray: "#6B7280",
  lightGray: "#E5E7EB",
  danger: "#ef4444",
  success: "#10b981",
};

// Define valid filter types
type FilterType = "ALL" | "SCHEDULED" | "COMPLETED" | "CANCELLED";

export default function HistoryScreen({ navigation, route }: any) {
  const { t, language } = useLanguage();
  const paramsSession = route.params?.session;
  const [session, setSession] = useState<any>(paramsSession);
  const isRTL = language === "ar";

  // --- CHANGED: Unified Filter State (No more activeTab) ---
  const [statusFilter, setStatusFilter] = useState<FilterType>("ALL");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataList, setDataList] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setSession(data.session);
        else setLoading(false);
      });
    }
  }, []);

  useEffect(() => {
    if (session?.user?.id) fetchData();
  }, [session, statusFilter]);

  const fetchData = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMsg(null);

    try {
      let query = supabase.from("rides").select("*");

      // --- LOGIC BRANCHING BASED ON FILTER ---
      if (statusFilter === "SCHEDULED") {
        // 1. SCHEDULED LOGIC (Future rides, sorted by scheduled_time)
        query = query
          .eq("status", "SCHEDULED")
          .order("scheduled_time", { ascending: true });
      } else {
        // 2. HISTORY LOGIC (Past rides, sorted by created_at)
        // Includes: ALL (Completed/Cancelled) OR Specific Status
        query = query
          .or(
            `passenger_id.eq.${session.user.id},driver_id.eq.${session.user.id}`
          )
          .order("created_at", { ascending: false })
          .limit(50);

        if (statusFilter === "ALL") {
          // "All" typically implies history (Completed/Cancelled) in this context
          query = query.in("status", ["COMPLETED", "CANCELLED"]);
        } else {
          query = query.eq("status", statusFilter);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        if (statusFilter === "SCHEDULED") {
          // Filter logic specific to scheduled (Assigned to me OR Open)
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
      setErrorMsg("Could not load data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
  }, [session, statusFilter]);

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  const handleAcceptScheduledRide = async (ride: any) => {
    Alert.alert(t("acceptRide"), t("confirmSchedule"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("confirm"),
        onPress: async () => {
          // Call your accept logic here
          // For now, we just refresh
          fetchData(true);
        },
      },
    ]);
  };

  const handleCancelScheduledRide = async (ride: any) => {
    // Call your cancel logic here
    fetchData(true);
  };

  const renderFilterPill = (label: string, value: FilterType) => (
    <TouchableOpacity
      onPress={() => setStatusFilter(value)}
      style={[
        styles.filterPill,
        statusFilter === value && styles.filterPillActive,
      ]}
    >
      <Text
        style={[
          styles.filterText,
          statusFilter === value && styles.filterTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: any }) => {
    // --- CASE 1: SCHEDULED RIDE CARD ---
    if (item.status === "SCHEDULED") {
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
          <View
            style={[
              styles.rowBetween,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Calendar size={16} color="#775BD4" />
              <Text
                style={[
                  styles.dateText,
                  { color: "#775BD4", fontFamily: "Tajawal_700Bold" },
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

          <View style={styles.timeline}>
            <View
              style={[
                styles.locRow,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <MapPin size={16} color="#059669" />
              <Text
                style={[
                  styles.address,
                  { textAlign: isRTL ? "right" : "left" },
                ]}
                numberOfLines={1}
              >
                {item.pickup_address}
              </Text>
            </View>
            <View
              style={[
                styles.line,
                {
                  marginHorizontal: 7,
                  alignSelf: isRTL ? "flex-end" : "flex-start",
                },
              ]}
            />
            <View
              style={[
                styles.locRow,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <MapPin size={16} color="#dc2626" />
              <Text
                style={[
                  styles.address,
                  { textAlign: isRTL ? "right" : "left" },
                ]}
                numberOfLines={1}
              >
                {item.dropoff_address}
              </Text>
            </View>
          </View>

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
              <View
                style={[
                  styles.rowBetween,
                  { flexDirection: isRTL ? "row-reverse" : "row" },
                ]}
              >
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
                    {isMyRequest ? t("yourRequest") : t("assignedToYou")}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleCancelScheduledRide(item)}
                >
                  <Text
                    style={{
                      color: "#ef4444",
                      fontFamily: "Tajawal_700Bold",
                      fontSize: 13,
                    }}
                  >
                    {t("cancel")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      );
    }

    // --- CASE 2: STANDARD HISTORY CARD (Completed/Cancelled) ---
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate("DriverRideDetails", { ride: item })}
        style={[
          styles.card,
          {
            flexDirection: isRTL ? "row-reverse" : "row",
            alignItems: "center",
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <View
            style={[
              styles.rowBetween,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <View
              style={[
                styles.statusBadge,
                item.status === "COMPLETED"
                  ? styles.bgSuccess
                  : styles.bgDanger,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  item.status === "COMPLETED"
                    ? styles.textSuccess
                    : styles.textDanger,
                ]}
              >
                {item.status}
              </Text>
            </View>
            <Text style={styles.price}>
              {item.fare_estimate || "0"}{" "}
              <Text style={{ fontSize: 12, color: "gray" }}>DZD</Text>
            </Text>
          </View>

          <View
            style={[
              styles.dateRow,
              { flexDirection: isRTL ? "row-reverse" : "row" },
            ]}
          >
            <Clock size={14} color="gray" />
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>

          <View style={styles.timeline}>
            <View
              style={[
                styles.locRow,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <MapPin size={16} color="#059669" />
              <Text
                style={[
                  styles.address,
                  { textAlign: isRTL ? "right" : "left" },
                ]}
                numberOfLines={1}
              >
                {item.pickup_address || "Unknown Pickup"}
              </Text>
            </View>
            <View
              style={[
                styles.line,
                {
                  alignSelf: isRTL ? "flex-end" : "flex-start",
                  marginHorizontal: 7,
                },
              ]}
            />
            <View
              style={[
                styles.locRow,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              <MapPin size={16} color="#dc2626" />
              <Text
                style={[
                  styles.address,
                  { textAlign: isRTL ? "right" : "left" },
                ]}
                numberOfLines={1}
              >
                {item.dropoff_address || "Unknown Dropoff"}
              </Text>
            </View>
          </View>
        </View>

        {/* --- DIRECTION ARROW --- */}
        <View style={{ marginStart: 10 }}>
          {isRTL ? (
            <ChevronLeft size={24} color="black" />
          ) : (
            <ChevronRight size={24} color="black" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.headerContainer,
          { flexDirection: isRTL ? "row-reverse" : "row" },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ArrowLeft
            size={24}
            color="#1F2937"
            style={isRTL && { transform: [{ scaleX: -1 }] }}
          />
          <ArrowRight
            size={24}
            color="#1F2937"
            style={isRTL && { transform: [{ scaleX: 1 }] }}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("myActivity") || "My Activity"}
        </Text>
      </View>

      {/* --- UNIFIED FILTER LIST --- */}
      <View style={{ marginBottom: 10 }}>
        <FlatList
          horizontal
          data={["ALL", "SCHEDULED", "COMPLETED", "CANCELLED"] as FilterType[]}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.filterScrollContent,
            isRTL && { flexDirection: "row-reverse" },
          ]}
          renderItem={({ item }) =>
            renderFilterPill(
              t(item.toLowerCase()) ||
                item.charAt(0) + item.slice(1).toLowerCase(),
              item
            )
          }
        />
      </View>

      {/* Content List */}
      {loading && !refreshing ? (
        <ActivityIndicator
          size="large"
          color={COLORS.secondary}
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={dataList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 50 }}>
              <Text style={{ color: COLORS.gray }}>No rides found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerContainer: {
    alignItems: "center",
    marginBottom: 0, // Changed from 20 to 0 (or keep small spacing)
    paddingTop: 30,
    paddingHorizontal: 20, // <--- ADD THIS to align with ScrollView content
    backgroundColor: "#f8fafc", // Optional: ensures background matches screen if content scrolls under
    zIndex: 10, // Optional: ensures it stays on top visually
  },
  headerTitle: {
    marginTop: 30,
    fontSize: 16,
    paddingHorizontal: 10,
    color: "#1F2937",
    fontFamily: "Tajawal-Bold",
  },
  backBtn: {
    marginTop: 8,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 8,
  },

  // --- FILTER STYLES ---
  filterScrollContent: {
    paddingHorizontal: 20,
    gap: 10,
    paddingVertical: 10,
  },
  filterPill: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 8, // Standard spacing for horizontal list
  },
  filterPillActive: {
    backgroundColor: COLORS.secondary, // Purple background when active
    borderColor: COLORS.secondary,
  },
  filterText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: COLORS.gray,
  },
  filterTextActive: {
    color: "white", // White text when active
    fontFamily: "Tajawal_700Bold",
  },

  // --- CARD STYLES ---
  card: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  rowBetween: {
    justifyContent: "space-between",
    marginBottom: 10,
    alignItems: "center",
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  bgSuccess: { backgroundColor: "#dcfce7" },
  bgDanger: { backgroundColor: "#fee2e2" },
  statusText: {
    fontSize: 11,
    fontFamily: "Tajawal_700Bold",
    textTransform: "uppercase",
  },
  textSuccess: { color: "#166534" },
  textDanger: { color: "#991b1b" },
  price: { fontFamily: "Tajawal_700Bold", fontSize: 18, color: COLORS.primary },
  dateRow: { alignItems: "center", gap: 6, marginBottom: 12 },
  dateText: {
    color: COLORS.gray,
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
  },
  timeline: { gap: 0 },
  locRow: { gap: 10, alignItems: "center" },
  address: {
    fontSize: 14,
    color: COLORS.primary,
    flex: 1,
    fontFamily: "Tajawal_500Medium",
  },
  line: { height: 16, width: 2, backgroundColor: "#E5E7EB", marginVertical: 2 },

  // Scheduled-specific styles
  actionBtnPrimary: {
    backgroundColor: "#775BD4",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionBtnTextPrimary: {
    color: "white",
    fontFamily: "Tajawal_700Bold",
    fontSize: 14,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontFamily: "Tajawal_700Bold" },
});
