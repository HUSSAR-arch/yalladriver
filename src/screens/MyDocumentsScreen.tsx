import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Image,
  Modal,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../context/LanguageContext";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Camera,
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  X,
  UploadCloud,
} from "lucide-react-native";

// --- TYPES ---
type DocStatus = "MISSING" | "PENDING" | "VERIFIED" | "REJECTED";

interface DocumentItem {
  id: string;
  labelKey: string; // Key for translation
  status: DocStatus;
  url: string | null;
  rejectReason?: string;
}

// --- RTL HELPERS ---
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

const REQUIRED_DOCS = [
  { id: "id_card", labelKey: "docIdCard" },
  { id: "license", labelKey: "docLicense" },
  { id: "registration", labelKey: "docRegistration" },
  { id: "insurance", labelKey: "docInsurance" },
  { id: "vehicle_photo", labelKey: "docVehiclePhoto" },
];

export default function MyDocumentsScreen({ navigation, route }: any) {
  const { t, language } = useLanguage();
  const session = route.params?.session;
  const isRTL = language === "ar";
  const alignStyle = isRTL ? rtlStyles : ltrStyles;
  const ChevronIcon = alignStyle.chevron;

  // --- STATE ---
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

  // Initial Documents List (Mock Data - Replace with DB fetch if needed)
  const [documents, setDocuments] = useState<DocumentItem[]>([
    { id: "id_card", labelKey: "docIdCard", status: "VERIFIED", url: "mock" },
    { id: "license", labelKey: "docLicense", status: "PENDING", url: "mock" },
    {
      id: "registration",
      labelKey: "docRegistration",
      status: "MISSING",
      url: null,
    },
    { id: "insurance", labelKey: "docInsurance", status: "MISSING", url: null },
    {
      id: "vehicle_photo",
      labelKey: "docVehiclePhoto",
      status: "REJECTED",
      url: null,
      rejectReason: "Image blurry",
    },
  ]);

  const [refreshing, setRefreshing] = useState(false);
  const screenHeight = Dimensions.get("window").height;
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  useEffect(() => {
    if (selectedDoc) {
      // Slide UP to position 0 when modal opens
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        stiffness: 300, // Higher = faster snap (default is lower)
        damping: 30, // Prevents too much bounce
        mass: 0.8, // Lighter mass moves faster
      }).start();
    }
  }, [selectedDoc]);

  // Helper to Slide DOWN before closing
  const closeModal = () => {
    Animated.timing(slideAnim, {
      toValue: screenHeight,
      duration: 400,
      useNativeDriver: true,
    }).start(() => {
      setSelectedDoc(null); // Actually hide modal after animation finishes
    });
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    // We await the fetch so the spinner stays visible until data is ready
    await fetchDocuments();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      // 1. Fetch uploaded docs from DB
      const { data, error } = await supabase
        .from("driver_documents")
        .select("*")
        .eq("user_id", session.user.id);

      if (error) throw error;

      // 2. Merge DB data with the Static Requirement List
      const mergedList = REQUIRED_DOCS.map((reqDoc) => {
        // Find if this specific doc type exists in DB
        const dbDoc = data?.find((d: any) => d.type === reqDoc.id);

        return {
          id: reqDoc.id,
          labelKey: reqDoc.labelKey,
          // Use DB status if exists, else 'MISSING'
          status: dbDoc ? dbDoc.status : "MISSING",
          url: dbDoc ? dbDoc.url : null,
          rejectReason: dbDoc ? dbDoc.reject_reason : null,
        } as DocumentItem;
      });

      setDocuments(mergedList);
    } catch (err: any) {
      console.log("Error fetching docs:", err);
      // Optional: Alert.alert('Error', 'Could not load documents');
    } finally {
      setLoading(false);
    }
  };

  // --- IMAGE PICKER LOGIC ---
  const handlePickImage = async (mode: "camera" | "gallery") => {
    if (!selectedDoc) return;

    let result;
    if (mode === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return Alert.alert(t("error"), t("permissionDenied"));
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5, // Compress for faster upload
        base64: true,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        base64: true,
      });
    }

    if (!result.canceled && result.assets[0].base64) {
      uploadToSupabase(result.assets[0], selectedDoc.id);
    }
  };

  // --- SUPABASE UPLOAD ---
  const uploadToSupabase = async (
    asset: ImagePicker.ImagePickerAsset,
    docId: string
  ) => {
    setUploading(true);
    try {
      // 1. Prepare File Path
      // e.g. user_123/license_17000000.jpg
      const fileName = `${session.user.id}/${docId}_${Date.now()}.jpg`;

      // 2. Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from("driver-documents")
        .upload(fileName, decode(asset.base64!), {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const { data: urlData } = supabase.storage
        .from("driver-documents")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // 4. Upsert into Database Table
      // This saves the "Pending" status so the admin sees it
      const { error: dbError } = await supabase.from("driver_documents").upsert(
        {
          user_id: session.user.id,
          type: docId,
          url: publicUrl,
          status: "PENDING",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id, type" }
      ); // Matches the UNIQUE constraint

      if (dbError) throw dbError;

      // 5. Update Local State (Optimistic Update)
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                status: "PENDING",
                url: publicUrl,
                rejectReason: undefined,
              }
            : d
        )
      );

      Alert.alert(t("success"), t("docsPendingMsg"));
      setSelectedDoc(null);
    } catch (error: any) {
      console.log("Upload Error:", error);
      Alert.alert(t("error"), "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Helper to decode base64 for Supabase
  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  // --- RENDER HELPERS ---

  const getStatusColor = (status: DocStatus) => {
    switch (status) {
      case "VERIFIED":
        return "#45986cff";
      case "PENDING":
        return "#F59E0B"; // Orange
      case "REJECTED":
        return "#EF4444"; // Red
      default:
        return "#9CA3AF"; // Gray
    }
  };

  const getStatusIcon = (status: DocStatus) => {
    switch (status) {
      case "VERIFIED":
        return <CheckCircle2 size={20} color="#45986cff" />;
      case "PENDING":
        return <ActivityIndicator size="small" color="#F59E0B" />;
      case "REJECTED":
        return <AlertCircle size={20} color="#EF4444" />;
      default:
        return <UploadCloud size={20} color="#9CA3AF" />;
    }
  };

  const getStatusText = (status: DocStatus) => {
    switch (status) {
      case "VERIFIED":
        return t("statusVerified");
      case "PENDING":
        return t("statusPending");
      case "REJECTED":
        return t("statusRejected");
      default:
        return t("statusMissing");
    }
  };

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
        <Text style={styles.headerTitle}>
          {t("myDocuments") || "My Documents"}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#45986cff"]} // Your app theme color
            tintColor="#45986cff" // iOS spinner color
          />
        }
      >
        {/* SUMMARY CARD */}
        {/* SUMMARY CARD */}
        {/* SUMMARY CARD */}
        <View style={styles.summaryCard}>
          {/* 1. Title: Must use textAlign (Text doesn't use flex-direction) */}
          <Text style={[styles.summaryTitle, alignStyle.textAlign]}>
            {documents.every((d) => d.status === "VERIFIED")
              ? t("allDocsVerified")
              : t("docsPendingMsg")}
          </Text>

          {/* 2. Progress Bar: Use flex-direction to flip the fill origin */}
          {/* 'row' starts left, 'row-reverse' starts right */}
          <View style={[styles.progressBarBg, alignStyle.flexDirectionRow]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${
                    (documents.filter((d) => d.status === "VERIFIED").length /
                      documents.length) *
                    100
                  }%`,
                },
              ]}
            />
          </View>

          {/* 3. Count Text: Must use textAlign */}
          <Text style={[styles.progressText, alignStyle.textAlign]}>
            {documents.filter((d) => d.status === "VERIFIED").length} /{" "}
            {documents.length} Verified
          </Text>
        </View>

        {/* DOCUMENTS LIST */}
        <View style={styles.listContainer}>
          {documents.map((doc) => (
            <TouchableOpacity
              key={doc.id}
              style={[
                styles.docItem,
                alignStyle.flexDirectionRow,
                doc.status === "REJECTED" && styles.rejectedItemBorder,
              ]}
              onPress={() => setSelectedDoc(doc)}
            >
              {/* Icon Box */}
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor:
                      doc.status === "VERIFIED" ? "#ECFDF5" : "#F3F4F6",
                  },
                ]}
              >
                <FileText size={24} color={getStatusColor(doc.status)} />
              </View>

              {/* Text Info */}
              <View
                style={[
                  styles.itemTextContainer,
                  { alignItems: isRTL ? "flex-end" : "flex-start" },
                ]}
              >
                <Text style={styles.itemLabel}>{t(doc.labelKey as any)}</Text>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                >
                  <Text
                    style={[
                      styles.itemStatus,
                      { color: getStatusColor(doc.status) },
                    ]}
                  >
                    {getStatusText(doc.status)}
                  </Text>
                  {doc.status === "REJECTED" && (
                    <AlertCircle size={12} color="#EF4444" />
                  )}
                </View>
              </View>

              {/* Action Icon */}
              <View style={{ marginLeft: 10 }}>
                {getStatusIcon(doc.status)}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* --- UPLOAD MODAL --- */}
      <Modal
        visible={!!selectedDoc}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Animated.View
            style={{
              width: "100%",
              transform: [{ translateY: slideAnim }],
            }}
          >
            <Pressable
              style={styles.modalContent}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <View style={[styles.modalHeader, alignStyle.flexDirectionRow]}>
                <View>
                  <Text style={[styles.modalTitle, alignStyle.textAlign]}>
                    {t("uploadTitle")}
                  </Text>
                  <Text style={[styles.modalSubtitle, alignStyle.textAlign]}>
                    {selectedDoc ? t(selectedDoc.labelKey as any) : ""}
                  </Text>
                </View>
                {/* Updated Close Button to trigger animation */}
                <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                  <X size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Rejection Warning */}
              {selectedDoc?.status === "REJECTED" && (
                <View style={styles.warningBox}>
                  <AlertCircle size={20} color="#EF4444" />
                  <Text style={styles.warningText}>
                    {selectedDoc.rejectReason || t("docRejectedMsg")}
                  </Text>
                </View>
              )}

              {/* Instruction */}
              <Text style={[styles.instructionText, alignStyle.textAlign]}>
                {t("uploadDesc")}
              </Text>

              {/* Action Buttons */}
              {uploading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color="#45986cff" />
                  <Text style={styles.loadingText}>{t("uploading")}</Text>
                </View>
              ) : (
                <View style={{ gap: 15 }}>
                  <TouchableOpacity
                    style={styles.actionBtnPrimary}
                    onPress={() => handlePickImage("camera")}
                  >
                    <Camera size={20} color="white" />
                    <Text style={styles.actionBtnTextPrimary}>
                      {t("openCamera")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtnSecondary}
                    onPress={() => handlePickImage("gallery")}
                  >
                    <ImageIcon size={20} color="#1F2937" />
                    <Text style={styles.actionBtnTextSecondary}>
                      {t("openGallery")}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
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
  scrollContent: { padding: 20 },

  // Summary Card
  summaryCard: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 20,
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryTitle: {
    color: "white",
    fontSize: 15,
    lineHeight: 24,
    fontFamily: "Tajawal-Medium",
    marginBottom: 15,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 3,
    marginBottom: 10,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#45986cff",
    borderRadius: 3,
  },
  progressText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontFamily: "Tajawal-Medium",
    textAlign: "right",
  },

  // List
  listContainer: { gap: 15 },
  docItem: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    elevation: 1,
  },
  rejectedItemBorder: {
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 12,
  },
  itemTextContainer: { flex: 1 },
  itemLabel: {
    fontSize: 16,
    color: "#1F2937",
    fontFamily: "Tajawal-Bold",
    marginBottom: 4,
  },
  itemStatus: {
    fontSize: 13,
    fontFamily: "Tajawal-Medium",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 60,
  },
  modalHeader: {
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Tajawal-Bold",
    color: "#1F2937",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    fontFamily: "Tajawal-Regular",
    marginTop: 4,
  },
  closeBtn: {
    padding: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
  },
  warningBox: {
    flexDirection: "row",
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 10,
    alignItems: "center",
  },
  warningText: {
    flex: 1,
    color: "#B91C1C",
    fontSize: 13,
    fontFamily: "Tajawal-Medium",
  },
  instructionText: {
    fontSize: 15,
    color: "#4B5563",
    marginBottom: 25,
    fontFamily: "Tajawal-Regular",
    lineHeight: 22,
  },

  // Action Buttons
  actionBtnPrimary: {
    backgroundColor: "#45986cff",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  actionBtnTextPrimary: {
    color: "white",
    fontSize: 16,
    fontFamily: "Tajawal-Bold",
  },
  actionBtnSecondary: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  actionBtnTextSecondary: {
    color: "#1F2937",
    fontSize: 16,

    fontFamily: "Tajawal-Bold",
  },

  loadingBox: {
    padding: 30,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: "#6B7280",
    fontFamily: "Tajawal-Medium",
  },
});
