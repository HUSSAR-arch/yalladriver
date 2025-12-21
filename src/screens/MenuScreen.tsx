import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  LogOut,
  User,
  X,
  Map as MapIcon,
  Clock,
  Wallet,
  ShieldCheck,
} from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../context/LanguageContext";

interface MenuScreenParams {
  session: any;
}

export default function MenuScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();

  // Get language state
  const { t, language, setLanguage } = useLanguage();

  const params = route.params as MenuScreenParams;
  const session = params?.session;
  const email = session?.user?.email || "Driver";

  // --- RTL LOGIC ---
  const isAr = language === "ar";
  const flexDir = isAr ? "row-reverse" : "row";
  const textAlign = isAr ? "right" : "left";
  // Align Close button to the starting edge (Left for EN, Right for AR)
  const closeBtnAlign = isAr ? "flex-end" : "flex-start";

  const handleNavigation = (screenName: string) => {
    navigation.goBack();
    // Navigate to the Tab or Stack screen
    navigation.navigate(screenName);
  };

  // --- REUSABLE COMPONENT: MENU ITEM ---
  const MenuItem = ({
    icon: IconComponent,
    label,
    onPress,
  }: {
    icon: any;
    label: string;
    onPress: () => void;
  }) => {
    return (
      <TouchableOpacity
        style={[styles.menuItem, { flexDirection: flexDir }]}
        onPress={onPress}
      >
        <IconComponent size={24} color="#45986cff" />
        <Text style={[styles.menuItemText, { textAlign }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Pressable style={styles.overlay} onPress={() => navigation.goBack()}>
      <Pressable
        style={styles.sheetContainer}
        onPress={(e) => e.stopPropagation()}
      >
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          {/* HEADER: Close Button */}
          <View style={[styles.headerBtnRow, { alignItems: closeBtnAlign }]}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.closeBtn}
            >
              <X size={28} color="#45986cff" />
            </TouchableOpacity>
          </View>

          {/* LANGUAGE SWITCHER */}

          {/* PROFILE INFO */}

          <View style={styles.divider} />

          {/* MENU ITEMS LIST */}
          <ScrollView contentContainerStyle={styles.menuItemsContainer}>
            <MenuItem
              icon={MapIcon}
              label={t("tabMap") || "Map"}
              onPress={() => handleNavigation("DriverHome")}
            />
            <MenuItem
              icon={Clock}
              label={t("tabEarnings") || "Earnings & History"}
              onPress={() => handleNavigation("History")}
            />
            <MenuItem
              icon={Wallet}
              label={t("wallet") || "Wallet"}
              onPress={() => handleNavigation("Wallet")}
            />
            <MenuItem
              icon={User}
              label={t("tabProfile") || "Profile"}
              onPress={() => handleNavigation("Profile")}
            />
          </ScrollView>
        </SafeAreaView>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheetContainer: {
    height: "100%",
    backgroundColor: "white",
    width: "100%",
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  headerBtnRow: { marginBottom: 10 },
  closeBtn: {
    padding: 8,
    marginTop: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 20,
  },
  profileInfoContainer: {
    alignItems: "center",
    gap: 15,
    marginBottom: 25,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  avatar: {
    backgroundColor: "#111827", // Driver Dark Theme
    borderRadius: 25,
    padding: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
    // --- FONT: Medium ---
    fontFamily: "Tajawal-Medium",
  },
  emailText: {
    fontSize: 13,
    color: "#333",
    fontWeight: "bold",
    // --- FONT: Bold ---
    fontFamily: "Tajawal-Bold",
  },
  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginBottom: 15,
  },
  menuItemsContainer: { paddingBottom: 10 },
  menuItem: {
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 10,
    gap: 15,
  },
  menuItemText: {
    fontSize: 24,
    color: "#45986cff",
    flex: 1,
    // --- FONT: Medium ---
    fontFamily: "Tajawal-Bold",
  },
  footer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    marginBottom: 20,
  },
  logoutBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderColor: "#D9534F",
    borderWidth: 1,
    borderRadius: 50,
    gap: 10,
  },
  logoutText: {
    color: "#D9534F",
    fontSize: 15,
    // --- FONT: Bold ---
    fontFamily: "Tajawal-Bold",
  },
  langSwitchContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    alignSelf: "center",
  },
  langDivider: {
    width: 1,
    height: "60%",
    backgroundColor: "#e7e7e7ff",
    marginHorizontal: 5,
  },
  langBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  langBtnActive: {
    backgroundColor: "white",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  langText: {
    fontSize: 12,
    color: "#666",
    // --- FONT: Regular ---
    fontFamily: "Tajawal-Regular",
  },
  langTextActive: {
    color: "#333",
    fontWeight: "bold",
    // --- FONT: Bold ---
    fontFamily: "Tajawal-Bold",
  },
});
