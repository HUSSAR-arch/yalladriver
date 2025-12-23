import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { rideApi } from "../api/ride.api"; // Import the file above

// const API_URL = "https://my-ride-service.onrender.com";
//const API_URL = "http://192.168.1.11:3000";

interface Ride {
  id: string;
  status: "PENDING" | "ACCEPTED" | "ARRIVED" | "IN_PROGRESS" | "COMPLETED";
}

interface Props {
  ride: Ride;
  driverId: string;
  onStatusChange: (newStatus: string) => void; // Callback to update parent screen
}

export const DriverRideControls: React.FC<Props> = ({
  ride,
  driverId,
  onStatusChange,
}) => {
  const [loading, setLoading] = useState(false);

  const handleAction = async (actionFn: any, nextStatus: string) => {
    setLoading(true);
    try {
      await actionFn(ride.id, driverId);
      onStatusChange(nextStatus); // Update UI immediately
    } catch (error: any) {
      Alert.alert("Error", error.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // 1. If waiting for acceptance
  if (ride.status === "PENDING") {
    return (
      <ActionButton
        label="ACCEPT RIDE"
        color="#51009cff"
        loading={loading}
        onPress={() => handleAction(rideApi.acceptRide, "ACCEPTED")}
      />
    );
  }

  // 2. If Accepted, next step is "I've Arrived"
  if (ride.status === "ACCEPTED") {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Go to Pickup Point</Text>
        <ActionButton
          label="I HAVE ARRIVED"
          color="#3b82f6" // Blue
          loading={loading}
          onPress={() => handleAction(rideApi.arrivedAtPickup, "ARRIVED")}
        />
      </View>
    );
  }

  // 3. If Arrived, next step is "Start Trip"
  if (ride.status === "ARRIVED") {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Waiting for Passenger...</Text>
        <ActionButton
          label="START TRIP"
          color="#8b5cf6" // Purple
          loading={loading}
          onPress={() => handleAction(rideApi.startTrip, "IN_PROGRESS")}
        />
      </View>
    );
  }

  // 4. If In Progress, next step is "Complete"
  if (ride.status === "IN_PROGRESS") {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Driving to Destination</Text>
        <ActionButton
          label="COMPLETE TRIP"
          color="#ef4444" // Red
          loading={loading}
          onPress={() => handleAction(rideApi.completeTrip, "COMPLETED")}
        />
      </View>
    );
  }

  // 5. Done
  return (
    <View style={styles.container}>
      <Text style={styles.statusText}>Trip Completed ✅</Text>
    </View>
  );
};

// --- Simple Button Component ---
const ActionButton = ({ label, color, onPress, loading }: any) => (
  <TouchableOpacity
    style={[
      styles.button,
      { backgroundColor: color, opacity: loading ? 0.7 : 1 },
    ]}
    onPress={onPress}
    disabled={loading}
  >
    {loading ? (
      <ActivityIndicator color="#fff" />
    ) : (
      <Text style={styles.buttonText}>{label}</Text>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 10,
  },
  statusText: {
    marginBottom: 10,
    fontSize: 16,
    color: "#555",
    fontWeight: "600",
  },
  button: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    elevation: 3, // Shadow for Android
    shadowColor: "#000", // Shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
  },
});
