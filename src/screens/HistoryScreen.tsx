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
import { ArrowLeft, Clock, MapPin, AlertCircle } from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";

// --- RTL/LTR Configuration (Matches other screens) ---
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
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

  // 2. Fetch Data
  useEffect(() => {
    if (session?.user?.id) {
      fetchHistory();
    }
  }, [session]);

  const fetchHistory = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        // Get rides where user was driver OR passenger
        .or(
          `passenger_id.eq.${session.user.id},driver_id.eq.${session.user.id}`
        )
        .in("status", ["COMPLETED", "CANCELLED"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) setHistory(data);
    } catch (err: any) {
      console.log("History Fetch Error:", err);
      setErrorMsg(t("networkError") || "Could not load history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory(true);
  }, [session]);

  // --- Helpers ---
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
    return status;
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      {/* Top Row: Status & Price */}
      <View style={[styles.rowBetween, alignStyle.flexDirectionRow]}>
        <Text
          style={[
            styles.status,
            item.status === "COMPLETED"
              ? { color: "#45986cff" }
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

      {/* Date Row */}
      <View style={[styles.dateRow, alignStyle.flexDirectionRow]}>
        <Clock size={14} color="gray" />
        <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
      </View>

      {/* Addresses Timeline */}
      <View style={styles.timeline}>
        {/* Pickup */}
        <View style={[styles.locRow, alignStyle.flexDirectionRow]}>
          <MapPin size={16} color="#059669" />
          <Text
            style={[styles.address, alignStyle.textAlign]}
            numberOfLines={1}
          >
            {item.pickup_address || "Unknown Pickup"}
          </Text>
        </View>

        {/* Vertical Line (Conditional Margin for RTL) */}
        <View
          style={[styles.line, isRTL ? { marginRight: 7 } : { marginLeft: 7 }]}
        />

        {/* Dropoff */}
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

  return (
    <SafeAreaView style={styles.container}>
      {/* --- HEADER --- */}
      <View style={[styles.headerContainer, alignStyle.flexDirectionRow]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          // FIX: Transform applied to Container
          style={[styles.backBtn, isRTL && { transform: [{ scaleX: -1 }] }]}
        >
          <ArrowLeft size={28} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("historyTitle") || "My Rides"}
        </Text>
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
            onPress={() => fetchHistory(false)}
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={history}
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
                {!session
                  ? t("emptyNoSession")
                  : t("emptyNoRides") || "No rides yet."}
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
    marginBottom: 10,
    marginTop: 10,
    padding: 20,
  },
  headerTitle: {
    marginTop: 30,
    fontSize: 16,
    // FONT UPDATE
    fontFamily: "Tajawal-Bold",
    color: "#1F2937",
    marginHorizontal: 10,
  },
  backBtn: {
    marginTop: 30,
    padding: 5,
    marginHorizontal: 5,
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
    // FONT UPDATE
    fontFamily: "Tajawal-Bold",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  price: {
    // FONT UPDATE
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
    // FONT UPDATE
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
    // FONT UPDATE
    fontFamily: "Tajawal-Medium",
  },
  line: {
    height: 15,
    width: 2,
    backgroundColor: "#e5e7eb",
    marginVertical: 2,
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
    // FONT UPDATE
    fontFamily: "Tajawal-Regular",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 15,
    // FONT UPDATE
    fontFamily: "Tajawal-Regular",
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#e5e7eb",
    borderRadius: 20,
  },
  retryText: {
    // FONT UPDATE
    fontFamily: "Tajawal-Bold",
  },
});
