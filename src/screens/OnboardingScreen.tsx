import React, { useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { UserRole } from "../types";
import {
  Car,
  ArrowRight,
  Mail,
  Lock,
  Phone,
  Hash,
  ChevronDown,
  X,
  ChevronLeft,
} from "lucide-react-native";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";

// --- DATA: COMMON ALGERIAN CARS ---
const CAR_MAKES = [
  {
    make: "Renault",
    models: ["Symbol", "Clio 4", "Clio 5", "Megane", "Kangoo", "Logan"],
  },
  {
    make: "Dacia",
    models: ["Logan", "Sandero", "Stepway", "Duster"],
  },
  {
    make: "Hyundai",
    models: ["Accent", "i10", "i20", "Tucson", "Santa Fe", "Elantra", "Creta"],
  },
  {
    make: "Kia",
    models: ["Picanto", "Rio", "Sportage", "Cerato"],
  },
  {
    make: "Peugeot",
    models: ["208", "301", "308", "Partner", "2008"],
  },
  {
    make: "Volkswagen",
    models: ["Golf 7", "Golf 8", "Polo", "Caddy", "Tiguan"],
  },
  {
    make: "Seat",
    models: ["Ibiza", "Leon", "Arona"],
  },
  {
    make: "Suzuki",
    models: ["Swift", "Alto", "Dzire", "Baleno"],
  },
  {
    make: "Chevrolet",
    models: ["Sail", "Spark", "Aveo", "Optra"],
  },
  {
    make: "Toyota",
    models: ["Yaris", "Corolla", "Hilux"],
  },
  {
    make: "Chery",
    models: ["QQ", "Tiggo"],
  },
];

export default function OnboardingScreen() {
  const { t, setLanguage, language } = useLanguage();
  const [step, setStep] = useState(1); // 1 = Welcome, 2 = Form
  const [isLoginMode, setIsLoginMode] = useState(false);

  // Form State
  const [role, setRole] = useState<UserRole>("DRIVER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  // Verification State (1=Contact, 2=Vehicle, 3=OTP)
  const [signupStep, setSignupStep] = useState(1);
  const [otpCode, setOtpCode] = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // Vehicle State
  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");
  const [licensePlate, setLicensePlate] = useState("");

  // Modal State
  const [isCarModalVisible, setIsCarModalVisible] = useState(false);
  const [selectingStep, setSelectingStep] = useState<"MAKE" | "MODEL">("MAKE");

  const [loading, setLoading] = useState(false);

  // 1. CONFIGURE GOOGLE SIGN IN
  useEffect(() => {
    GoogleSignin.configure({
      webClientId:
        "934715851958-en3s6md1c1fkdd11h9p6udg0pbgeniub.apps.googleusercontent.com",
      scopes: ["email", "profile"],
    });
  }, []);

  // 2. RESEND TIMER
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // 3. GOOGLE LOGIN
  const handleGoogleLogin = async () => {
    // Basic validation for driver signup flow (Google doesn't easily support split steps without more logic)
    // For now, we allow Google login to bypass vehicle checks OR you can block it.
    // Let's assume Google is primarily for Login or basic account creation.
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      try {
        await GoogleSignin.signOut();
      } catch (e) {}
      const response = await GoogleSignin.signIn();

      if (response.data?.idToken) {
        const { idToken, user } = response.data;
        const { data: authData, error } = await supabase.auth.signInWithIdToken(
          {
            provider: "google",
            token: idToken,
          }
        );
        if (error) throw error;

        if (authData.user) {
          await AsyncStorage.setItem("driver_user_id", authData.user.id);
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("roles, role, agent_status")
            .eq("id", authData.user.id)
            .single();

          let newRoles = ["DRIVER"];
          if (existingProfile) {
            const currentRoles = existingProfile.roles || [];
            if (existingProfile.role) currentRoles.push(existingProfile.role);
            newRoles = Array.from(new Set([...currentRoles, "DRIVER"]));
          }

          const updates: any = {
            id: authData.user.id,
            full_name: user.name,
            email: user.email,
            role: "DRIVER",
            roles: newRoles,
            updated_at: new Date(),
            agent_status: existingProfile
              ? existingProfile.agent_status
              : "PENDING",
          };

          const { error: profileError } = await supabase
            .from("profiles")
            .upsert(updates, { onConflict: "id" });

          if (profileError) throw profileError;
        }
      }
    } catch (error: any) {
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert("Google Sign-In Error", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // 4. EMAIL LOGIN (Legacy)
  const handleSendVerification = async () => {
    if (!email || !password)
      return Alert.alert("Error", "Please fill in email and password.");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (data.session?.user) {
        await AsyncStorage.setItem("driver_user_id", data.session.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("roles, role")
          .eq("id", data.session.user.id)
          .single();
        const userRoles = profile?.roles || [];
        if (profile?.role) userRoles.push(profile.role);

        if (!userRoles.includes("DRIVER")) {
          Alert.alert(
            "Account Upgrade Needed",
            "This account is not registered as a driver."
          );
          await supabase.auth.signOut();
          return;
        }
      }
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneForTwilio = (inputPhone: string) => {
    let cleaned = inputPhone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) cleaned = cleaned.substring(1);
    if (!cleaned.startsWith("213")) cleaned = "213" + cleaned;
    return "+" + cleaned;
  };

  // 5. SEND OTP
  const sendOtp = async (channel: "whatsapp" | "sms") => {
    if (!phone) return Alert.alert("Error", "Please enter your phone number");
    setLoading(true);
    const formattedPhone = formatPhoneForTwilio(phone);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: { channel },
      });
      if (error) throw error;
      Alert.alert(
        "Code Sent",
        `We sent a code to ${formattedPhone} via ${
          channel === "whatsapp" ? "WhatsApp" : "SMS"
        }.`
      );
      setSignupStep(3); // Move to OTP step
      setResendTimer(30);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  // 6. VERIFY & CREATE PROFILE
  const verifyOtp = async () => {
    if (otpCode.length !== 6)
      return Alert.alert("Error", "Please enter the 6-digit code");
    setLoading(true);
    const formattedPhone = formatPhoneForTwilio(phone);

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otpCode,
        type: "sms",
      });
      if (error) throw error;

      if (user) {
        await AsyncStorage.setItem("driver_user_id", user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (!profile) {
          const newProfile = {
            id: user.id,
            role: "DRIVER",
            full_name: email ? email.split("@")[0] : "Driver",
            phone: formattedPhone,
            car_model: `${carMake} ${carModel}`.trim(), // Combined Field
            license_plate: licensePlate,
          };
          const { error: profileError } = await supabase
            .from("profiles")
            .insert(newProfile);
          if (profileError) throw profileError;
        }
        Alert.alert("Success", "Welcome to YallaDriver!");
      }
    } catch (error: any) {
      Alert.alert("Verification Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- NAVIGATION HELPERS ---
  const handleNextStep = () => {
    if (signupStep === 1) {
      // Validate Step 1
      if (!phone)
        return Alert.alert("Missing Info", "Phone number is required.");
      if (phone.length < 9)
        return Alert.alert(
          "Invalid Phone",
          "Please enter a valid phone number."
        );
      setSignupStep(2);
    } else if (signupStep === 2) {
      // Validate Step 2
      if (!carMake || !carModel)
        return Alert.alert(
          "Missing Info",
          "Please select your Car Make & Model."
        );
      if (!licensePlate)
        return Alert.alert("Missing Info", "License Plate is required.");
      // Proceed to send OTP
      sendOtp("whatsapp");
    }
  };

  const handleBackStep = () => {
    if (signupStep > 1) setSignupStep(signupStep - 1);
  };

  // --- UI RENDER: WELCOME ---
  if (step === 1) {
    return (
      <View style={styles.welcomeContainer}>
        {/* Language Switcher */}
        <SafeAreaView style={styles.langContainer}></SafeAreaView>

        <View style={styles.contentCenter}>
          <View style={styles.logoCircle}>
            <Car size={40} color="#45986cff" />
          </View>
          <Text style={styles.title}>
            Yalla<Text style={{ color: "#45986cff" }}>Driver</Text>
          </Text>
          <Text style={styles.subtitle}>
            {t("welcomeTitle") || "Drive with confidence."}
            {"\n"}Reliable rides, verified drivers.
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setStep(2)}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
          <ArrowRight color="white" size={20} />
        </TouchableOpacity>
      </View>
    );
  }

  // --- UI RENDER: FORM ---
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              {!isLoginMode && signupStep > 1 && (
                <TouchableOpacity
                  onPress={handleBackStep}
                  style={styles.miniBackBtn}
                >
                  <ChevronLeft size={24} color="#374151" />
                </TouchableOpacity>
              )}
              <Text style={styles.headerTitle}>
                {isLoginMode
                  ? "Welcome Back"
                  : signupStep === 3
                  ? "Verification"
                  : "Create Account"}
              </Text>
            </View>
            <Text style={styles.headerSub}>
              {isLoginMode
                ? "Sign in to continue earning."
                : signupStep === 1
                ? "Step 1: Contact Information"
                : signupStep === 2
                ? "Step 2: Vehicle Details"
                : "Step 3: Enter the code sent to your phone"}
            </Text>
          </View>

          <View style={styles.form}>
            {/* --- SIGN UP STEP 1: PHONE & EMAIL --- */}
            {!isLoginMode && signupStep === 1 && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Phone Number</Text>
                  <View style={styles.inputContainer}>
                    <Phone size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="0550 12 34 56"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                      value={phone}
                      onChangeText={setPhone}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email (Optional)</Text>
                  <View style={styles.inputContainer}>
                    <Mail size={20} color="#9CA3AF" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="name@example.com"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>
                </View>
              </>
            )}

            {/* --- SIGN UP STEP 2: VEHICLE DETAILS --- */}
            {!isLoginMode && signupStep === 2 && (
              <View style={styles.driverSection}>
                <View style={styles.driverHeader}>
                  <Car size={20} color="#45986cff" />
                  <Text style={styles.driverTitle}>Vehicle Details</Text>
                </View>

                {/* Make & Model Selector */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Car Make & Model</Text>
                  <TouchableOpacity
                    style={[styles.inputContainer, styles.whiteBg]}
                    onPress={() => {
                      setSelectingStep("MAKE");
                      setIsCarModalVisible(true);
                    }}
                  >
                    <Text
                      style={[
                        styles.input,
                        { textAlignVertical: "center", paddingTop: 14 },
                        !carMake && { color: "#9CA3AF" },
                      ]}
                    >
                      {carMake && carModel
                        ? `${carMake} ${carModel}`
                        : "Select Make & Model"}
                    </Text>
                    <ChevronDown
                      size={20}
                      color="#9CA3AF"
                      style={{ marginRight: 0 }}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>License Plate</Text>
                  <View style={[styles.inputContainer, styles.whiteBg]}>
                    <TextInput
                      style={styles.input}
                      placeholder="00123-116-16"
                      placeholderTextColor="#9CA3AF"
                      value={licensePlate}
                      onChangeText={setLicensePlate}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* --- SIGN UP STEP 3: OTP VERIFICATION --- */}
            {!isLoginMode && signupStep === 3 && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Verification Code</Text>
                <View style={styles.inputContainer}>
                  <Hash size={20} color="#9CA3AF" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="123456"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otpCode}
                    onChangeText={setOtpCode}
                  />
                </View>

                <View style={styles.resendContainer}>
                  <Text style={styles.helperText}>
                    Code sent to {formatPhoneForTwilio(phone)}
                  </Text>
                  {resendTimer > 0 ? (
                    <Text style={styles.timerText}>Wait {resendTimer}s</Text>
                  ) : (
                    <TouchableOpacity onPress={() => sendOtp("sms")}>
                      <Text style={styles.linkText}>Resend via SMS</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* --- LOGIN MODE --- */}
            {/* --- LOGIN MODE (Updated for Phone) --- */}
            {isLoginMode && (
              <>
                {/* STEP 1: ENTER PHONE FOR LOGIN */}
                {signupStep === 1 && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Phone Number</Text>
                    <View style={styles.inputContainer}>
                      <Phone
                        size={20}
                        color="#9CA3AF"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="0550 12 34 56"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                      />
                    </View>
                  </View>
                )}

                {/* STEP 2: VERIFY OTP FOR LOGIN */}
                {signupStep === 3 && ( // Reuse Step 3 for OTP logic
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Verification Code</Text>
                    <View style={styles.inputContainer}>
                      <Hash
                        size={20}
                        color="#9CA3AF"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="123456"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otpCode}
                        onChangeText={setOtpCode}
                      />
                    </View>
                    <View style={styles.resendContainer}>
                      {/* Reuse existing resend logic */}
                      <TouchableOpacity onPress={() => sendOtp("sms")}>
                        <Text style={styles.linkText}>Resend Code</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}

            {signupStep === 1 && (
              <View style={{ marginTop: 20 }}>
                <View style={styles.divider}>
                  <View style={styles.line} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.line} />
                </View>

                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogleLogin}
                  disabled={loading}
                >
                  <Image
                    source={{
                      uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/480px-Google_%22G%22_logo.svg.png",
                    }}
                    style={{ width: 24, height: 24 }}
                    resizeMode="contain"
                  />
                  <Text style={styles.googleButtonText}>
                    Continue with Google
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* MAIN ACTION BUTTON */}
          {/* MAIN ACTION BUTTON */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => {
                if (isLoginMode) {
                  // --- FIXED LOGIN LOGIC ---
                  // If on Step 1 (Phone Input), send the code
                  if (signupStep === 1) sendOtp("sms");
                  // If on Step 3 (OTP Input), verify the code
                  else if (signupStep === 3) verifyOtp();
                } else {
                  // --- SIGNUP LOGIC ---
                  if (signupStep === 1) handleNextStep();
                  else if (signupStep === 2)
                    handleNextStep(); // triggers sendOtp
                  else if (signupStep === 3) verifyOtp();
                }
              }}
              disabled={loading}
              style={[styles.primaryButton, loading && { opacity: 0.7 }]}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {/* Dynamic Button Text */}
                  {signupStep === 3
                    ? "Verify & Enter"
                    : isLoginMode
                    ? "Send Code"
                    : signupStep === 2
                    ? "Send Code"
                    : "Next"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Switch Button (Login <-> Signup) */}
            <TouchableOpacity
              onPress={() => {
                setIsLoginMode(!isLoginMode);
                setSignupStep(1); // Reset to Step 1
                setPhone("");
                setOtpCode("");
              }}
              style={styles.switchButton}
            >
              <Text style={styles.switchText}>
                {isLoginMode ? "New here? " : "Already have an account? "}
                <Text style={styles.switchTextBold}>
                  {isLoginMode ? "Create Account" : "Log In"}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- VEHICLE SELECTION MODAL --- */}
      <Modal
        visible={isCarModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCarModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectingStep === "MAKE"
                  ? "Select Car Make"
                  : `Select ${carMake} Model`}
              </Text>
              <TouchableOpacity
                onPress={() => setIsCarModalVisible(false)}
                style={styles.closeBtn}
              >
                <X size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.listContainer}>
              {selectingStep === "MAKE"
                ? CAR_MAKES.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.listItem}
                      onPress={() => {
                        setCarMake(item.make);
                        setSelectingStep("MODEL");
                      }}
                    >
                      <Text style={styles.listItemText}>{item.make}</Text>
                      <ChevronDown
                        size={20}
                        color="#D1D5DB"
                        style={{ transform: [{ rotate: "-90deg" }] }}
                      />
                    </TouchableOpacity>
                  ))
                : CAR_MAKES.find((m) => m.make === carMake)?.models.map(
                    (model, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.listItem}
                        onPress={() => {
                          setCarModel(model);
                          setIsCarModalVisible(false);
                        }}
                      >
                        <Text style={styles.listItemText}>{model}</Text>
                      </TouchableOpacity>
                    )
                  )}
            </ScrollView>

            {selectingStep === "MODEL" && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setSelectingStep("MAKE")}
              >
                <Text style={styles.backButtonText}>Back to Makes</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Welcome Screen
  welcomeContainer: {
    flex: 1,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 24,
  },
  langContainer: { width: "100%", alignItems: "flex-end", marginTop: 10 },
  langPill: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 50,
    padding: 4,
  },
  langBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 50 },
  langBtnActive: {
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  langText: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  langTextActive: { color: "#111827", fontWeight: "700" },

  contentCenter: { alignItems: "center", marginBottom: 40 },
  logoCircle: {
    width: 80,
    height: 80,
    backgroundColor: "#ECFDF5",
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#6B7280",
    lineHeight: 24,
  },

  // Main Form Screen
  container: { flex: 1, backgroundColor: "white" },
  scrollContent: { padding: 24, flexGrow: 1 },

  header: { marginTop: 20, marginBottom: 32 },
  miniBackBtn: {
    padding: 4,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  headerSub: { fontSize: 16, color: "#6B7280" },

  form: { marginBottom: 24 },
  inputGroup: { marginBottom: 20 }, // Increased margins for better spacing
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  whiteBg: { backgroundColor: "white" },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: "#1F2937", height: "100%" },

  // Driver Section
  driverSection: {
    backgroundColor: "#ECFDF5",
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#45986cff",
    borderStyle: "dashed",
    marginTop: 10,
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  driverTitle: { fontSize: 16, fontWeight: "700", color: "#065F46" },

  // Verification Helper
  resendContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  helperText: { fontSize: 13, color: "#6B7280" },
  timerText: { fontSize: 13, color: "#9CA3AF" },
  linkText: { fontSize: 13, color: "#45986cff", fontWeight: "600" },

  // Buttons & Footer
  footer: { marginTop: "auto" },
  primaryButton: {
    flexDirection: "row",
    backgroundColor: "#45986cff",
    height: 58,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#45986cff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    width: "100%",
    marginBottom: 60,
  },
  primaryButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },

  divider: { flexDirection: "row", alignItems: "center", marginVertical: 24 },
  line: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerText: {
    marginHorizontal: 16,
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
  },

  googleButton: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    height: 58,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  googleButtonText: { color: "#1F2937", fontSize: 16, fontWeight: "600" },

  switchButton: { alignItems: "center", padding: 10 },
  switchText: { color: "#6B7280", fontSize: 15 },
  switchTextBold: { color: "#45986cff", fontWeight: "700" },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "75%",
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#1F2937" },
  closeBtn: { padding: 8, backgroundColor: "#F3F4F6", borderRadius: 20 },
  listContainer: { paddingBottom: 40 },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  listItemText: { fontSize: 16, color: "#374151", fontWeight: "500" },
  backButton: {
    marginTop: 10,
    padding: 16,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    alignItems: "center",
  },
  backButtonText: { color: "#374151", fontWeight: "bold" },
});
