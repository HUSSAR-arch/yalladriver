import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Platform,
  LayoutAnimation,
  UIManager,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { Star, X, ThumbsUp } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../context/LanguageContext";

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get("window");

// --- 1. DEFINE TAGS FOR DRIVERS (Reviewing the Driver) ---
const TAGS_DRIVER_POS = [
  { id: "clean", icon: "✨" },
  { id: "safe", icon: "🛡️" },
  { id: "polite", icon: "😊" },
  { id: "music", icon: "🎵" },
  { id: "route", icon: "📍" },
];
const TAGS_DRIVER_NEG = [
  { id: "late", icon: "⏰" },
  { id: "cleanliness", icon: "🗑️" },
  { id: "rude", icon: "😠" },
  { id: "driving", icon: "🚗" },
  { id: "nav", icon: "pmap" },
];

// --- 2. DEFINE TAGS FOR PASSENGERS (Reviewing the Passenger) ---
const TAGS_PASSENGER_POS = [
  { id: "punctual", icon: "⏱️" }, // On Time
  { id: "polite", icon: "😊" }, // Polite
  { id: "neat", icon: "✨" }, // Clean/Neat
  { id: "quiet", icon: "🤫" }, // Respectful
  { id: "patient", icon: "⏳" }, // Patient
];
const TAGS_PASSENGER_NEG = [
  { id: "late_pickup", icon: "🏃" }, // Made driver wait
  { id: "rude", icon: "😠" }, // Rude
  { id: "messy", icon: "🗑️" }, // Left trash
  { id: "slam_door", icon: "🚪" }, // Slammed door
  { id: "nav_demand", icon: "🗣️" }, // Backseat driving
];

interface RatingModalProps {
  visible: boolean;
  rideId: string;
  reviewerId: string;
  revieweeId: string;
  revieweeName: string;
  revieweeRole: "DRIVER" | "PASSENGER"; // "DRIVER" = Rating a Driver. "PASSENGER" = Rating a Passenger.
  onClose: () => void;
}

