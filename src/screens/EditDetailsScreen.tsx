import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  Save,
  User,
  Phone,
  Car,
  FileText,
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";

// --- RTL/LTR Styles ---
const rtlStyles = {
  flexDirectionRow: { flexDirection: "row-reverse" as const },
  textAlign: { textAlign: "right" as const },
  alignItems: { alignItems: "flex-end" as const },
  arrowTransform: { transform: [{ scaleX: -1 }] },
};

const ltrStyles = {
  flexDirectionRow: { flexDirection: "row" as const },
  textAlign: { textAlign: "left" as const },
  alignItems: { alignItems: "flex-start" as const },
  arrowTransform: {},
};

export default function EditDetailsScreen({ navigation, route }: any) {
  const { t, language } = useLanguage();
  const { profile } = route.params; // Pass existing profile data
  const isRTL = language === "ar";
  const alignStyle = isRTL ? rtlStyles : ltrStyles;

  const [loading, setLoading] = useState(false);

  // Form State
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [carModel, setCarModel] = useState(profile?.car_model || "");
  const [licensePlate, setLicensePlate] = useState(
    profile?.license_plate || ""
  );

  const handleSave = async () => {
    if (!fullName || !phone) {
      Alert.alert(t("error"), t("fillAllFields") || "Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      const updates: any = {
        full_name: fullName,
        phone: phone,
        updated_at: new Date(),
      };

      // Only update vehicle info if user is a driver
      if (profile.role === "DRIVER") {
        updates.car_model = carModel;
        updates.license_plate = licensePlate;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profile.id);

      if (error) throw error;

      Alert.alert(
        t("success"),
        t("profileUpdated") || "Profile updated successfully"
      );
      navigation.goBack(); // Go back to refresh profile
    } catch (error: any) {
      Alert.alert(t("error"), error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, alignStyle.flexDirectionRow]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, isRTL && { transform: [{ scaleX: -1 }] }]}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("editProfile") || "Edit Details"}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* PERSONAL INFO SECTION */}
          <Text style={[styles.sectionTitle, alignStyle.textAlign]}>
            {t("personalInfo") || "Personal Information"}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, alignStyle.textAlign]}>
              {t("fullName") || "Full Name"}
            </Text>
            <View style={[styles.inputWrapper, alignStyle.flexDirectionRow]}>
              <User
                size={20}
                color="#6B7280"
                style={{ marginHorizontal: 10 }}
              />
              <TextInput
                style={[styles.input, alignStyle.textAlign]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="John Doe"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, alignStyle.textAlign]}>
              {t("phoneNumber") || "Phone Number"}
            </Text>
            <View style={[styles.inputWrapper, alignStyle.flexDirectionRow]}>
              <Phone
                size={20}
                color="#6B7280"
                style={{ marginHorizontal: 10 }}
              />
              <TextInput
                style={[styles.input, alignStyle.textAlign]}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+213..."
              />
            </View>
          </View>

          {/* VEHICLE INFO SECTION (Drivers Only) */}
          {profile.role === "DRIVER" && (
            <>
              <Text
                style={[
                  styles.sectionTitle,
                  alignStyle.textAlign,
                  { marginTop: 20 },
                ]}
              >
                {t("vehicleInfo") || "Vehicle Information"}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, alignStyle.textAlign]}>
                  {t("carModel") || "Car Model"}
                </Text>
                <View
                  style={[styles.inputWrapper, alignStyle.flexDirectionRow]}
                >
                  <Car
                    size={20}
                    color="#6B7280"
                    style={{ marginHorizontal: 10 }}
                  />
                  <TextInput
                    style={[styles.input, alignStyle.textAlign]}
                    value={carModel}
                    onChangeText={setCarModel}
                    placeholder="Toyota Yaris 2020"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, alignStyle.textAlign]}>
                  {t("licensePlate") || "License Plate"}
                </Text>
                <View
                  style={[styles.inputWrapper, alignStyle.flexDirectionRow]}
                >
                  <FileText
                    size={20}
                    color="#6B7280"
                    style={{ marginHorizontal: 10 }}
                  />
                  <TextInput
                    style={[styles.input, alignStyle.textAlign]}
                    value={licensePlate}
                    onChangeText={setLicensePlate}
                    placeholder="00000-120-16"
                  />
                </View>
              </View>
            </>
          )}

          {/* SAVE BUTTON */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Save size={20} color="white" />
                <Text style={styles.saveBtnText}>
                  {t("saveChanges") || "Save Changes"}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { alignItems: "center", padding: 20, paddingTop: 10, marginTop: 30 },
  backBtn: { padding: 5, marginTop: 30 },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Tajawal-Bold",
    color: "#1F2937",
    marginHorizontal: 15,
    marginTop: 30,
  },
  content: { padding: 20 },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Tajawal-Bold",
    color: "#1F2937",
    marginBottom: 15,
  },
  inputGroup: { marginBottom: 15 },
  label: {
    fontSize: 14,
    fontFamily: "Tajawal-Medium",
    color: "#374151",
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    height: 50,
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    fontFamily: "Tajawal-Regular",
    color: "#1F2937",
    paddingHorizontal: 10,
  },
  saveBtn: {
    backgroundColor: "#45986cff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 30,
    shadowColor: "#45986cff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: "white", fontSize: 16, fontFamily: "Tajawal-Bold" },
});
