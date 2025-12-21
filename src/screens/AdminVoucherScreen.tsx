import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  Share,
  SafeAreaView,
} from "react-native";
import { supabase } from "../lib/supabase";
import { ShieldCheck, Share2, Printer } from "lucide-react-native";

export default function AdminVoucherScreen() {
  const [amount, setAmount] = useState("2000");
  const [quantity, setQuantity] = useState("10");
  const [loading, setLoading] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<any[]>([]);

  const handleGenerate = async () => {
    setLoading(true);
    const qty = parseInt(quantity);
    const amt = parseInt(amount);

    if (isNaN(qty) || isNaN(amt)) {
      Alert.alert("Error", "Please enter valid numbers");
      setLoading(false);
      return;
    }

    // Call the Database Function we just created
    const { error } = await supabase.rpc("bulk_create_vouchers", {
      amount_per_voucher: amt,
      quantity: qty,
      prefix: "DZ-", // Custom prefix for Algeria
    });

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Success", `Generated ${qty} vouchers!`);
      // Fetch the ones we just made to show them
      fetchLatestVouchers(qty);
    }
    setLoading(false);
  };

  const fetchLatestVouchers = async (limit: number) => {
    const { data } = await supabase
      .from("vouchers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (data) setGeneratedCodes(data);
  };

  // This allows you to export the codes to WhatsApp/Email to print them
  const exportCodes = () => {
    if (generatedCodes.length === 0) return;

    const text = generatedCodes
      .map((v) => `${v.code}  -  ${v.amount} DZD`)
      .join("\n");

    Share.share({
      message: `YallaDZ Vouchers Batch:\n\n${text}`,
      title: "YallaDZ Vouchers",
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <ShieldCheck size={28} color="#45986cff" />
        <Text style={styles.title}>Admin Console</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Voucher Value (DZD)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="e.g. 2000"
        />

        <Text style={styles.label}>Quantity to Generate</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          placeholder="e.g. 50"
        />

        <TouchableOpacity
          style={styles.genBtn}
          onPress={handleGenerate}
          disabled={loading}
        >
          <Text style={styles.genBtnText}>
            {loading ? "Generating..." : "Generate Vouchers"}
          </Text>
        </TouchableOpacity>
      </View>

      {generatedCodes.length > 0 && (
        <View style={styles.resultSection}>
          <View style={styles.resultHeader}>
            <Text style={styles.subTitle}>New Codes</Text>
            <TouchableOpacity onPress={exportCodes} style={styles.exportBtn}>
              <Share2 size={20} color="white" />
              <Text style={{ color: "white", fontWeight: "bold" }}>
                Export List
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={generatedCodes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.codeRow}>
                <Text style={styles.codeText}>{item.code}</Text>
                <Text style={styles.amtText}>{item.amount} DA</Text>
              </View>
            )}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 30,
    marginTop: 20,
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#1F2937" },

  form: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 15,
    shadowOpacity: 0.05,
    elevation: 2,
  },
  label: { fontWeight: "600", marginBottom: 5, color: "gray" },
  input: {
    backgroundColor: "#f3f4f6",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },

  genBtn: {
    backgroundColor: "#1F2937",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  genBtnText: { color: "white", fontWeight: "bold", fontSize: 16 },

  resultSection: { marginTop: 30, flex: 1 },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  subTitle: { fontSize: 18, fontWeight: "bold" },

  exportBtn: {
    flexDirection: "row",
    gap: 5,
    backgroundColor: "#2563eb",
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
  },

  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  amtText: { color: "#45986cff", fontWeight: "bold" },
});
