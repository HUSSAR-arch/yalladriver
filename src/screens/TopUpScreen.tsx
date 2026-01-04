import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Keyboard,
  Vibration,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  ArrowRight,
  Wallet,
  CheckCircle2,
  Copy,
  X,
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";

// --- PRESET AMOUNTS ---
const PRESETS = [500, 1000, 2000, 5000];

export default function TopUpScreen({ navigation }: any) {
  const { t, language } = useLanguage();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [voucher, setVoucher] = useState<{ code: string; id: string } | null>(
    null
  );
  const [isScanned, setIsScanned] = useState(false);

  const isRTL = language === "ar";
  const flexDir = isRTL ? "row-reverse" : "row";
  const textAlign = isRTL ? "right" : "left";

  // 1. Generate Code
  const handleGenerate = async () => {
    const value = parseInt(amount);
    if (!value || value < 100) {
      Alert.alert(t("error"), "Minimum amount is 100 DZD");
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      const { data, error } = await supabase.rpc("create_user_voucher", {
        amount_input: value,
      });

      if (error) throw error;

      if (data.success) {
        setVoucher({ code: data.code, id: data.id });
      } else {
        Alert.alert("Error", data.message);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Listen for Agent Scan
  useEffect(() => {
    if (!voucher) return;

    const channel = supabase
      .channel(`voucher_watch:${voucher.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "vouchers",
          filter: `id=eq.${voucher.id}`,
        },
        (payload) => {
          const updated = payload.new;
          if (updated.is_redeemed === true) {
            Vibration.vibrate();
            setIsScanned(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [voucher]);

  const handlePresetPress = (val: number) => {
    setAmount(val.toString());
    Keyboard.dismiss();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* --- HEADER (Matches WalletScreen) --- */}
      <View style={[styles.headerContainer, { flexDirection: flexDir }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          {isRTL ? (
            <ArrowRight size={24} color="#1F2937" />
          ) : (
            <ArrowLeft size={24} color="#1F2937" />
          )}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("topUp") || "Deposit Cash"}</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {isScanned ? (
            // --- SUCCESS STATE ---
            <View style={styles.card}>
              <View style={styles.successIconBox}>
                <CheckCircle2 size={60} color="#166534" />
              </View>
              <Text style={styles.successTitle}>
                {t("success") || "Success!"}
              </Text>
              <Text style={styles.successText}>
                {amount} DZD {t("addedToWallet") || "has been added to your wallet."}
              </Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.primaryBtnText}>{t("done") || "Done"}</Text>
              </TouchableOpacity>
            </View>
          ) : voucher ? (
            // --- QR CODE STATE ---
            <View style={styles.card}>
              <Text style={styles.instructionText}>{t("scanInstruction")}</Text>
              
              <View style={styles.ticketContainer}>
                <View style={styles.qrWrapper}>
                  <QRCode value={voucher.code} size={180} />
                </View>
                <View style={styles.ticketDivider} />
                <View style={styles.codeRow}>
                  <Text style={styles.codeLabel}>CODE:</Text>
                  <Text style={styles.codeValue}>{voucher.code}</Text>
                </View>
              </View>

              <Text style={styles.amountDisplay}>
                {amount} <Text style={{ fontSize: 20 }}>DZD</Text>
              </Text>

              <View style={styles.loadingRow}>
                <ActivityIndicator color="#45986cff" size="small" />
                <Text style={styles.waitingText}>{t("waitingScan")}</Text>
              </View>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setVoucher(null);
                  setAmount("");
                }}
              >
                <X size={18} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={styles.cancelText}>{t("cancel")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // --- INPUT STATE ---
            <View style={styles.inputWrapper}>
              
              <View style={styles.inputCard}>
                <View style={styles.iconCircle}>
                  <Wallet size={32} color="#45986cff" />
                </View>
                
                <Text style={styles.label}>
                  {t("enterAmount") || "Amount to Deposit"}
                </Text>
                
                <View style={[styles.inputRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <TextInput
                    style={[styles.input, { textAlign: 'center' }]}
                    placeholder="0"
                    placeholderTextColor="#d1d5db"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                    autoFocus
                  />
                  <Text style={styles.currencySuffix}>DZD</Text>
                </View>

                {/* Quick Presets */}
                <View style={[styles.presetContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  {PRESETS.map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={styles.presetChip}
                      onPress={() => handlePresetPress(val)}
                    >
                      <Text style={styles.presetText}>{val}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                  onPress={handleGenerate}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {t("generateCode") || "Generate Code"}
                    </Text>
                  )}
                </TouchableOpacity>
                <Text style={styles.note}>{t("paymentNote")}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  
  // Header matched to WalletScreen
  headerContainer: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: "#f8fafc",
    zIndex: 10,
  },
  headerTitle: {
    marginTop: 30,
    fontSize: 16,
    color: "#1F2937",
    fontFamily: "Tajawal-Bold",
  },
  backBtn: {
    marginTop: 30,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },

  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },

  // --- Cards & Containers ---
  card: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  inputCard: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 30,
  },

  // --- Input Styling ---
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f0fff5ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 10,
    fontFamily: "Tajawal-Medium",
  },
  inputRow: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 25,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
    paddingBottom: 5,
  },
  input: {
    fontSize: 48,
    fontFamily: "Tajawal-Bold",
    color: "#1F2937",
    minWidth: 100,
    padding: 0,
  },
  currencySuffix: {
    fontSize: 20,
    color: "#9ca3af",
    fontFamily: "Tajawal-Medium",
    marginTop: 12, // Visual alignment with huge text
    marginHorizontal: 8,
  },

  // --- Presets ---
  presetContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  presetChip: {
    backgroundColor: "#f3f4f6",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  presetText: {
    color: "#4b5563",
    fontFamily: "Tajawal-Bold",
    fontSize: 14,
  },

  // --- Buttons ---
  footer: {
    width: "100%",
  },
  primaryBtn: {
    backgroundColor: "#1F2937", // Matches Wallet Dark Button or Green "#45986cff"
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#45986cff",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: "white",
    fontSize: 16,
    fontFamily: "Tajawal-Bold",
  },
  note: {
    marginTop: 20,
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 12,
    fontFamily: "Tajawal-Regular",
  },

  // --- QR & Ticket ---
  instructionText: {
    fontSize: 16,
    marginBottom: 25,
    textAlign: "center",
    color: "#374151",
    fontFamily: "Tajawal-Medium",
  },
  ticketContainer: {
    backgroundColor: "#f9fafb",
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    marginBottom: 20,
  },
  qrWrapper: {
    padding: 10,
    backgroundColor: "white",
    borderRadius: 8,
  },
  ticketDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 15,
    borderStyle: "dashed",
    borderWidth: 1,
    borderRadius: 1,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  codeLabel: {
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: "Tajawal-Bold",
    letterSpacing: 1,
  },
  codeValue: {
    fontSize: 18,
    fontFamily: "monospace",
    color: "#1F2937",
    fontWeight: "700",
  },
  amountDisplay: {
    fontSize: 36,
    fontFamily: "Tajawal-Bold",
    color: "#1F2937",
    marginBottom: 5,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 25,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  waitingText: {
    color: "#166534",
    fontFamily: "Tajawal-Medium",
    fontSize: 13,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },
  cancelText: {
    color: "#ef4444",
    fontFamily: "Tajawal-Bold",
    fontSize: 15,
  },

  // --- Success State ---
  successIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    color: "#166534",
    marginBottom: 10,
    fontFamily: "Tajawal-Bold",
  },
  successText: {
    textAlign: "center",
    color: "#4b5563",
    marginBottom: 30,
    fontFamily: "Tajawal-Regular",
    fontSize: 15,
  },
});