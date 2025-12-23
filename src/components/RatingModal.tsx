import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Star, X } from "lucide-react-native";
import { supabase } from "../lib/supabase";

export default function RatingModal({
  visible,
  rideId,
  reviewerId,
  revieweeId,
  revieweeName,
  revieweeRole, // 'DRIVER' or 'PASSENGER' (Who is being rated)
  onClose,
}: any) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return alert("Please select a star rating");

    setLoading(true);
    // Identify the role of the person submitting the review
    const reviewerRole = revieweeRole === "DRIVER" ? "PASSENGER" : "DRIVER";

    const { error } = await supabase.from("reviews").insert({
      ride_id: rideId,
      reviewer_id: reviewerId,
      reviewee_id: revieweeId,
      rating: rating,
      comment: comment,
      role: reviewerRole,
    });

    setLoading(false);

    if (error) {
      alert("Error submitting review");
      console.log(error);
    } else {
      onClose(); // Close modal on success
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={24} color="#999" />
          </TouchableOpacity>

          <Text style={styles.title}>
            Rate {revieweeRole === "DRIVER" ? "Driver" : "Passenger"}
          </Text>

          <Text style={styles.name}>{revieweeName || "User"}</Text>
          <Text style={styles.sub}>How was your experience?</Text>

          {/* Star Rating Row */}
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Star
                  size={40}
                  color={star <= rating ? "#FFD700" : "#E5E7EB"}
                  fill={star <= rating ? "#FFD700" : "transparent"}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Write a comment (optional)..."
            multiline
            value={comment}
            onChangeText={setComment}
          />

          <TouchableOpacity
            style={[styles.submitBtn, { opacity: rating === 0 ? 0.5 : 1 }]}
            onPress={handleSubmit}
            disabled={loading || rating === 0}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.btnText}>Submit Review</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
    elevation: 5,
  },
  closeBtn: { position: "absolute", top: 15, right: 15, padding: 5 },
  title: {
    fontSize: 14,
    color: "#666",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  name: { fontSize: 22, fontWeight: "bold", marginVertical: 5, color: "#333" },
  sub: { fontSize: 16, color: "#888", marginBottom: 20 },
  starRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  input: {
    width: "100%",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 15,
    height: 80,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: "#51009cff",
    width: "100%",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: "white", fontWeight: "bold", fontSize: 16 },
});
