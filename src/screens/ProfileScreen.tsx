import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { supabase } from "../lib/supabase";
import {
  User,
  Phone,
  LogOut,
  Car,
  Shield,
  Mail,
  AlertCircle,
  ArrowLeft,
  Star,
  FileText,
  Settings,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Edit, // Added Edit Icon
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

// --- RTL Styles ---
const rtlStyles = {
  flexDirectionRow: { flexDirection: "row-reverse" as const },
  textAlign: { textAlign: "right" as const },
  alignItems: { alignItems: "flex-end" as const },
  iconMargin: { marginLeft: 10 },
  arrowTransform: { transform: [{ scaleX: -1 }] },
};

const ltrStyles = {
  flexDirectionRow: { flexDirection: "row" as const },
  textAlign: { textAlign: "left" as const },
  alignItems: { alignItems: "flex-start" as const },
  iconMargin: { marginRight: 10 },
  arrowTransform: {},
};

export default function ProfileScreen({ navigation, route }: any) {
  const { t, language, setLanguage } = useLanguage();
  const paramsSession = route.params?.session;
  const [session, setSession] = useState<any>(paramsSession);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isRTL = language === "ar";
  const alignStyle = isRTL ? rtlStyles : ltrStyles;

  useEffect(() => {
    if (!session) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setSession(data.session);
        else setLoading(false);
      });
    }
  }, []);

  useEffect(() => {
    if (session?.user?.id) getProfile();
  }, [session]);

  const getProfile = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      setErrorMsg(t("networkError") || "Could not load profile.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    getProfile(true);
  }, [session]);

  const handleSignOut = async () => {
    Alert.alert(
      t("signOut") || "Sign Out",
      t("signOutConfirm") || "Are you sure you want to sign out?",
      [
        { text: t("cancel") || "Cancel", style: "cancel" },
        {
          text: t("signOut") || "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              try {
                await GoogleSignin.signOut();
              } catch (e) {}
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
            } catch (error: any) {
              Alert.alert(t("error"), error.message);
            }
          },
        },
      ]
    );
  };

  // --- Reusable Stat Component ---
  const StatItem = ({ label, value, icon }: any) => (
    <View style={styles.statItem}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  // --- Reusable Menu Component ---
  const MenuItem = ({ icon: Icon, label, onPress, color = "#374151" }: any) => (
    <TouchableOpacity
      style={[styles.menuItem, alignStyle.flexDirectionRow]}
      onPress={onPress}
    >
      <View
        style={[
          styles.menuIconBox,
          isRTL ? { marginLeft: 15 } : { marginRight: 15 },
        ]}
      >
        <Icon size={20} color={color} />
      </View>
      <Text style={[styles.menuText, alignStyle.textAlign, { color }]}>
        {label}
      </Text>
      {isRTL ? (
        <ChevronLeft size={20} color="#9ca3af" />
      ) : (
        <ChevronRight size={20} color="#9ca3af" />
      )}
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFC107" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#FFC107"]}
          />
        }
      >
        {/* --- Header --- */}
        <View style={[styles.headerContainer, alignStyle.flexDirectionRow]}>
          <TouchableOpacity
            onPress={() =>
              navigation.canGoBack()
                ? navigation.goBack()
                : navigation.navigate("DriverHome")
            }
            style={[styles.backBtn, isRTL && { transform: [{ scaleX: -1 }] }]}
          >
            <ArrowLeft size={28} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t("profileTitle") || "My Profile"}
          </Text>
        </View>

        {errorMsg ? (
          <View style={styles.errorContainer}>
            <AlertCircle color="#ef4444" size={32} />
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity
              onPress={() => getProfile(false)}
              style={styles.retryBtn}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* --- 1. User Card --- */}
            <View style={[styles.card, alignStyle.flexDirectionRow]}>
              <View style={styles.avatarContainer}>
                <User size={30} color="white" />
              </View>

              <View
                style={[
                  styles.detailsContainer,
                  { alignItems: isRTL ? "flex-end" : "flex-start" },
                ]}
              >
                {/* Name & Edit Row */}
                <View style={[styles.nameRow, alignStyle.flexDirectionRow]}>
                  <Text style={styles.name}>
                    {profile?.full_name || "Unknown User"}
                  </Text>
                  <TouchableOpacity
                    style={styles.editIconBtn}
                    onPress={() =>
                      navigation.navigate("EditDetailsScreen", { profile })
                    }
                  >
                    <Edit size={20} color="#45986cff" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.row, alignStyle.flexDirectionRow]}>
                  <Phone size={14} color="gray" />
                  <Text style={styles.subText}>
                    {profile?.phone || t("noPhone") || "No Phone"}
                  </Text>
                </View>
                {profile?.email && (
                  <View style={[styles.row, alignStyle.flexDirectionRow]}>
                    <Mail size={14} color="gray" />
                    <Text style={styles.subText}>{profile.email}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* --- 2. Statistics Bar --- */}
            <View style={[styles.statsContainer, alignStyle.flexDirectionRow]}>
              <StatItem
                icon={
                  <Star size={18} color="#eab308" style={{ marginBottom: 4 }} />
                }
                // CHANGE THIS LINE:
                value={
                  profile?.average_rating
                    ? Number(profile.average_rating).toFixed(1)
                    : "5.0"
                }
                label={t("rating") || "Rating"}
              />
              <View style={styles.statDivider} />
              <StatItem
                icon={
                  <Car size={18} color="#3b82f6" style={{ marginBottom: 4 }} />
                }
                value={profile?.total_rides || "0"}
                label={t("rides") || "Rides"}
              />
              <View style={styles.statDivider} />
              <StatItem
                icon={
                  <Shield
                    size={18}
                    color="#45986cff"
                    style={{ marginBottom: 4 }}
                  />
                }
                value="100%"
                label={t("acceptance") || "Acceptance"}
              />
            </View>

            {/* --- 3. Vehicle Info --- */}
            {profile?.role === "DRIVER" && (
              <View style={[styles.infoBox, alignStyle.flexDirectionRow]}>
                <Car size={24} color="#45986cff" />
                <View
                  style={{
                    flex: 1,
                    alignItems: isRTL ? "flex-end" : "flex-start",
                    paddingHorizontal: 10,
                  }}
                >
                  <Text style={styles.infoTitle}>
                    {t("vehicleInfo") || "Vehicle Details"}
                  </Text>
                  <Text style={styles.infoText}>
                    {profile?.car_model || "No Model"} •{" "}
                    {profile?.license_plate || "No Plate"}
                  </Text>
                </View>
              </View>
            )}

            {/* --- 4. Menu Actions --- */}
            <View style={styles.menuContainer}>
              <MenuItem
                icon={FileText}
                label={t("myDocuments")}
                onPress={() => navigation.navigate("MyDocuments", { session })}
              />
              <MenuItem
                icon={Settings}
                label={t("settings") || "Settings"}
                onPress={() => navigation.navigate("Settings", { session })} // <--- UPDATE THIS LINE
              />
              <MenuItem
                icon={HelpCircle}
                label={t("support") || "Help & Support"}
                onPress={() =>
                  Alert.alert("Support", "Contact support@yassir.com")
                }
              />
            </View>

            {/* --- 5. Admin & Logout --- */}
            {profile?.role === "ADMIN" && (
              <TouchableOpacity
                onPress={() => navigation.navigate("AdminConsole")}
                style={[styles.adminBtn, alignStyle.flexDirectionRow]}
              >
                <Shield size={20} color="white" />
                <Text style={styles.adminText}>
                  {t("openAdminConsole") || "Admin Console"}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleSignOut}
              style={[styles.logoutBtn, alignStyle.flexDirectionRow]}
            >
              <LogOut size={20} color="#7e7e7eff" />
              <Text style={styles.logoutText}>{t("signOut") || "Log Out"}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerContainer: { alignItems: "center", marginBottom: 20, marginTop: 10 },
  headerTitle: {
    marginTop: 30,
    fontSize: 16,
    paddingHorizontal: 10,
    color: "#1F2937",
    fontFamily: "Tajawal-Bold",
  },
  backBtn: { marginTop: 30, padding: 5 },

  // Card
  card: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    backgroundColor: "white",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1F2937",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 15,
  },
  detailsContainer: { padding: 5, flex: 1, justifyContent: "center" },
  nameRow: { alignItems: "center", marginBottom: 4, gap: 8 },
  name: { fontSize: 16, color: "#111", fontFamily: "Tajawal-Bold" },
  editIconBtn: {
    paddingHorizontal: 4,
    backgroundColor: "#f3e8ff",
    borderRadius: 12,
  }, // New Edit Button Style

  row: { alignItems: "center", gap: 6, marginTop: 2 },
  subText: { color: "#6b7280", fontSize: 13, fontFamily: "Tajawal-Medium" },

  // Stats
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    justifyContent: "space-around",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: { alignItems: "center", flex: 1 },
  statValue: { fontSize: 16, fontFamily: "Tajawal-Bold", color: "#1F2937" },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "Tajawal-Regular",
    marginTop: 2,
  },
  statDivider: { width: 1, height: "80%", backgroundColor: "#e5e7eb" },

  // Info Box
  infoBox: {
    backgroundColor: "#f0fff5ff",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#45986cff",
  },
  infoTitle: {
    color: "#45986cff",
    fontSize: 13,
    marginBottom: 2,
    fontFamily: "Tajawal-Bold",
  },
  infoText: { color: "#45986cff", fontSize: 15, fontFamily: "Tajawal-Bold" },

  // Menu Items
  menuContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    elevation: 2,
  },
  menuItem: {
    padding: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  menuText: { flex: 1, fontSize: 16, fontFamily: "Tajawal-Bold" },

  // Buttons
  adminBtn: {
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },
  adminText: { color: "white", fontSize: 16, fontFamily: "Tajawal-Bold" },
  logoutBtn: {
    backgroundColor: "#ffffffff",
    padding: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginBottom: 30,
  },
  logoutText: { color: "#707070ff", fontSize: 16, fontFamily: "Tajawal-Bold" },

  // Error
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    marginTop: 50,
  },
  errorText: {
    color: "#ef4444",
    marginVertical: 10,
    textAlign: "center",
    fontFamily: "Tajawal-Regular",
  },
  retryBtn: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: { fontFamily: "Tajawal-Bold", color: "#1F2937" },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16, // Matches standard item padding
    justifyContent: "space-between",
  },
  langSwitchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  langDivider: {
    width: 1,
    height: 16,
    backgroundColor: "#d1d5db",
    marginHorizontal: 2,
  },
  langBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  langBtnActive: {
    backgroundColor: "white",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  langText: {
    fontSize: 13,
    color: "#6b7280",
    fontFamily: "Tajawal-Medium",
  },
  langTextActive: {
    color: "#1F2937",
    fontFamily: "Tajawal-Bold",
  },
});