export default function RatingModal({
  visible,
  rideId,
  reviewerId,
  revieweeId,
  revieweeName,
  revieweeRole,
  onClose,
}: RatingModalProps) {
  const { language, t } = useLanguage();
  const isRTL = language === "ar";

  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setRating(0);
      setSelectedTags([]);
      setComment("");
      setSubmitted(false);
      setLoading(false);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const toggleTag = (tagId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  const handleStarPress = (star: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRating(star);
    if ((rating >= 4 && star < 4) || (rating < 4 && star >= 4)) {
      setSelectedTags([]);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) return;
    setLoading(true);

    // ✅ Determine correct DB role: If I am rating a PASSENGER, I am a DRIVER.
    const dbRole = revieweeRole === "PASSENGER" ? "DRIVER" : "PASSENGER";

    const { error } = await supabase.from("reviews").insert({
      ride_id: rideId,
      reviewer_id: reviewerId,
      reviewee_id: revieweeId,
      rating: rating,
      tags: selectedTags,
      comment: comment,
      role: dbRole, // "DRIVER" (meaning review is FROM a driver)
    });

    setLoading(false);

    if (!error) {
      setSubmitted(true);
      setTimeout(() => handleClose(), 1500);
    } else {
      alert(t("errorSubmit") || "Failed to submit review");
    }
  };

  // --- 3. DYNAMICALLY SELECT TAG LIST ---
  let currentTags = [];
  if (revieweeRole === "DRIVER") {
    // Passenger is rating Driver
    currentTags = rating >= 4 ? TAGS_DRIVER_POS : TAGS_DRIVER_NEG;
  } else {
    // Driver is rating Passenger
    currentTags = rating >= 4 ? TAGS_PASSENGER_POS : TAGS_PASSENGER_NEG;
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      <View style={styles.bottomSheetContainer} pointerEvents="box-none">
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.handleBar} />

          {submitted ? (
            <View style={styles.successContainer}>
              <View style={styles.successCircle}>
                <ThumbsUp size={40} color="white" />
              </View>
              <Text style={styles.successTitle}>
                {t("thankYou") || "Thank you!"}
              </Text>
              <Text style={styles.successSub}>
                {t("feedbackHelps") || "Your feedback helps us improve."}
              </Text>
            </View>
          ) : (
            <View>
              {/* Header */}
              <View
                style={[
                  styles.headerRow,
                  { flexDirection: isRTL ? "row-reverse" : "row" },
                ]}
              >
                <View style={styles.avatarPlaceholder}>
                  {/* Show User Icon for Passenger, Car for Driver */}
                </View>
                <View style={{ flex: 1, paddingHorizontal: 15 }}>
                  <Text
                    style={[
                      styles.sheetTitle,
                      { textAlign: isRTL ? "right" : "left" },
                    ]}
                  >
                    {t("rateUser")?.replace("{name}", revieweeName) ||
                      `Rate ${revieweeName}`}
                  </Text>
                  <Text
                    style={[
                      styles.sheetSub,
                      { textAlign: isRTL ? "right" : "left" },
                    ]}
                  >
                    {revieweeRole === "PASSENGER"
                      ? t("howWasPassenger") || "How was the passenger?"
                      : t("howWasTrip") || "How was your trip?"}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                  <X size={22} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/* Stars */}
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    activeOpacity={0.7}
                    onPress={() => handleStarPress(star)}
                    style={styles.starBtn}
                  >
                    <Star
                      size={40}
                      fill={rating >= star ? "#FBBF24" : "transparent"}
                      color={rating >= star ? "#FBBF24" : "#D1D5DB"}
                      strokeWidth={2}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Tags & Comment */}
              {rating > 0 && (
                <View style={styles.expandableContent}>
                  <Text style={[styles.tagHeader, { textAlign: "center" }]}>
                    {rating >= 4
                      ? t("whatLiked") || "What went well?"
                      : t("whatWrong") || "What went wrong?"}
                  </Text>

                  <View
                    style={[
                      styles.tagsRow,
                      isRTL && { flexDirection: "row-reverse" },
                    ]}
                  >
                    {currentTags.map((tag) => {
                      const isActive = selectedTags.includes(tag.id);
                      const label = t(`tag_${tag.id}`) || tag.id;
                      return (
                        <TouchableOpacity
                          key={tag.id}
                          onPress={() => toggleTag(tag.id)}
                          style={[
                            styles.tagPill,
                            isActive && styles.tagPillActive,
                          ]}
                        >
                          <Text style={{ fontSize: 14 }}>{tag.icon}</Text>
                          <Text
                            style={[
                              styles.tagText,
                              isActive && styles.tagTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TextInput
                    placeholder={
                      t("leaveComment") || "Leave a comment (optional)..."
                    }
                    placeholderTextColor="#9CA3AF"
                    style={[
                      styles.commentInput,
                      isRTL && { textAlign: "right" },
                    ]}
                    multiline
                    value={comment}
                    onChangeText={setComment}
                  />

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handleSubmit}
                    disabled={loading}
                    style={styles.submitBtnContainer}
                  >
                    <LinearGradient
                      colors={["#7055c9ff", "#b486e7ff"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.submitGradient}
                    >
                      {loading ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text style={styles.submitText}>
                          {t("submitReview") || "Submit Review"}
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 1,
  },
  bottomSheetContainer: { flex: 1, justifyContent: "flex-end", zIndex: 2 },
  sheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    minHeight: 300,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 20,
  },
  headerRow: { alignItems: "center", justifyContent: "space-between" },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 35, height: 35, resizeMode: "contain" },
  sheetTitle: { fontSize: 18, fontFamily: "Tajawal_700Bold", color: "#1F2937" },
  sheetSub: { fontSize: 14, color: "#6B7280", fontFamily: "Tajawal_500Medium" },
  closeBtn: { padding: 5 },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 15 },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 10,
  },
  starBtn: { padding: 5 },
  expandableContent: { marginTop: 10 },
  tagHeader: {
    fontSize: 14,
    color: "#374151",
    fontFamily: "Tajawal_700Bold",
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    gap: 6,
  },
  tagPillActive: { backgroundColor: "#F3E8FF", borderColor: "#775BD4" },
  tagText: { fontSize: 13, color: "#4B5563", fontFamily: "Tajawal_500Medium" },
  tagTextActive: { color: "#775BD4", fontFamily: "Tajawal_700Bold" },
  commentInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 15,
    height: 80,
    textAlignVertical: "top",
    fontFamily: "Tajawal_400Regular",
    fontSize: 14,
    color: "#1F2937",
    marginBottom: 20,
  },
  submitBtnContainer: {
    shadowColor: "#775BD4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitGradient: {
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  submitText: { color: "white", fontSize: 16, fontFamily: "Tajawal_700Bold" },
  successContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
  },
  successCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  successTitle: {
    fontSize: 20,
    fontFamily: "Tajawal_700Bold",
    color: "#111827",
    marginBottom: 5,
  },
  successSub: {
    fontSize: 14,
    color: "#6B7280",
    fontFamily: "Tajawal_500Medium",
  },
});
