import React, {
  useState,
  useCallback,
  useLayoutEffect,
  useEffect,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import {
  Wallet,
  ArrowLeft,
  ArrowRight,
  Plus,
  History,
  AlertCircle,
} from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";

// --- TYPES ---
interface Transaction {
  id: string;
  amount: number;
  description: string;
  created_at: string;
  transaction_ref?: string;
}

// --- RTL HELPERS ---
const rtlStyles = {
  flexDirectionRow: { flexDirection: "row-reverse" as const },
  textAlign: { textAlign: "right" as const },
  alignItems: { alignItems: "flex-end" as const },
  flexStart: { alignItems: "flex-start" as const },
};

const ltrStyles = {
  flexDirectionRow: { flexDirection: "row" as const },
  textAlign: { textAlign: "left" as const },
  alignItems: { alignItems: "flex-start" as const },
  flexStart: { alignItems: "flex-end" as const },
};

export default function WalletScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { t, language } = useLanguage();

  const [session, setSession] = useState<any>(route.params?.session || null);

  const isRTL = language === "ar";
  const alignStyle = isRTL ? rtlStyles : ltrStyles;

  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // --- NAVIGATION ---
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // --- AUTH CHECK ---
  useEffect(() => {
    if (!session) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setSession(data.session);
        else setLoading(false);
      });
    }
  }, []);

  // --- DATA FETCHING ---
  useFocusEffect(
    useCallback(() => {
      if (session?.user?.id) fetchWalletData();
    }, [session?.user?.id])
  );

  const fetchWalletData = async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    try {
      // 1. Get Balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", session.user.id)
        .single();

      if (profile) setBalance(profile.balance);

      // 2. Get Transactions
      const { data: history } = await supabase
        .from("transactions")
        .select("*")
        .eq("driver_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (history) setTransactions(history);
    } catch (err) {
      console.error("Wallet Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === "ar" ? "ar-DZ" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isCredit = item.amount > 0;

    return (
      <View style={[styles.txnCard, alignStyle.flexDirectionRow]}>
        {/* 1. ICON (Left or Right) */}
        <View
          style={[
            styles.txnIconBox,
            { backgroundColor: isCredit ? "#dcfce7" : "#fee2e2" },
          ]}
        >
          {isCredit ? (
            <Plus size={20} color="#166534" />
          ) : (
            <Wallet size={20} color="#991b1b" />
          )}
        </View>

        {/* 2. DESCRIPTION (Middle) */}
        <View
          style={{
            flex: 1,
            paddingHorizontal: 12,
            alignItems: isRTL ? "flex-end" : "flex-start",
          }}
        >
          <Text
            style={[styles.txnDesc, { textAlign: isRTL ? "right" : "left" }]}
            numberOfLines={1}
          >
            {item.description === "Voucher Top-up"
              ? t("voucherTopUp")
              : item.description}
          </Text>
          <Text style={styles.txnDate}>{formatDate(item.created_at)}</Text>
        </View>

        {/* 3. AMOUNT (Right or Left) */}
        <View
          style={{
            alignItems: isRTL ? "flex-start" : "flex-end",
            minWidth: 70,
          }}
        >
          <Text
            style={[
              styles.txnAmount,
              { color: isCredit ? "#166534" : "#dc2626" },
            ]}
          >
            {isCredit ? "+" : ""}
            {item.amount.toFixed(2)} {/* <--- FIXED HERE: 2 Decimals */}
          </Text>
          <Text
            style={{
              fontSize: 10,
              color: "#9CA3AF",
              fontFamily: "Tajawal_500Medium",
            }}
          >
            DZD
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* --- HEADER --- */}
      <View style={[styles.headerContainer, alignStyle.flexDirectionRow]}>
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
        <Text style={styles.headerTitle}>{t("wallet")}</Text>
      </View>

      {/* --- BALANCE CARD (Redesigned) --- */}
      <View
        style={[styles.card, balance < 0 ? styles.debtCard : styles.creditCard]}
      >
        {/* Icon Top */}
        <View style={styles.cardIconWrapper}>
          <Wallet color="white" size={32} />
        </View>

        {/* Balance Middle */}
        <View style={styles.cardContent}>
          <Text style={styles.cardBalance}>
            {balance.toFixed(2)}{" "}
            <Text style={{ fontSize: 20 }}>{t("dinar")}</Text>
          </Text>
          <Text style={styles.cardLabel}>
            {t("balance") || "Current Balance"}
          </Text>
        </View>

        {/* Button Bottom */}
        <TouchableOpacity
          style={styles.depositBtn}
          onPress={() => navigation.navigate("TopUpScreen")}
          activeOpacity={0.9}
        >
          <Plus size={18} color="#1F2937" />
          <Text style={styles.depositBtnText}>
            {t("depositCash") || "Deposit Cash"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* --- WARNINGS --- */}
      {balance < -1000 && (
        <View style={[styles.warningBox, alignStyle.flexDirectionRow]}>
          <AlertCircle size={20} color="#dc2626" />
          <Text
            style={[
              styles.warningText,
              { textAlign: isRTL ? "right" : "left" },
            ]}
          >
            {t("debtWarning")}
          </Text>
        </View>
      )}

      {/* --- TRANSACTIONS LIST --- */}
      <View style={styles.listContainer}>
        <Text style={[styles.sectionTitle, alignStyle.textAlign]}>
          {t("recentTxn") || "Recent Transactions"}
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#775BD4"
            style={{ marginTop: 40 }}
          />
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={renderTransactionItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <History size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No recent transactions</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },

  headerContainer: {
    alignItems: "center",
    marginBottom: 20, // Changed from 20 to 0 (or keep small spacing)
    paddingTop: 30,
    paddingHorizontal: 20, // <--- ADD THIS to align with ScrollView content
    backgroundColor: "#f8fafc", // Optional: ensures background matches screen if content scrolls under
    zIndex: 10, // Optional: ensures it stays on top visually
  },
  backBtn: {
    backgroundColor: "white",
    borderRadius: 20,
    marginTop: 30,
  },
  headerTitle: {
    marginTop: 30,
    fontSize: 16,
    paddingHorizontal: 10,
    color: "#1F2937",
    fontFamily: "Tajawal-Bold",
  },

  // --- CARD STYLES ---
  card: {
    marginHorizontal: 20,
    borderRadius: 24,
    paddingVertical: 30,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    alignItems: "center",
  },
  creditCard: { backgroundColor: "#10b981" },
  debtCard: { backgroundColor: "#ef4444" },

  cardIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },

  cardContent: { alignItems: "center", marginBottom: 25 },
  cardBalance: {
    color: "white",
    fontSize: 34, // Slightly smaller to prevent wrap
    fontFamily: "Tajawal_700Bold",
    marginBottom: 5,
  },
  cardLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  depositBtn: {
    backgroundColor: "#FCD34D",
    borderRadius: 50,
    paddingVertical: 12,
    paddingHorizontal: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  depositBtnText: {
    color: "#1F2937",
    fontFamily: "Tajawal_700Bold",
    fontSize: 15,
  },

  // --- WARNING ---
  warningBox: {
    backgroundColor: "#fee2e2",
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center",
    gap: 10,
  },
  warningText: {
    color: "#b91c1c",
    flex: 1,
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
  },

  // --- LIST ---
  listContainer: {
    flex: 1,
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 25,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: "#374151",
    marginBottom: 15,
  },

  txnCard: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "space-between",
  },
  txnIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  txnDesc: {
    fontSize: 15,
    color: "#1F2937",
    fontFamily: "Tajawal_700Bold",
    marginBottom: 4,
  },
  txnDate: {
    fontSize: 12,
    color: "#9CA3AF",
    fontFamily: "Tajawal_500Medium",
  },
  txnAmount: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 50,
    gap: 10,
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
  },
});
