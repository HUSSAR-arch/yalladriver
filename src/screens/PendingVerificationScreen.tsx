import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronLeft, // <--- 1. ADD IMPORT
  FileText,
  LogOut,
  ShieldAlert,
  Clock,
} from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../context/LanguageContext";

type StepState = "COMPLETED" | "ACTION_REQUIRED" | "PENDING" | "LOCKED";

// --- 2. RTL STYLES HELPERS ---
const rtlStyles = {
  flexDirectionRow: { flexDirection: "row-reverse" as const },
  textAlign: { textAlign: "right" as const },
  alignItems: { alignItems: "flex-end" as const },
  iconMargin: { marginLeft: 16, marginRight: 0 }, // Swap margins for icon
  chevron: ChevronLeft,
};

const ltrStyles = {
  flexDirectionRow: { flexDirection: "row" as const },
  textAlign: { textAlign: "left" as const },
  alignItems: { alignItems: "flex-start" as const },
  iconMargin: { marginRight: 16, marginLeft: 0 },
  chevron: ChevronRight,
};

export default function PendingVerificationScreen({
  navigation,
  session,
  onCheckStatus,
}: any) {
  // --- 3. GET LANGUAGE ---
  const { t, language } = useLanguage();
  const isRTL = language === "ar";
  const alignStyle = isRTL ? rtlStyles : ltrStyles;
  const ChevronIcon = alignStyle.chevron;

  const [refreshing, setRefreshing] = useState(false);

  // Track document status
  const [docsStatus, setDocsStatus] = useState<
    "MISSING" | "PENDING" | "REJECTED" | "VERIFIED"
  >("MISSING");

  // --- 1. Check Document Status on Load ---
  const checkDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("driver_documents")
        .select("status")
        .eq("user_id", session.user.id);

      if (error) throw error;

      if (!data || data.length === 0) {
        setDocsStatus("MISSING");
      } else {
        const hasRejection = data.some((d) => d.status === "REJECTED");
        const allVerified =
          data.length > 0 && data.every((d) => d.status === "VERIFIED");

        if (hasRejection) setDocsStatus("REJECTED");
        else if (allVerified) setDocsStatus("VERIFIED");
        else setDocsStatus("PENDING");
      }
    } catch (err) {
      console.log("Error checking docs:", err);
    }
  };

  useEffect(() => {
    checkDocuments();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await checkDocuments(); // Check local doc status
    await onCheckStatus(); // Check global profile role (passed from App.tsx)
    setRefreshing(false);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- 2. Step Component Helper ---
  const RenderStep = ({
    title,
    subtitle,
    state,
    onPress,
    icon: Icon,
  }: {
    title: string;
    subtitle: string;
    state: StepState;
    onPress?: () => void;
    icon: any;
  }) => {
    const isLocked = state === "LOCKED";
    const isCompleted = state === "COMPLETED";

    return (
      <TouchableOpacity
        disabled={!onPress || isLocked}
        onPress={onPress}
        // --- 4. APPLY RTL FLEX DIRECTION ---
        style={[
          styles.stepCard,
          alignStyle.flexDirectionRow,
          isLocked && styles.stepCardLocked,
        ]}
      >
        {/* Icon Container with Dynamic Margins */}
        <View style={[styles.iconContainer, alignStyle.iconMargin]}>
          {state === "COMPLETED" ? (
            <CheckCircle2 color="#45986cff" size={28} />
          ) : state === "ACTION_REQUIRED" ? (
            <View style={styles.actionIcon}>
              <Icon color="white" size={18} />
            </View>
          ) : state === "PENDING" ? (
            <Clock color="#F59E0B" size={28} />
          ) : (
            <Circle color="#9CA3AF" size={28} />
          )}
          <View
            style={[
              styles.line,
              isCompleted && { backgroundColor: "#45986cff" },
            ]}
          />
        </View>

        {/* Text Container with Dynamic Alignment */}
        <View style={[styles.textContainer, alignStyle.alignItems]}>
          <Text
            style={[
              styles.stepTitle,
              alignStyle.textAlign,
              isLocked && styles.textLocked,
            ]}
          >
            {title}
          </Text>
          <Text style={[styles.stepSubtitle, alignStyle.textAlign]}>
            {subtitle}
          </Text>
        </View>

        {state === "ACTION_REQUIRED" && (
          // --- 5. DYNAMIC CHEVRON ---
          <ChevronIcon color="#45986cff" size={24} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <ShieldAlert size={48} color="#45986cff" />
          <Text style={styles.headerTitle}>
            {t("verificationPending") || "Verification Required"}
          </Text>
          <Text style={[styles.headerSub, { textAlign: "center" }]}>
            {t("verificationMsg") ||
              "Complete these steps to activate your driver account."}
          </Text>
        </View>

        <View style={styles.stepsContainer}>
          {/* STEP 1: ACCOUNT CREATED */}
          <RenderStep
            title={t("accountCreated") || "Account Created"}
            subtitle="Your profile is set up."
            state="COMPLETED"
            icon={CheckCircle2}
          />

          {/* STEP 2: DOCUMENTS */}
          <RenderStep
            title={t("myDocuments") || "Upload Documents"}
            subtitle={
              docsStatus === "MISSING"
                ? "ID, License, and Vehicle photos required."
                : docsStatus === "REJECTED"
                ? "Some documents were rejected. Tap to fix."
                : "Documents submitted and under review."
            }
            state={
              docsStatus === "VERIFIED"
                ? "COMPLETED"
                : docsStatus === "PENDING"
                ? "PENDING"
                : "ACTION_REQUIRED" // Missing or Rejected
            }
            onPress={() => navigation.navigate("MyDocuments", { session })}
            icon={FileText}
          />

          {/* STEP 3: ADMIN APPROVAL */}
          <RenderStep
            title={t("statusWaitingApproval") || "Admin Approval"}
            subtitle={
              docsStatus === "VERIFIED"
                ? "Finalizing account activation..."
                : "We will review your account once documents are uploaded."
            }
            state={docsStatus === "VERIFIED" ? "PENDING" : "LOCKED"}
            icon={ShieldAlert}
          />
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {t("refreshTip") ||
              "Status updates automatically. Pull down to refresh manually."}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.logoutBtn, alignStyle.flexDirectionRow]}
        >
          <LogOut size={20} color="#EF4444" />
          <Text style={styles.logoutText}>{t("signOut") || "Sign Out"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 24, paddingBottom: 40 },

  header: { alignItems: "center", marginBottom: 40, marginTop: 20 },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Tajawal-Bold",
    color: "#1F2937",
    marginTop: 16,
  },
  headerSub: {
    fontSize: 16,
    fontFamily: "Tajawal-Regular",
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
  },

  stepsContainer: { gap: 0 },

  stepCard: {
    // REMOVED fixed flexDirection: 'row' here, handled dynamically above
    alignItems: "flex-start",
    marginBottom: 0,
    minHeight: 100,
  },
  stepCardLocked: { opacity: 0.5 },

  iconContainer: {
    alignItems: "center",
    // REMOVED fixed marginRight here, handled dynamically above
    width: 30,
  },
  actionIcon: {
    backgroundColor: "#45986cff",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: "#E5E7EB",
    marginTop: 8,
    marginBottom: 8,
  },

  textContainer: { flex: 1, paddingTop: 2 },
  stepTitle: {
    fontSize: 18,
    fontFamily: "Tajawal-Bold",
    color: "#1F2937",
    marginBottom: 4,
  },
  textLocked: { color: "#9CA3AF" },
  stepSubtitle: {
    fontSize: 14,
    fontFamily: "Tajawal-Regular",
    color: "#6B7280",
    lineHeight: 20,
  },

  infoBox: {
    backgroundColor: "#EFF6FF",
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    marginBottom: 30,
  },
  infoText: {
    color: "#3B82F6",
    textAlign: "center",
    fontFamily: "Tajawal-Medium",
  },

  logoutBtn: {
    // REMOVED fixed flexDirection here
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    padding: 16,
    backgroundColor: "#FEF2F2",
    borderRadius: 50,
  },
  logoutText: { color: "#EF4444", fontFamily: "Tajawal-Bold", fontSize: 16 },
});
