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
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  ArrowRight,
  Wallet,
  CheckCircle2,
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { flexDirection: flexDir }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          // FIX: Apply transform to the button container
          style={[styles.backBtn, isRTL && { transform: [{ scaleX: -1 }] }]}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </TouchableOpacity>

        <Text style={styles.title}>{t("topUp") || "Deposit Cash"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {isScanned ? (
          <View style={styles.centerBox}>
            <CheckCircle2 size={80} color="#51009cff" />
            <Text style={styles.successTitle}>
              {t("success") || "Success!"}
            </Text>
            <Text style={styles.successText}>
              {amount} DZD added to your balance.
            </Text>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : voucher ? (
          <View style={styles.centerBox}>
            <Text style={styles.instructionText}>{t("scanInstruction")}</Text>
            <View style={styles.qrContainer}>
              <QRCode value={voucher.code} size={200} />
            </View>
            <Text style={styles.codeText}>{voucher.code}</Text>

            {/* Updated currency display */}
            <Text style={styles.amountDisplay}>
              {amount} {t("dinar")}
            </Text>

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              <ActivityIndicator color="#51009cff" />
              <Text style={{ color: "gray", fontFamily: "Tajawal-Regular" }}>
                {t("waitingScan")}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                setVoucher(null);
                setAmount("");
              }}
            >
              <Text style={{ color: "#ef4444", fontFamily: "Tajawal-Medium" }}>
                {t("cancel")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <View style={styles.iconCircle}>
              <Wallet size={40} color="#51009cff" />
            </View>
            <Text style={styles.label}>
              {t("enterAmount") || "Amount to Deposit (DZD)"}
            </Text>
            <TextInput
              style={[styles.input, { textAlign: "center" }]}
              placeholder="2000"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              autoFocus
            />
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.generateBtnText}>{t("generateCode")}</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.note}>{t("paymentNote")}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    padding: 25,
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    marginTop: 30,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 20,
  },
  title: {
    fontSize: 16,
    marginTop: 30,
    paddingHorizontal: 10,
    // FONT UPDATE
    fontFamily: "Tajawal-Bold",
    color: "#1F2937",
  },
  content: { flex: 1, padding: 20, justifyContent: "center" },
  inputContainer: {
    backgroundColor: "white",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    elevation: 6,
    marginBottom: 230,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f3e8ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: "#4b5563",
    marginBottom: 10,
    // FONT UPDATE
    fontFamily: "Tajawal-Medium",
  },
  input: {
    fontSize: 40,
    // FONT UPDATE
    fontFamily: "Tajawal-Bold",
    color: "#1F2937",
    width: "100%",
    borderBottomWidth: 2,
    borderColor: "#e5e7eb",
    paddingBottom: 10,
    marginBottom: 30,
  },
  generateBtn: {
    backgroundColor: "#51009cff",
    width: "100%",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  generateBtnText: {
    color: "white",
    fontSize: 18,
    // FONT UPDATE
    fontFamily: "Tajawal-Bold",
  },
  note: {
    marginTop: 20,
    textAlign: "center",
    color: "gray",
    fontSize: 12,
    // FONT UPDATE
    fontFamily: "Tajawal-Regular",
  },
  centerBox: {
    alignItems: "center",
    backgroundColor: "white",
    padding: 30,
    marginBottom: 135,
    borderRadius: 20,
    elevation: 4,
  },
  instructionText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    // FONT UPDATE
    fontFamily: "Tajawal-Medium",
  },
  qrContainer: {
    padding: 10,
    backgroundColor: "white",
    borderRadius: 10,
    marginBottom: 20,
  },
  codeText: {
    fontSize: 14,
    color: "gray",
    fontFamily: "monospace",
    marginBottom: 5,
  },
  amountDisplay: {
    fontSize: 32,
    // FONT UPDATE
    fontFamily: "Tajawal-Bold",
    color: "#1F2937",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    // Removed fontWeight: bold
    color: "#51009cff",
    marginTop: 20,
    marginBottom: 10,
    // FONT UPDATE
    fontFamily: "Tajawal-Bold",
  },
  successText: {
    textAlign: "center",
    color: "#4b5563",
    marginBottom: 30,
    // FONT UPDATE
    fontFamily: "Tajawal-Regular",
  },
  doneBtn: {
    backgroundColor: "#1F2937",
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
  },
  doneBtnText: {
    color: "white",
    // FONT UPDATE
    fontFamily: "Tajawal-Bold",
  },
});
