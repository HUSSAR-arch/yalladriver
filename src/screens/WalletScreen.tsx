import React, { useState, useEffect, useLayoutEffect } from "react";
import { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { Wallet, ArrowLeft, QrCode } from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";

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

export default function WalletScreen({ session }: any) {
  const navigation = useNavigation<any>();
  const { t, language } = useLanguage();

  const isRTL = language === "ar";
  const alignStyle = isRTL ? rtlStyles : ltrStyles;

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);

  // --- HIDE DEFAULT NAVIGATION HEADER ---
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      fetchWalletData();
    }, [session.user.id])
  );

  const fetchWalletData = async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", session.user.id)
      .single();
    if (profile) setBalance(profile.balance);

    const { data: history } = await supabase
      .from("transactions")
      .select("id, amount, description, created_at, transaction_ref")
      .eq("driver_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (history) setTransactions(history);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* CUSTOM HEADER */}
      <View style={[styles.headerContainer, alignStyle.flexDirectionRow]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, isRTL && { transform: [{ scaleX: -1 }] }]}
        >
          <ArrowLeft color="#1F2937" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("wallet")}</Text>
      </View>

      {/* BALANCE CARD - UPDATED */}
      <View
        style={[styles.card, balance < 0 ? styles.debtCard : styles.creditCard]}
      >
        {/* ROW 1: Balance Info & Icon */}
        <View style={[styles.cardRow, alignStyle.flexDirectionRow]}>
          <View style={{ alignItems: isRTL ? "flex-end" : "flex-start" }}>
            <Text style={styles.label}>{t("balance")}</Text>
            <Text style={styles.balance}>
              {balance.toFixed(2)} {t("dinar")}
            </Text>
          </View>
          <Wallet color="white" size={32} />
        </View>

        {/* ROW 2: Deposit Button (Moved Inside) */}
        <TouchableOpacity
          style={[styles.inCardBtn, alignStyle.flexDirectionRow]}
          onPress={() => navigation.navigate("TopUpScreen")}
        >
          <QrCode color="#1F2937" size={20} />
          <Text style={styles.inCardBtnText}>
            {t("depositCash") || "Deposit Cash (QR)"}
          </Text>
        </TouchableOpacity>
      </View>

      {balance < -1000 && (
        <Text style={[styles.warningText, alignStyle.textAlign]}>
          {t("debtWarning")}
        </Text>
      )}

      {/* HISTORY (Top Up Section Removed) */}
      <Text style={[styles.sectionTitle, alignStyle.textAlign]}>
        {t("recentTxn")}
      </Text>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.txnRow, alignStyle.flexDirectionRow]}>
            <View
              style={{ flex: 1, alignItems: isRTL ? "flex-end" : "flex-start" }}
            >
              <Text style={styles.txnDesc}>
                {item.description === "Voucher Top-up"
                  ? t("voucherTopUp")
                  : item.description}
              </Text>

              {item.transaction_ref && (
                <Text style={styles.txnId}>ID: {item.transaction_ref}</Text>
              )}
            </View>

            <Text
              style={[
                styles.txnAmount,
                { color: item.amount > 0 ? "#45986cff" : "red" },
              ]}
            >
              {item.amount > 0 ? "+" : ""}
              {item.amount} {t("dinar")}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f8fafc" },
  headerContainer: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: 10,
  },
  backBtn: {
    padding: 5,
    marginTop: 30,
  },
  headerTitle: {
    marginTop: 30,
    fontSize: 16,
    fontFamily: "Tajawal-Bold",
    color: "#1F2937",
    marginHorizontal: 15,
  },

  // --- CARD STYLES UPDATED ---
  card: {
    padding: 20,
    borderRadius: 15,
    // Removed 'justifyContent', added specific width handling if needed
    marginBottom: 10,
  },
  cardRow: {
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20, // Spacing between balance and button
  },
  inCardBtn: {
    backgroundColor: "#FFC107", // White background looks clean on Green/Red card
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "60%",
  },
  inCardBtnText: {
    color: "#1F2937",
    fontFamily: "Tajawal-Bold",
    fontSize: 14,
  },
  creditCard: { backgroundColor: "#45986cff" },
  debtCard: { backgroundColor: "#ef4444" },

  label: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontFamily: "Tajawal-Medium",
  },
  balance: {
    color: "white",
    fontSize: 26,
    fontFamily: "Tajawal-Bold",
  },
  warningText: {
    color: "#ef4444",
    marginBottom: 20,
    fontFamily: "Tajawal-Bold",
  },

  // --- REMOVED topUpSection styles ---

  sectionTitle: {
    fontSize: 14,
    marginBottom: 15,
    marginTop: 10,
    fontFamily: "Tajawal-Bold",
  },
  txnRow: {
    justifyContent: "space-between",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  txnDesc: {
    fontSize: 16,
    color: "#333",
    fontFamily: "Tajawal-Medium",
  },
  txnAmount: {
    fontSize: 16,
    fontFamily: "Tajawal-Bold",
  },
  txnId: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "Tajawal-Medium",
    marginTop: 2,
  },
  txnDate: {
    fontSize: 10,
    color: "#9ca3af",
    fontFamily: "Tajawal-Regular",
    marginTop: 2,
  },
});
