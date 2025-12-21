import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
  Linking,
  Modal,
  Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  Globe,
  Bell,
  Navigation,
  Shield,
  FileText,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Smartphone,
  Check,
  X,
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

// --- RTL/LTR HELPER STYLES ---
const rtlStyles = {
  flexDirectionRow: { flexDirection: "row-reverse" as const },
  textAlign: { textAlign: "right" as const },
  alignItems: { alignItems: "flex-end" as const },
  chevron: ChevronLeft,
};

const ltrStyles = {
  flexDirectionRow: { flexDirection: "row" as const },
  textAlign: { textAlign: "left" as const },
  alignItems: { alignItems: "flex-start" as const },
  chevron: ChevronRight,
};

export default function SettingsScreen({ navigation, route }: any) {
  const { t, language, setLanguage } = useLanguage();
  const isRTL = language === "ar";
  const alignStyle = isRTL ? rtlStyles : ltrStyles;
  const ChevronIcon = alignStyle.chevron;

  // --- STATE ---
  const [activeModal, setActiveModal] = useState<"NONE" | "LANGUAGE" | "MAP">(
    "NONE"
  );
  const [mapApp, setMapApp] = useState("google"); // 'google' | 'waze'
  const [pushEnabled, setPushEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  // --- DATA OPTIONS ---
  const languageOptions = [
    { id: "en", label: "English", subLabel: "English" },
    { id: "fr", label: "French", subLabel: "Français" }, // << Added French
    { id: "ar", label: "Arabic", subLabel: "العربية" },
  ];

  const mapOptions = [
    { id: "google", label: "Google Maps" },
    { id: "waze", label: "Waze" },
  ];

  // Load preferences on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedMap = await AsyncStorage.getItem("preferred_map_app");
      if (savedMap) setMapApp(savedMap);
    } catch (e) {
      console.log("Error loading settings", e);
    }
  };

  // --- HANDLERS ---
  const handleMapSelect = async (id: string) => {
    setMapApp(id);
    await AsyncStorage.setItem("preferred_map_app", id);
    setActiveModal("NONE");
  };

  const handleLanguageSelect = (id: string) => {
    setLanguage(id);
    setActiveModal("NONE");
  };

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
              await GoogleSignin.signOut().catch(() => {});
              await supabase.auth.signOut();
              // Navigation is handled automatically by Auth Listener in App.tsx
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t("deleteAccount") || "Delete Account",
      t("deleteAccountWarning") ||
        "This action is permanent. All your data will be erased. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // Placeholder: Add actual suppression logic or API call here
            Alert.alert(
              "Request Sent",
              "Your account deletion request has been submitted to support."
            );
          },
        },
      ]
    );
  };

  // --- INTERNAL COMPONENT: SELECTION MODAL ---
  const SelectionModal = ({
    visible,
    title,
    options,
    selectedId,
    onSelect,
    onClose,
  }: any) => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={styles.modalContent}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.modalHeader, alignStyle.flexDirectionRow]}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <View style={styles.optionsList}>
            {options.map((item: any) => {
              const isSelected = item.id === selectedId;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.optionItem, alignStyle.flexDirectionRow]}
                  onPress={() => onSelect(item.id)}
                >
                  <View
                    style={{
                      flex: 1,
                      alignItems: isRTL ? "flex-end" : "flex-start",
                    }}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        isSelected && styles.optionLabelSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.subLabel && (
                      <Text style={styles.optionSubLabel}>{item.subLabel}</Text>
                    )}
                  </View>
                  {isSelected && (
                    <View style={styles.checkCircle}>
                      <Check size={16} color="white" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // --- INTERNAL COMPONENT: SETTING ITEM ---
  const SettingItem = ({
    icon: Icon,
    label,
    value,
    type = "link", // 'link' | 'toggle'
    onToggle,
    onPress,
    isDestructive = false,
  }: any) => (
    <TouchableOpacity
      activeOpacity={type === "toggle" ? 1 : 0.7}
      onPress={type === "toggle" ? onToggle : onPress}
      style={[styles.itemContainer, alignStyle.flexDirectionRow]}
    >
      <View
        style={[
          styles.iconBox,
          { backgroundColor: isDestructive ? "#fee2e2" : "#f3f4f6" },
        ]}
      >
        <Icon size={20} color={isDestructive ? "#ef4444" : "#1F2937"} />
      </View>

      <View
        style={[
          styles.textContainer,
          { alignItems: isRTL ? "flex-end" : "flex-start" },
        ]}
      >
        <Text
          style={[styles.itemLabel, isDestructive && styles.destructiveText]}
        >
          {label}
        </Text>
        {value && type !== "toggle" && (
          <Text style={styles.itemValue}>{value}</Text>
        )}
      </View>

      <View style={styles.actionContainer}>
        {type === "toggle" ? (
          <Switch
            trackColor={{ false: "#767577", true: "#FFC107" }}
            thumbColor={value ? "#f4f3f4" : "#f4f3f4"}
            onValueChange={onToggle}
            value={value}
          />
        ) : (
          <ChevronIcon size={20} color="#9ca3af" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={[styles.headerContainer, alignStyle.flexDirectionRow]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, isRTL && { transform: [{ scaleX: -1 }] }]}
        >
          <ArrowLeft size={28} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("settings") || "Settings"}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* SECTION 1: PREFERENCES */}
        <Text style={[styles.sectionHeader, alignStyle.textAlign]}>
          {t("preferences") || "Preferences"}
        </Text>
        <View style={styles.sectionCard}>
          {/* Language Selection */}
          {/* Language Selection */}
          <SettingItem
            icon={Globe}
            label={t("language") || "Language"}
            value={
              language === "ar"
                ? "العربية"
                : language === "fr"
                ? "Français"
                : "English"
            }
            onPress={() => setActiveModal("LANGUAGE")}
          />
          <View style={styles.divider} />

          {/* Navigation App Selection */}
          <SettingItem
            icon={Navigation}
            label={t("navigationApp") || "Navigation App"}
            value={mapApp === "google" ? "Google Maps" : "Waze"}
            onPress={() => setActiveModal("MAP")}
          />
          <View style={styles.divider} />

          {/* Notifications Toggle */}
          <SettingItem
            icon={Bell}
            label={t("pushNotifications") || "Notifications"}
            type="toggle"
            value={pushEnabled}
            onToggle={() => setPushEnabled(!pushEnabled)}
          />
        </View>

        {/* SECTION 2: SUPPORT & LEGAL */}
        <Text style={[styles.sectionHeader, alignStyle.textAlign]}>
          {t("support") || "Support & Legal"}
        </Text>
        <View style={styles.sectionCard}>
          <SettingItem
            icon={Shield}
            label={t("privacyPolicy") || "Privacy Policy"}
            onPress={() => Linking.openURL("https://yassir.com/privacy")}
          />
          <View style={styles.divider} />

          <SettingItem
            icon={FileText}
            label={t("termsOfService") || "Terms of Service"}
            onPress={() => Linking.openURL("https://yassir.com/terms")}
          />
          <View style={styles.divider} />

          <SettingItem
            icon={Smartphone}
            label={t("appVersion") || "App Version"}
            value="v1.0.0"
            onPress={() => {}}
          />
        </View>

        {/* SECTION 3: ACCOUNT ACTIONS */}
        <Text style={[styles.sectionHeader, alignStyle.textAlign]}>
          {t("account") || "Account"}
        </Text>
        <View style={styles.sectionCard}>
          <SettingItem
            icon={LogOut}
            label={t("signOut") || "Sign Out"}
            onPress={handleSignOut}
            isDestructive={true}
          />
          <View style={styles.divider} />
          <SettingItem
            icon={Trash2}
            label={t("deleteAccount") || "Delete Account"}
            onPress={handleDeleteAccount}
            isDestructive={true}
          />
        </View>

        <Text style={styles.footerText}>
          Yalla Driver ID: {route.params?.session?.user?.id.slice(0, 8)}...
        </Text>
      </ScrollView>

      {/* --- RENDER MODALS --- */}
      <SelectionModal
        visible={activeModal === "LANGUAGE"}
        title={t("selectLanguage") || "Select Language"}
        options={languageOptions}
        selectedId={language}
        onSelect={handleLanguageSelect}
        onClose={() => setActiveModal("NONE")}
      />

      <SelectionModal
        visible={activeModal === "MAP"}
        title={t("selectMapApp") || "Preferred Navigation"}
        options={mapOptions}
        selectedId={mapApp}
        onSelect={handleMapSelect}
        onClose={() => setActiveModal("NONE")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  headerContainer: {
    alignItems: "center",
    marginBottom: 10,
    marginTop: 10,
    paddingHorizontal: 20,
  },
  backBtn: {
    padding: 5,
    marginTop: 30,
  },
  headerTitle: {
    marginTop: 30,
    fontSize: 18,
    fontFamily: "Tajawal-Bold",
    color: "#1F2937",
    marginHorizontal: 15,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: "Tajawal-Bold",
    color: "#6b7280",
    marginBottom: 10,
    marginTop: 10,
    textTransform: "uppercase",
  },
  sectionCard: {
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemContainer: {
    padding: 16,
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
  },
  textContainer: {
    flex: 1,
    marginHorizontal: 10,
  },
  itemLabel: {
    fontSize: 16,
    fontFamily: "Tajawal-Medium",
    color: "#1F2937",
  },
  itemValue: {
    fontSize: 13,
    fontFamily: "Tajawal-Regular",
    color: "#6b7280",
    marginTop: 2,
  },
  actionContainer: {
    minWidth: 30,
    alignItems: "center",
  },
  destructiveText: {
    color: "#ef4444",
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginLeft: 56, // indent past icon
  },
  footerText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 12,
    fontFamily: "Tajawal-Regular",
    marginTop: 20,
  },

  // --- MODAL STYLES ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Tajawal-Bold",
    color: "#1F2937",
  },
  closeBtn: {
    padding: 5,
    backgroundColor: "#f3f4f6",
    borderRadius: 15,
  },
  optionsList: {
    gap: 10,
  },
  optionItem: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  optionLabel: {
    fontSize: 16,
    fontFamily: "Tajawal-Medium",
    color: "#374151",
  },
  optionLabelSelected: {
    fontFamily: "Tajawal-Bold",
    color: "#45986cff",
  },
  optionSubLabel: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
    fontFamily: "Tajawal-Regular",
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#45986cff",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
  },
});
