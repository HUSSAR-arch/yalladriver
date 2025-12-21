import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import { supabase } from "../lib/supabase";
import { Ban, PhoneCall, LogOut } from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";

export default function SuspendedScreen() {
  const { t, language } = useLanguage();
  const isRTL = language === "ar";
  const flexDir = isRTL ? "row-reverse" : "row";

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleContactSupport = () => {
    Linking.openURL(
      "mailto:support@yalladz.com?subject=Account Suspension Appeal"
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ban size={80} color="#EF4444" style={styles.icon} />

        <Text style={styles.title}>{t("accountSuspended")}</Text>

        <Text style={styles.message}>{t("suspendedMessage")}</Text>

        <Text style={styles.subMessage}>{t("suspendedSubMessage")}</Text>

        <TouchableOpacity
          style={[styles.contactBtn, { flexDirection: flexDir }]}
          onPress={handleContactSupport}
        >
          <PhoneCall size={20} color="white" />
          <Text style={styles.btnText}>{t("contactSupport")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.logoutBtn, { flexDirection: flexDir }]}
          onPress={handleLogout}
        >
          <LogOut size={20} color="#666" />
          <Text style={styles.logoutText}>{t("signOut")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    padding: 20,
  },
  content: {
    backgroundColor: "white",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    elevation: 5,
  },
  icon: { marginBottom: 20 },
  title: {
    fontSize: 24,
    color: "#B91C1C",
    marginBottom: 10,
    textAlign: "center",
    fontFamily: "Tajawal-Bold",
  },
  message: {
    fontSize: 16,
    color: "#374151",
    textAlign: "center",
    marginBottom: 10,
    fontFamily: "Tajawal-Medium",
    lineHeight: 24,
  },
  subMessage: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 30,
    fontFamily: "Tajawal-Regular",
    lineHeight: 20,
  },
  contactBtn: {
    backgroundColor: "#DC2626",
    padding: 16,
    borderRadius: 12,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },
  btnText: {
    color: "white",
    fontSize: 16,
    fontFamily: "Tajawal-Bold",
  },
  logoutBtn: {
    alignItems: "center",
    gap: 8,
    padding: 10,
  },
  logoutText: {
    color: "#666",
    fontSize: 16,
    fontFamily: "Tajawal-Medium",
  },
});
