import React, { useState, useEffect, useRef } from "react";
import RatingModal from "../components/RatingModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNavigation, NavigationProp } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Audio } from "expo-av";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  Dimensions,
  Platform,
  Animated,
  PanResponder,
  TextInput,
  SafeAreaView,
  StatusBar,
  LayoutAnimation,
  UIManager,
  Easing,
} from "react-native";

// Add these with your other imports
import * as Font from "expo-font";
import {
  MapPin,
  Phone,
  User,
  Locate,
  Wallet,
  Navigation,
  XCircle,
  CheckCircle,
  Menu,
  Star,
} from "lucide-react-native";
import { supabase } from "../lib/supabase";
import { RideRequest, RideStatus } from "../types";
import { useLanguage } from "../context/LanguageContext";

const API_URL = "https://my-ride-service.onrender.com";
// const API_URL = "http://192.168.1.11:3000";

// --- THEME CONSTANTS ---
const COLORS = {
  primary: "#111827", // Dark Charcoal / Black
  success: "#45986cff",
  danger: "#960082ff", // Red
  warning: "#F59E0B", // Amber
  background: "#F3F4F6", // Light Gray
  card: "#FFFFFF",
  text: "#1F2937",
  textLight: "#6B7280",
  border: "#E5E7EB",
};

const SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 12,
  elevation: 5,
};

const { width, height } = Dimensions.get("window");
const LOCATION_TASK_NAME = "background-location-task";
const RING_SOUND = require("../../assets/push.wav");

// UI Helpers

// --- BACKGROUND TASK ---
// Added 'heading' as an optional number
let locationBuffer: {
  lat: number;
  lng: number;
  heading?: number;
  timestamp: number;
}[] = [];
let lastFlushTime = Date.now();

// 2. REPLACE THE EXISTING TASKMANAGER DEFINITION WITH THIS:
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Background location error:", error);
    return;
  }

  if (data) {
    const { locations } = data as any; // Array of new locations from OS
    const now = Date.now();

    try {
      // A. Check if driver is actually "Online" before processing
      const userId = await AsyncStorage.getItem("driver_user_id");
      const isOnline = await AsyncStorage.getItem("driver_is_online");

      if (!userId || isOnline !== "true") {
        // If offline, clear buffer to prevent stale sends later
        locationBuffer = [];
        return;
      }

      // B. Add new locations to the buffer
      locations.forEach((loc: any) => {
        locationBuffer.push({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          heading: loc.coords.heading || 0,
          timestamp: loc.timestamp || now,
        });
      });

      // C. Check Conditions: Is Buffer Full (>=5) OR Time Elapsed (>30s)?
      const isBufferFull = locationBuffer.length >= 5;
      const isTimeUp = now - lastFlushTime > 30000; // 30 seconds in ms

      if ((isBufferFull || isTimeUp) && locationBuffer.length > 0) {
        console.log(
          `🚀 Sending Batch: ${locationBuffer.length} locations (TimeUp: ${isTimeUp})`
        );

        // D. Send to the NEW Batch Endpoint
        // Make sure this matches your NestJS Controller route: /rides/update-location
        const API_ENDPOINT =
          "https://my-ride-service.onrender.com/rides/update-location";

        await fetch(API_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driverId: userId,
            locations: locationBuffer, // Sending the Array
          }),
        });

        // E. Reset Buffer & Timer on Success
        locationBuffer = [];
        lastFlushTime = now;
      }
    } catch (err) {
      console.log("❌ Background Batch Failed:", err);
      // Optional: If you want to prevent infinite memory growth on error:
      if (locationBuffer.length > 50) locationBuffer = [];
    }
  }
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// --- REUSABLE UI COMPONENTS ---
const PrimaryButton = ({
  title,
  onPress,
  color = COLORS.primary,
  disabled = false,
}: any) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[
      styles.btnBase,
      { backgroundColor: disabled ? COLORS.textLight : color },
    ]}
  >
    <Text style={styles.btnTextPrimary}>{title}</Text>
  </TouchableOpacity>
);

const SecondaryButton = ({ title, onPress, color = COLORS.danger }: any) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.btnBase,
      {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: COLORS.border,
      },
    ]}
  >
    <Text style={[styles.btnTextSecondary, { color }]}>{title}</Text>
  </TouchableOpacity>
);

const OverlayModal = ({ visible, children }: any) => {
  if (!visible) return null;
  return (
    <View style={styles.overlayBackdrop}>
      <View style={styles.overlayCard}>{children}</View>
    </View>
  );
};

export default function DriverDashboard({ session, navigation }: any) {
  const { t, language } = useLanguage();
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          Tajawal_400Regular: require("../../assets/fonts/Tajawal-Regular.ttf"),
          Tajawal_500Medium: require("../../assets/fonts/Tajawal-Medium.ttf"),
          Tajawal_700Bold: require("../../assets/fonts/Tajawal-Bold.ttf"),
          Tajawal_800ExtraBold: require("../../assets/fonts/Tajawal-ExtraBold.ttf"),
        });
        setFontsLoaded(true);
      } catch (e) {
        console.warn("Error loading fonts", e);
        setFontsLoaded(true); // Proceed anyway to avoid white screen
      }
    }
    loadFonts();
  }, []);

  // --- 2. SAFETY CHECK ---

  const isRTL = language === "ar";
  const TOTAL_OFFER_TIME = 300; // The total time in seconds

  const flexDir = isRTL ? "row-reverse" : "row";
  const textAlign = isRTL ? "right" : "left";
  const arrowTransform = isRTL ? [{ scaleX: -1 }] : [];
  // --- STATE ---
  const [isOnline, setIsOnline] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [balance, setBalance] = useState(0);

  // Ride State
  const [activeRide, setActiveRide] = useState<RideRequest | null>(null);
  const [passengerDetails, setPassengerDetails] = useState<any>(null);
  const [incomingOffer, setIncomingOffer] = useState<any>(null);
  const [offerTimer, setOfferTimer] = useState(15);
  const [waitTime, setWaitTime] = useState(0);
  const [routeCoords, setRouteCoords] = useState<
    { latitude: number; longitude: number }[]
  >([]);

  // UI State
  const [isNavigationMode, setIsNavigationMode] = useState(false);
  const [isOtpModalVisible, setIsOtpModalVisible] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [cashCollected, setCashCollected] = useState("");
  const [isCancelModalVisible, setIsCancelModalVisible] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [finishedRide, setFinishedRide] = useState<any>(null);
  const [isRatingVisible, setIsRatingVisible] = useState(false);
  const [finishedRideData, setFinishedRideData] = useState<any>(null);
  // Refs
  const mapRef = useRef<MapView>(null);
  const sound = useRef<Audio.Sound | null>(null);
  const isOnlineRef = useRef(isOnline);
  const lastRouteStatus = useRef<string | null>(null);
  const panY = useRef(new Animated.Value(0)).current;

  const slideAnim = useRef(new Animated.Value(500)).current; // Start off-screen (500)

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const prevStatusRef = useRef<string | null>(null);

  // --- CONSTANTS ---
  const CANCELLATION_REASONS = [
    { id: "TRAFFIC", label: t("heavyTraffic") || "Heavy Traffic" },
    { id: "CAR_ISSUE", label: t("carTrouble") || "Car Trouble" },
    { id: "TOO_FAR", label: t("pickupTooFar") || "Pickup Too Far" },
    { id: "PERSONAL", label: t("personalReason") || "Personal Reason" },
  ];
  const syncBackgroundLocationTask = async () => {
    try {
      // 1. Get User's Intent (Source of Truth)
      const savedIsOnline = await AsyncStorage.getItem("driver_is_online");
      const shouldBeOnline = savedIsOnline === "true";

      // 2. Get Actual System Status
      const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(
        LOCATION_TASK_NAME
      );

      console.log(
        `🔍 Sync Check: Intent=${shouldBeOnline}, Running=${isTaskRunning}`
      );

      // SCENARIO A: User wants to be Online, but task died (Zombie State: Dead)
      if (shouldBeOnline && !isTaskRunning) {
        console.log("🧟 Fix: Restarting missing background task...");
        await startBackgroundTracking();
        setIsOnline(true);
      }

      // SCENARIO B: User wants to be Offline, but task is running (Zombie State: Undead)
      else if (!shouldBeOnline && isTaskRunning) {
        console.log("🧟 Fix: Killing zombie background task...");
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        setIsOnline(false);
      }

      // SCENARIO C: States match (Normal)
      else {
        setIsOnline(shouldBeOnline);
      }
    } catch (error) {
      console.error("Background Sync Error:", error);
    }
  };

  // --- EFFECTS: INITIALIZATION ---
  useEffect(() => {
    configureAudio();
    syncBackgroundLocationTask();

    // 1. Register for Push Token
    if (session?.user?.id) {
      registerForPushNotificationsAsync(session.user.id);
      AsyncStorage.setItem("driver_user_id", session.user.id); // Ensure ID is saved
    }

    fetchBalance();
    checkActiveRide();

    // ------------------------------------------------------------------
    // NEW: HANDLE NOTIFICATION TAPS (Background & Cold Start)
    // ------------------------------------------------------------------

    // A. Helper function to process the clicked notification
    const handleNotification = async (
      response: Notifications.NotificationResponse
    ) => {
      const data = response.notification.request.content.data;

      // If the notification has a rideId, fetch it directly
      if (data?.rideId) {
        console.log("🔔 App Launched via Notification for Ride:", data.rideId);

        // Fetch the specific ride immediately (bypass generic check)
        const { data: ride } = await supabase
          .from("rides")
          .select("*")
          .eq("id", data.rideId)
          .single();

        // If it's still pending, SHOW IT
        if (ride && ride.status === "PENDING") {
          setIncomingOffer(ride);
          setOfferTimer(15); // Reset timer
        }
      }
    };

    // B. Listener for when app is running in background
    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleNotification);

    // C. CHECK FOR COLD START (App was killed -> Tapped Notification)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotification(response);
      }
    });

    return () => {
      if (sound.current) sound.current.unloadAsync();
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  // --- EFFECTS: REALTIME & LOGIC ---

  // Audio Trigger
  useEffect(() => {
    if (incomingOffer) playRingSound();
    else stopRingSound();
  }, [incomingOffer]);

  // Wait Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeRide?.status === RideStatus.ARRIVED) {
      interval = setInterval(() => setWaitTime((prev) => prev + 1), 1000);
    } else {
      setWaitTime(0);
    }
    return () => clearInterval(interval);
  }, [activeRide?.status]);

  // Offer Countdown
  // Offer Countdown
  useEffect(() => {
    if (!incomingOffer) return;

    // Reset timer to full when a new offer comes in
    setOfferTimer(TOTAL_OFFER_TIME);

    const interval = setInterval(() => {
      setOfferTimer((prev) => {
        if (prev <= 0) {
          // Changed from 1 to 0 for smoother finish
          clearInterval(interval);
          handleDeclineOffer();
          return 0;
        }
        return prev - 1; // You can use prev - 0.1 and interval 100ms for smoother animation if desired
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingOffer]);

  // Realtime Listener
  useEffect(() => {
    if (!isOnline || activeRide) return;

    // Check pending first
    checkExistingOffers();

    const channel = supabase
      .channel("driver_offers")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ride_offers",
          filter: `driver_id=eq.${session.user.id}`,
        },
        (payload) => handleNewOffer(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, session.user.id, activeRide]);

  useEffect(() => {
    // We only care if there is an active ride or an incoming offer
    const targetRideId = activeRide?.id || incomingOffer?.id;

    if (!targetRideId) return;

    const channel = supabase
      .channel(`ride_cancellation:${targetRideId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rides",
          filter: `id=eq.${targetRideId}`,
        },
        (payload) => {
          const updatedRide = payload.new;

          // 1. Handle Cancellation
          if (updatedRide.status === "CANCELLED") {
            // Stop the ringing sound if it was just an offer
            stopRingSound();

            Alert.alert(
              t("rideCancelled") || "Ride Cancelled",
              t("passengerCancelled") ||
                "The passenger has cancelled the request."
            );

            // Clear all states
            setActiveRide(null);
            setIncomingOffer(null);
            setPassengerDetails(null);
            setRouteCoords([]);

            // Re-fetch balance (cancellation fees might apply)
            fetchBalance();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRide?.id, incomingOffer?.id]);

  // Route Fetching
  useEffect(() => {
    if (!activeRide || !location) {
      setRouteCoords([]);
      lastRouteStatus.current = null;
      return;
    }

    const fetchRoute = async () => {
      const targetLat =
        activeRide.status === RideStatus.ACCEPTED ||
        activeRide.status === RideStatus.ARRIVED
          ? activeRide.pickup_lat
          : activeRide.dropoff_lat;
      const targetLng =
        activeRide.status === RideStatus.ACCEPTED ||
        activeRide.status === RideStatus.ARRIVED
          ? activeRide.pickup_lng
          : activeRide.dropoff_lng;

      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${location.coords.longitude},${location.coords.latitude};${targetLng},${targetLat}?overview=full&geometries=geojson`
        );
        const json = await response.json();
        if (json.routes?.[0]) {
          const coords = json.routes[0].geometry.coordinates.map(
            (c: number[]) => ({ latitude: c[1], longitude: c[0] })
          );
          setRouteCoords(coords);
          mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 50, right: 50, bottom: 200, left: 50 },
            animated: true,
          });
        }
      } catch (e) {
        console.error("Route Error", e);
      }
    };

    if (activeRide.status !== lastRouteStatus.current) {
      fetchRoute();
      lastRouteStatus.current = activeRide.status;
    }
  }, [activeRide, location]);

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [isOnline, incomingOffer, activeRide?.status]);

  useEffect(() => {
    // If we have an offer OR an active ride, slide UP to 0
    const shouldShowSheet = !!incomingOffer || !!activeRide;

    Animated.spring(slideAnim, {
      toValue: shouldShowSheet ? 0 : 500, // 0 = Visible, 500 = Hidden
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [incomingOffer, activeRide]);

  // --- LOCATION LOGIC ---
  useEffect(() => {
    // Foreground UI updates
    let sub: Location.LocationSubscription | null = null;
    const startWatch = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 1,
        },
        (loc) => {
          setLocation(loc);
          if (isNavigationMode && mapRef.current) {
            mapRef.current.animateCamera({
              center: loc.coords,
              heading: loc.coords.heading || 0,
              pitch: 50,
              zoom: 18,
            });
          }
        }
      );
    };
    startWatch();
    return () => {
      if (sub) sub.remove();
    };
  }, [isNavigationMode]);

  useEffect(() => {
    if (isOnline && !activeRide && !incomingOffer) {
      // Start pulsing loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1, // Scale up
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseAnim, {
            toValue: 1, // Scale down
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      ).start();
    } else {
      // Reset if not searching
      pulseAnim.setValue(1);
    }
  }, [isOnline, activeRide, incomingOffer]);

  useEffect(() => {
    if (!mapRef.current || !location) return;

    // CASE 1: Incoming Offer (Show Pickup vs Driver)
    if (incomingOffer) {
      mapRef.current.fitToCoordinates(
        [
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          {
            latitude: incomingOffer.pickup_lat,
            longitude: incomingOffer.pickup_lng,
          },
        ],
        {
          edgePadding: { top: 100, right: 50, bottom: 350, left: 50 }, // Bottom padding for sheet
          animated: true,
        }
      );
    }
    // CASE 2: Active Ride (Show Route)
    else if (activeRide && routeCoords.length > 0) {
      mapRef.current.fitToCoordinates(routeCoords, {
        edgePadding: { top: 100, right: 50, bottom: 350, left: 50 },
        animated: true,
      });
    }
    // CASE 3: Just Online/Idle (Follow Driver)
    else if (isOnline && !activeRide && !incomingOffer) {
      mapRef.current.animateCamera({
        center: location.coords,
        zoom: 16,
        pitch: 0,
      });
    }
  }, [incomingOffer, activeRide, routeCoords, isOnline]); // Dependencies
  // 2. Add this Effect to listen to Balance changes in real-time
  useEffect(() => {
    const channel = supabase
      .channel("balance_monitor")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          if (payload.new && payload.new.balance !== undefined) {
            // Update local state immediately when DB changes
            setBalance(payload.new.balance);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.user.id]);

  useEffect(() => {
    const DEBT_LIMIT = -2000;

    // Only run logic if:
    // 1. Driver is currently Online
    // 2. Balance is below the limit
    // 3. Driver is NOT in an active ride (don't strand passengers)
    if (isOnline && balance < DEBT_LIMIT && !activeRide) {
      Alert.alert(
        t("suspended") || "Account Suspended",
        t("debtLimitReached") ||
          "Your balance has reached the limit (-2000 DA). You are now offline. Please top up to continue."
      );

      handleForceOffline();
    }
  }, [balance, isOnline, activeRide]);

  const startBackgroundTracking = async () => {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status === "granted") {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 50,
        foregroundService: {
          notificationTitle: "Yalla Driver",
          notificationBody: "You are online",
          notificationColor: COLORS.success,
        },
      });
    }
  };

  const stopBackgroundTracking = async () => {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(
        LOCATION_TASK_NAME
      );
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log("🛑 Background task stopped successfully.");
      }
    } catch (error) {
      console.log("⚠️ Error stopping background task (ignoring):", error);
    }
  };

  // --- CORE FUNCTIONS ---

  const loadPersistedState = async () => {
    const saved = await AsyncStorage.getItem("driver_is_online");
    if (saved === "true") setIsOnline(true);
    if (session?.user?.id)
      AsyncStorage.setItem("driver_user_id", session.user.id);
  };

  const checkActiveRide = async () => {
    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("driver_id", session.user.id)
      .in("status", ["ACCEPTED", "ARRIVED", "IN_PROGRESS"])
      .single();

    if (data) {
      setActiveRide(data);
      fetchPassengerDetails(data.passenger_id);
      setIsOnline(true);
      startBackgroundTracking();
    }
  };

  const fetchBalance = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", session.user.id)
      .single();
    if (data) setBalance(data.balance);
  };

  const fetchPassengerDetails = async (id: string) => {
    const { data } = await supabase
      .from("profiles")
      // CHANGE THIS LINE to include rating data:
      .select("full_name, phone, average_rating, rating_count")
      .eq("id", id)
      .single();
    if (data) setPassengerDetails(data);
  };

  const configureAudio = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });
  };

  const playRingSound = async () => {
    try {
      if (sound.current) await sound.current.unloadAsync();
      const { sound: newSound } = await Audio.Sound.createAsync(RING_SOUND, {
        shouldPlay: true,
        isLooping: true,
      });
      sound.current = newSound;
    } catch (e) {
      console.log("Sound Error", e);
    }
  };

  const stopRingSound = async () => {
    if (sound.current) {
      await sound.current.stopAsync();
      await sound.current.unloadAsync();
      sound.current = null;
    }
  };

  // --- ACTION HANDLERS ---
  const handleForceOffline = async () => {
    // Update UI immediately
    setIsOnline(false);

    try {
      // Stop tracking
      await stopBackgroundTracking();
      await AsyncStorage.setItem("driver_is_online", "false");

      // Update DB
      await supabase
        .from("profiles")
        .update({ is_online: false })
        .eq("id", session.user.id);
    } catch (err) {
      console.log("Force offline error:", err);
    }
  };

  const getRobustCurrentLocation = async () => {
    // 1. Check if services are enabled first
    const hasServices = await Location.hasServicesEnabledAsync();
    if (!hasServices) {
      throw new Error("Location services are disabled. Please turn them on.");
    }

    try {
      // 2. Try to get a fresh position (wait max 5 seconds)
      return await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Balanced is faster than High
        timeout: 5000,
      });
    } catch (error) {
      console.log("Fresh location failed, using last known...");

      // 3. Fallback: Get the last known location (Instant)
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) return lastKnown;

      // 4. If both fail, re-throw the error
      throw error;
    }
  };

  // ... INSIDE DriverDashboard component ...

  const handleToggleOnline = async () => {
    const target = !isOnline;

    // 1. Balance Check
    if (target && balance < -2000) {
      return Alert.alert(t("error"), t("lowBalance"));
    }

    // 2. Optimistic UI Update
    setIsOnline(target);

    try {
      if (target) {
        await AsyncStorage.setItem("driver_is_online", "true");
        startBackgroundTracking();

        // ✅ FIX: Use the robust helper instead of calling getCurrentPositionAsync directly
        const loc = await getRobustCurrentLocation();

        if (loc) {
          supabase.functions.invoke("update-driver-location", {
            body: {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              driver_id: session.user.id,
            },
          });
        }
      } else {
        await AsyncStorage.setItem("driver_is_online", "false");
        stopBackgroundTracking();
        try {
          await fetch(`${API_URL}/rides/go-offline`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ driverId: session.user.id }),
          });
        } catch (err) {
          console.log("Failed to clear ghost car:", err);
        }
      }

      // 4. Update Database
      const { error } = await supabase
        .from("profiles")
        .update({ is_online: target })
        .eq("id", session.user.id);

      if (error) throw error;
    } catch (error: any) {
      console.error("Online Toggle Error:", error);
      setIsOnline(!target); // Rollback

      // Specific user-friendly error
      if (error.message.includes("Location services")) {
        Alert.alert(
          "Location Error",
          "Please enable GPS in your phone settings."
        );
      } else {
        Alert.alert(
          "Error",
          "Could not go online. Try moving to an area with better GPS."
        );
      }
    }
  };

  const handleNewOffer = async (offer: any) => {
    if (incomingOffer?.id === offer.ride_id || activeRide) return;
    const { data } = await supabase
      .from("rides")
      .select("*")
      .eq("id", offer.ride_id)
      .single();
    if (data && data.status === RideStatus.PENDING) {
      setIncomingOffer(data);
      setOfferTimer(15);
    }
  };

  const checkExistingOffers = async () => {
    const { data } = await supabase
      .from("ride_offers")
      .select("*")
      .eq("driver_id", session.user.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .single();
    if (data) handleNewOffer(data);
  };

  const handleAcceptOffer = async () => {
    if (!incomingOffer) return;

    try {
      // ✅ Using the Cloud URL
      const CLOUD_URL = "https://my-ride-service.onrender.com/rides/accept";

      console.log("Accepting ride via:", CLOUD_URL);

      const response = await fetch(CLOUD_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rideId: incomingOffer.id,
          driverId: session.user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error("Ride taken or unavailable");
      }

      setIncomingOffer(null);
      setActiveRide({ ...incomingOffer, status: RideStatus.ACCEPTED });
      fetchPassengerDetails(incomingOffer.passenger_id);
    } catch (error) {
      console.log("Accept Error", error);
      setIncomingOffer(null);
      Alert.alert(t("error") || "Error", "Ride no longer available");
    }
  };

  const handleDeclineOffer = async () => {
    if (!incomingOffer) return;
    const id = incomingOffer.id;
    setIncomingOffer(null);
    await supabase.rpc("driver_reject_ride", {
      p_ride_id: id,
      p_driver_id: session.user.id,
    });
  };

  const updateRideStatus = async (status: RideStatus) => {
    if (!activeRide) return;

    let endpoint = "";
    if (status === RideStatus.ARRIVED) endpoint = "/rides/arrived";
    else if (status === RideStatus.IN_PROGRESS) endpoint = "/rides/start";
    else if (status === RideStatus.COMPLETED) endpoint = "/rides/complete";

    if (!endpoint) return;

    try {
      // ✅ Using the Cloud URL
      const BASE_URL = "https://my-ride-service.onrender.com";

      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: activeRide.id,
          driverId: session.user.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status on server");
      }

      setActiveRide((prev: any) => ({ ...prev, status }));

      if (status === RideStatus.COMPLETED) {
        Alert.alert(t("success"), `Earned ${activeRide.fare_estimate} DZD`);
        setActiveRide(null);
        setPassengerDetails(null);
        setRouteCoords([]);
        fetchBalance();
      }
    } catch (error: any) {
      console.error("Update Status Error:", error);
      Alert.alert("Error", "Could not update ride status. Check internet.");
    }
  };

  const handleStartTrip = () => {
    if (otpInput === activeRide?.start_code) {
      setIsOtpModalVisible(false);
      updateRideStatus(RideStatus.IN_PROGRESS);
    } else {
      Alert.alert(t("error"), t("wrongCode"));
    }
  };

  const handlePaymentConfirm = async () => {
    if (!activeRide) return;
    const collected = parseFloat(cashCollected);
    const expected = activeRide.fare_estimate || 0;

    if (isNaN(collected)) return Alert.alert("Error", "Invalid Amount");
    if (collected > expected)
      return Alert.alert("Error", "Amount cannot exceed fare.");

    setIsPaymentModalVisible(false);

    if (collected === expected) {
      setFinishedRideData({
        id: activeRide.id,
        passengerId: activeRide.passenger_id,
        name: passengerDetails?.full_name || "Passenger",
      });

      // Add these lines to show the modal and complete the ride:
      setIsRatingVisible(true);
      updateRideStatus(RideStatus.COMPLETED);
    } else {
      const missing = expected - collected;
      Alert.alert(
        "Short Payment",
        `Logging ${missing} DZD debt for passenger.`,
        [
          {
            text: "Confirm",
            onPress: async () => {
              await supabase.from("payment_disputes").insert({
                ride_id: activeRide.id,
                driver_id: session.user.id,
                passenger_id: activeRide.passenger_id,
                expected_amount: expected,
                paid_amount: collected,
                missing_amount: missing,
              });
              updateRideStatus(RideStatus.COMPLETED);
            },
          },
        ]
      );
    }
  };

  const handleCancel = async (reasonId: string) => {
    if (!activeRide) return;
    setIsCancelModalVisible(false);

    await supabase.from("cancellation_logs").insert({
      ride_id: activeRide.id,
      driver_id: session.user.id,
      reason: reasonId,
      driver_location_lat: location?.coords.latitude,
      driver_location_lng: location?.coords.longitude,
      wait_time_seconds: waitTime,
    });

    await supabase
      .from("rides")
      .update({ status: "CANCELLED" })
      .eq("id", activeRide.id);
    Alert.alert("Cancelled", "Ride cancelled successfully.");
    setActiveRide(null);
    setPassengerDetails(null);
    setRouteCoords([]);
    fetchBalance();
  };

  // 1. SAVE INFO before clearing activeRide

  // --- ANIMATIONS ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 10,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) panY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy }) => {
        if (dy > 100)
          Animated.spring(panY, {
            toValue: 280,
            useNativeDriver: true,
          }).start();
        else
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  // --- RENDER HELPERS ---

  const renderHeader = () => (
    <View
      style={[
        styles.headerContainer,
        { flexDirection: flexDir, top: insets.top + 10 },
      ]}
    >
      {/* LEFT SIDE */}
      <TouchableOpacity
        style={styles.menuBtn}
        onPress={() => navigation.navigate("MenuScreen", { session })}
      >
        <Menu size={24} color={"#45986cff"} />
      </TouchableOpacity>

      {/* RIGHT SIDE (Spacer pushes these to the end) */}
      <View style={{ flex: 1 }} />

      <TouchableOpacity onPress={handleToggleOnline} style={styles.headerPill}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isOnline ? COLORS.success : COLORS.textLight },
          ]}
        />
        <Text style={styles.headerText}>
          {isOnline ? t("online") : t("offline")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate("Wallet")}
        style={styles.headerPill}
      >
        <Wallet size={16} color={COLORS.primary} />
        <Text style={styles.headerText}>{Math.floor(balance)} DZD</Text>
      </TouchableOpacity>
    </View>
  );

  const renderActiveRideCard = () => {
    // If we are offline/idle with no tasks, hide the sheet completely.
    if (!incomingOffer && !activeRide) return null;

    // Determine which "Mode" the sheet is in
    const isOfferMode = !!incomingOffer;

    return (
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            transform: [{ translateY: slideAnim }],
            zIndex: 100,
            // UPDATED: Add padding to bottom based on device safe area
            paddingBottom: insets.bottom + 20,
            marginBottom: 0, // Remove the old margin if you want it flush with bottom
          },
        ]}
      >
        {/* ============================================================
            MODE A: INCOMING OFFER (The "Ring" Screen)
           ============================================================ */}
        {isOfferMode ? (
          <View>
            <View style={styles.modalHeaderColumn}>
              {/* 1. Title - Apply textAlign */}
              <Text style={[styles.modalTitle, { textAlign: textAlign }]}>
                New Ride Request
              </Text>

              {/* 3. Countdown Progress Bar */}
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${(offerTimer / TOTAL_OFFER_TIME) * 100}%`,
                      backgroundColor:
                        offerTimer < 5 ? COLORS.danger : "#9914aaff",
                      // In RTL, bar should visually fill from Right to Left,
                      // or just stay centered. Default LTR fill is usually fine,
                      // but if you want it flipped: alignSelf: isRTL ? 'flex-end' : 'flex-start'
                      alignSelf: isRTL ? "flex-end" : "flex-start",
                    },
                  ]}
                />
              </View>
            </View>

            {/* Price Estimate */}
            <View style={styles.modalPriceBox}>
              <Text style={styles.modalPriceLabel}>{t("earnings")}</Text>
              <Text style={styles.modalPriceValue}>
                {incomingOffer?.fare_estimate} DZD
              </Text>
            </View>

            <View style={{ marginTop: 15, marginBottom: 5 }}>
              {/* Pickup Row - Apply flexDir */}
              <View
                style={[
                  styles.timelineRow,
                  { flexDirection: flexDir, marginBottom: 8 },
                ]}
              >
                <View
                  style={[styles.timelineDot, { backgroundColor: "#426e00ff" }]}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.timelineText,
                    // Apply textAlign, and flip margin logic
                    {
                      textAlign: textAlign,
                      fontSize: 14,
                      marginLeft: isRTL ? 0 : 10,
                      marginRight: isRTL ? 10 : 0,
                    },
                  ]}
                >
                  {incomingOffer?.pickup_address || "Pickup Location"}
                </Text>
              </View>

              {/* Dropoff Row - Apply flexDir */}
              <View style={[styles.timelineRow, { flexDirection: flexDir }]}>
                <View
                  style={[styles.timelineDot, { backgroundColor: "orange" }]}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.timelineText,
                    // Apply textAlign, and flip margin logic
                    {
                      textAlign: textAlign,
                      fontSize: 14,
                      marginLeft: isRTL ? 0 : 10,
                      marginRight: isRTL ? 10 : 0,
                    },
                  ]}
                >
                  {incomingOffer?.dropoff_address || "Dropoff Location"}
                </Text>
              </View>
            </View>

            {/* Accept / Decline Buttons - Apply flexDir */}
            <View style={[styles.modalBtnRow, { flexDirection: flexDir }]}>
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  title="Decline"
                  color="#f2f2f2ff"
                  onPress={handleDeclineOffer}
                />
              </View>
              <View style={{ width: 15 }} />
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title="Accept"
                  onPress={handleAcceptOffer}
                  color="#426e00ff"
                />
              </View>
            </View>
          </View>
        ) : (
          /* ============================================================
             MODE B: ACTIVE RIDE (The "Job" Screen)
             ============================================================ */
          <View>
            {/* Drag Handle (Visual cue) */}
            <View style={styles.dragHandleArea}>
              <View style={styles.dragHandle} />
            </View>

            {/* Status Header */}
            <View style={[styles.sheetHeader, { flexDirection: flexDir }]}>
              {/* Left Side (Task) - In RTL this moves to Right */}
              <View style={{ alignItems: isRTL ? "flex-end" : "flex-start" }}>
                <Text style={styles.sheetLabel}>{t("currentTask")}</Text>
                <Text style={styles.sheetTitle}>
                  {activeRide?.status === RideStatus.ACCEPTED
                    ? t("enRouteToPickup")
                    : activeRide?.status === RideStatus.ARRIVED
                    ? t("waitingForPassenger")
                    : t("driveToDest")}
                </Text>
              </View>

              {/* Right Side (Price) - In RTL this moves to Left */}
              <View style={{ alignItems: isRTL ? "flex-start" : "flex-end" }}>
                <Text style={styles.sheetLabel}>{t("earnings")}</Text>
                <Text style={styles.priceTextLarge}>
                  {activeRide?.fare_estimate}{" "}
                  <Text style={{ fontSize: 14 }}>DA</Text>
                </Text>
              </View>
            </View>

            {passengerDetails && (
              <View style={[styles.passengerRow, { flexDirection: flexDir }]}>
                <View style={styles.avatar}>
                  <User size={24} color={COLORS.textLight} />
                </View>
                <View
                  style={{
                    flex: 1,
                    marginHorizontal: 12,
                    alignItems: isRTL ? "flex-end" : "flex-start",
                  }}
                >
                  <Text style={styles.passengerName}>
                    {passengerDetails.full_name}
                  </Text>
                  <Text style={styles.passengerPhone}>
                    {passengerDetails.phone}
                  </Text>

                  {/* ADD THIS BLOCK FOR RATING */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 4,
                    }}
                  >
                    <Star size={12} color="#F59E0B" fill="#F59E0B" />
                    <Text
                      style={{
                        color: "#d1d5db",
                        fontSize: 12,
                        fontWeight: "bold",
                      }}
                    >
                      {passengerDetails.average_rating
                        ? Number(passengerDetails.average_rating).toFixed(1)
                        : "5.0"}
                    </Text>
                    <Text style={{ color: "#6b7280", fontSize: 10 }}>
                      ({passengerDetails.rating_count || 0})
                    </Text>
                  </View>
                  {/* END BLOCK */}
                </View>
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() =>
                    Linking.openURL(`tel:${passengerDetails.phone}`)
                  }
                >
                  <Phone size={20} color="white" />
                </TouchableOpacity>
              </View>
            )}

            {/* Active Target Address */}
            <View style={[styles.addressBox, { flexDirection: flexDir }]}>
              <MapPin size={20} color={COLORS.warning} />
              <Text
                style={[styles.addressText, { textAlign: textAlign }]}
                numberOfLines={2}
              >
                {activeRide?.status === RideStatus.IN_PROGRESS
                  ? activeRide.dropoff_address
                  : activeRide?.pickup_address}
              </Text>
            </View>

            {/* Waiting Timer (Only visible when Arrived) */}
            {activeRide?.status === RideStatus.ARRIVED && (
              <View
                style={[
                  styles.timerBox,
                  { flexDirection: flexDir }, // Flip label and value
                  waitTime > 300 && {
                    borderColor: COLORS.success,
                    backgroundColor: "#0bee84ff",
                  },
                ]}
              >
                <Text style={styles.timerLabel}>{t("waitTime")}</Text>
                <Text
                  style={[
                    styles.timerValue,
                    waitTime > 300 && { color: COLORS.success },
                  ]}
                >
                  {Math.floor(waitTime / 60)}:
                  {(waitTime % 60).toString().padStart(2, "0")}
                </Text>
              </View>
            )}

            {/* Primary Action Button */}
            <View style={styles.actionRow}>
              {/* (No layout changes needed here as it is a full width button) */}
              {activeRide?.status === RideStatus.ACCEPTED && (
                <PrimaryButton
                  title={t("iHaveArrived") || "I Have Arrived"}
                  onPress={() => updateRideStatus(RideStatus.ARRIVED)}
                  color="#426e00ff"
                />
              )}
              {activeRide?.status === RideStatus.ARRIVED && (
                <PrimaryButton
                  title={t("startTrip") || "Start Trip"}
                  onPress={() => {
                    setOtpInput("");
                    setIsOtpModalVisible(true);
                  }}
                  color="#426e00ff"
                />
              )}
              {activeRide?.status === RideStatus.IN_PROGRESS && (
                <PrimaryButton
                  title={t("completeTrip") || "Complete Trip"}
                  onPress={() => {
                    setCashCollected(
                      activeRide.fare_estimate?.toString() || ""
                    );
                    setIsPaymentModalVisible(true);
                  }}
                  color="#426e00ff"
                />
              )}
            </View>

            {/* Secondary Actions (Navigation / Cancel) */}
            {(() => {
              const isChargeNoShow =
                activeRide?.status === RideStatus.ARRIVED && waitTime > 10;

              return (
                <View
                  style={[
                    styles.secondaryActionRow,
                    { flexDirection: flexDir },
                  ]}
                >
                  {/* Navigate Button */}
                  <TouchableOpacity
                    style={[
                      styles.navBtn,
                      isChargeNoShow ? styles.navBtnReducedWidth : {},
                      // RTL FIX: We need to flip the internal content (Icon vs Text)
                      { flexDirection: flexDir },
                      // RTL FIX: In RTL mode, the margin should be on the Left, not Right
                      isRTL
                        ? { marginRight: 0, marginLeft: "4%" }
                        : { marginRight: "4%", marginLeft: 0 },
                    ]}
                    onPress={() => {
                      const lat =
                        activeRide?.status === RideStatus.IN_PROGRESS
                          ? activeRide.dropoff_lat
                          : activeRide?.pickup_lat;
                      const lng =
                        activeRide?.status === RideStatus.IN_PROGRESS
                          ? activeRide.dropoff_lng
                          : activeRide?.pickup_lng;

                      if (lat && lng) {
                        Linking.openURL(
                          `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
                        );
                      }
                    }}
                  >
                    <Navigation size={18} color={COLORS.primary} />
                    <Text style={[styles.navBtnText, { marginHorizontal: 8 }]}>
                      {t("navigate")}
                    </Text>
                  </TouchableOpacity>

                  {/* Cancel/Charge Button */}
                  <TouchableOpacity
                    style={[
                      styles.cancelBtn,
                      isChargeNoShow ? styles.chargeBtnWidth : {},
                    ]}
                    onPress={() =>
                      isChargeNoShow
                        ? handleCancel("PASSENGER_NO_SHOW")
                        : setIsCancelModalVisible(true)
                    }
                  >
                    <Text style={styles.cancelBtnText}>
                      {isChargeNoShow ? t("chargeNoShow") : t("cancel")}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        )}
      </Animated.View>
    );
  };

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // --- RENDER MAIN ---
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* MAP LAYER */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        customMapStyle={CUSTOM_MAP_STYLE}
        showsUserLocation={true}
        initialRegion={{
          latitude: location?.coords.latitude || 36.75,
          longitude: location?.coords.longitude || 3.05,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onTouchStart={() => setIsNavigationMode(false)}
      >
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#1d1d1dff"
            strokeWidth={4}
          />
        )}
        {activeRide && (
          <>
            <Marker
              coordinate={{
                latitude: activeRide.pickup_lat,
                longitude: activeRide.pickup_lng,
              }}
              pinColor="purple"
            />
            <Marker
              coordinate={{
                latitude: activeRide.dropoff_lat,
                longitude: activeRide.dropoff_lng,
              }}
              pinColor="black"
            />
          </>
        )}
      </MapView>

      {/* OVERLAYS */}
      {renderHeader()}

      <TouchableOpacity
        style={[
          styles.recenterBtn,
          { top: insets.top + 80 }, // UPDATED: Pushed down relative to safe area
        ]}
        onPress={() => {
          setIsNavigationMode(!isNavigationMode);
          if (location)
            mapRef.current?.animateCamera({
              center: location.coords,
              zoom: 17,
            });
        }}
      >
        <Locate
          size={24}
          color={isNavigationMode ? "#3B82F6" : COLORS.primary}
        />
      </TouchableOpacity>

      {/* OFFLINE / WAITING STATE */}
      {!activeRide && (
        <View style={styles.centerOverlay}>
          {!isOnline ? (
            <TouchableOpacity
              onPress={handleToggleOnline}
              style={styles.goOnlineBigBtn}
            >
              <Text style={styles.goOnlineText}>{t("goOnline")}</Text>
            </TouchableOpacity>
          ) : (
            <Animated.View
              style={[
                styles.searchingCard,
                { transform: [{ scale: pulseAnim }] }, // Apply the pulse
              ]}
            >
              <ActivityIndicator size="large" color="black" />
              <Text style={styles.searchingTitle}>Finding Trips...</Text>
            </Animated.View>
          )}
        </View>
      )}

      {/* ACTIVE RIDE CARD */}
      {renderActiveRideCard()}

      {/* --- MODALS --- */}

      {/* 1. NEW OFFER MODAL */}

      {/* 2. OTP MODAL */}
      {/* 2. OTP MODAL */}
      <OverlayModal visible={isOtpModalVisible}>
        <Text style={styles.modalTitleCentered}>
          {t("enterClientCode") || "Enter PIN"}
        </Text>
        <TextInput
          style={[styles.otpInput, { textAlign: "center" }]} // PIN usually stays centered LTR
          value={otpInput}
          onChangeText={setOtpInput}
          maxLength={4}
          keyboardType="number-pad"
          placeholder="0-0-0-0"
          autoFocus
        />
        <View style={[styles.modalBtnRow, { flexDirection: flexDir }]}>
          <View style={{ flex: 1 }}>
            <SecondaryButton
              title={t("cancel")}
              onPress={() => setIsOtpModalVisible(false)}
            />
          </View>
          <View style={{ width: 15 }} />
          <View style={{ flex: 1 }}>
            <PrimaryButton title={t("verify")} onPress={handleStartTrip} />
          </View>
        </View>
      </OverlayModal>

      {/* 3. PAYMENT MODAL */}
      <OverlayModal visible={isPaymentModalVisible}>
        <Text style={styles.modalTitleCentered}>{t("cashPayment")}</Text>
        <Text style={styles.modalSubCentered}>
          Enter amount collected from passenger
        </Text>

        {/* Payment Display - Keep Centered, no change needed usually */}
        <View style={styles.paymentDisplay}>{/* ... existing code ... */}</View>

        <TextInput
          style={[styles.otpInput, { textAlign: "center" }]}
          value={cashCollected}
          onChangeText={setCashCollected}
          keyboardType="numeric"
          placeholder="Amount"
        />

        <View style={[styles.modalBtnRow, { flexDirection: flexDir }]}>
          <View style={{ flex: 1 }}>
            <SecondaryButton
              title={t("cancel")}
              onPress={() => setIsPaymentModalVisible(false)}
            />
          </View>
          <View style={{ width: 15 }} />
          <View style={{ flex: 1 }}>
            <PrimaryButton
              title={t("confirm")}
              onPress={handlePaymentConfirm}
              color="black"
            />
          </View>
        </View>
      </OverlayModal>

      {/* 4. CANCEL MODAL */}
      <OverlayModal visible={isCancelModalVisible}>
        <Text style={styles.modalTitleCentered}>{t("selectReason")}</Text>
        {CANCELLATION_REASONS.filter((r) => {
          // If trip is IN PROGRESS, hide "Too Far" and "Traffic" (optional)
          if (activeRide?.status === RideStatus.IN_PROGRESS) {
            return r.id !== "TOO_FAR" && r.id !== "TRAFFIC";
          }
          // Otherwise show everything
          return true;
        }).map((r) => (
          <TouchableOpacity
            key={r.id}
            style={styles.reasonRow}
            onPress={() => handleCancel(r.id)}
          >
            <Text style={styles.reasonText}>{r.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ marginTop: 20 }}>
          <SecondaryButton
            title={t("close")}
            onPress={() => setIsCancelModalVisible(false)}
          />
        </View>
      </OverlayModal>
      <RatingModal
        visible={isRatingVisible}
        rideId={finishedRideData?.id}
        reviewerId={session.user.id}
        revieweeId={finishedRideData?.passengerId}
        revieweeName={finishedRideData?.name}
        revieweeRole="PASSENGER"
        onClose={() => {
          setIsRatingVisible(false);
          setFinishedRideData(null);
        }}
      />
    </View>
  );
}

// --- UTILS ---
async function registerForPushNotificationsAsync(userId: string) {
  // <--- CHANGE HERE
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("ride-requests-v4", {
      name: "Ride Requests",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
      sound: "push.wav", // <--- MUST MATCH FILENAME EXACTLY
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.log("Permission not granted!");
      return;
    }

    // Get the token
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log("PUSH TOKEN:", token); // <--- Log this to debug

    // Save directly using the passed userId
    if (userId) {
      const { error } = await supabase
        .from("profiles")
        .update({ push_token: token })
        .eq("id", userId);

      if (error) console.log("Token Update Error:", error);
      else console.log("Token saved to DB!");
    }
  } else {
    console.log("Must use physical device for Push Notifications");
  }
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header
  headerContainer: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10,
  },
  menuBtn: {
    backgroundColor: "white",
    width: 45,
    height: 45,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOW,
  },
  headerPill: {
    backgroundColor: COLORS.card,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    ...SHADOW,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  headerText: {
    fontFamily: "Tajawal_700Bold",
    color: COLORS.primary,
    fontSize: 14,
  },

  // Map Controls
  recenterBtn: {
    position: "absolute",
    top: 120,
    right: 20,
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 30,
    zIndex: 10,
    ...SHADOW,
  },

  // Center States (Offline/Searching)
  centerOverlay: {
    position: "absolute",
    bottom: 100,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  goOnlineBigBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#45986cff",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOW,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.2)",
  },
  goOnlineText: {
    fontFamily: "Tajawal_800ExtraBold",
    color: "white",
    fontSize: 20,
  },
  searchingCard: {
    backgroundColor: COLORS.card,
    position: "absolute",
    marginBottom: 130,
    padding: 25,
    borderRadius: 20,
    width: "75%",
    alignItems: "center",
    paddingBottom: 60,
    ...SHADOW,
  },
  searchingTitle: {
    marginTop: 15,
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.primary,
  },
  searchingSub: {
    marginTop: 5,
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    color: COLORS.textLight,
    textAlign: "center",
  },

  // Bottom Sheet (Active Ride)
  bottomSheet: {
    marginHorizontal: 10,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#2c2c2cff",
    borderRadius: 25,
    padding: 25,
    paddingBottom: 0,
    zIndex: 100,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    marginBottom: 70,
  },
  dragHandleArea: { width: "100%", alignItems: "center", paddingBottom: 15 },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  sheetLabel: {
    fontSize: 12,
    color: "#f2f2f2ff",
    textTransform: "uppercase",
    fontFamily: "Tajawal_500Medium",
  },
  sheetTitle: {
    fontSize: 16,
    color: "#f2f2f2ff",
    fontFamily: "Tajawal_700Bold",
    marginTop: 4,
  },
  priceTextLarge: {
    fontSize: 22,
    color: "#eeeeeeff",
    fontFamily: "Tajawal_800ExtraBold",
  },

  passengerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "#2c2c2cff",
    padding: 10,
    borderRadius: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  passengerName: {
    fontFamily: "Tajawal_700Bold",
    color: "#f2f2f2ff",
  },
  passengerPhone: {
    fontSize: 12,
    color: "#f2f2f2ff",
    marginTop: 2,
    fontFamily: "Tajawal_400Regular",
  },
  callBtn: {
    backgroundColor: "#af0075ff",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  addressBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  addressText: {
    flex: 1,
    fontSize: 15,
    color: "#f2f2f2ff",
    fontFamily: "Tajawal_500Medium",
  },

  timerBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#2c2c2cff",
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "transparent",
  },
  timerLabel: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    color: "#f2f2f2ff",
  },
  timerValue: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    fontVariant: ["tabular-nums"],
    color: "#f2f2f2ff",
  },

  actionRow: { marginBottom: 15 },
  secondaryActionRow: {
    flexDirection: "row",
    marginBottom: 30,
  },
  navBtn: {
    width: "48%",
    marginRight: "4%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    gap: 8,
  },
  navBtnText: {
    fontFamily: "Tajawal_700Bold",
    color: COLORS.primary,
  },
  cancelBtn: {
    width: "48%",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  navBtnReducedWidth: { width: "36%" },
  chargeBtnWidth: { width: "60%" },
  cancelBtnText: {
    fontFamily: "Tajawal_700Bold",
    color: COLORS.danger,
    fontSize: 12,
  },

  // Buttons
  btnBase: {
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  btnTextPrimary: {
    color: "white",
    fontFamily: "Tajawal_700Bold",
    fontSize: 16,
  },
  btnTextSecondary: {
    fontFamily: "Tajawal_700Bold",
    fontSize: 16,
  },

  // Modals (Overlays)
  overlayBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    padding: 20,
  },
  overlayCard: {
    position: "absolute",
    backgroundColor: "#f2f2f2ff",
    width: "100%",
    borderRadius: 30,
    padding: 24,
    ...SHADOW,
  },
  modalHeaderColumn: { marginBottom: 20, width: "100%" },
  progressBarBackground: {
    width: "100%",
    height: 3,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    marginTop: 10,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", borderRadius: 3 },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Tajawal_800ExtraBold",
    color: "#f2f2f2ff",
  },
  modalTitleCentered: {
    fontSize: 20,
    fontFamily: "Tajawal_800ExtraBold",
    color: COLORS.primary,
    textAlign: "center",
    marginBottom: 20,
  },
  modalSubCentered: {
    textAlign: "center",
    color: COLORS.textLight,
    marginBottom: 20,
    fontFamily: "Tajawal_400Regular",
  },
  modalPriceBox: { alignItems: "center", marginBottom: 25 },
  modalPriceLabel: {
    fontSize: 12,
    color: "#f2f2f2ff",
    fontFamily: "Tajawal_700Bold",
    textTransform: "uppercase",
  },
  modalPriceValue: {
    fontSize: 32,
    color: "#f2f2f2ff",
    fontFamily: "Tajawal_800ExtraBold",
  },
  timelineContainer: { marginBottom: 25 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineLine: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border,
    marginLeft: 5,
    marginVertical: 2,
  },
  timelineText: {
    fontSize: 15,
    color: "#f2f2f2ff",
    flex: 1,
    marginBottom: 20,
    fontFamily: "Tajawal_400Regular",
  },
  modalBtnRow: {
    marginBottom: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  otpInput: {
    backgroundColor: COLORS.background,
    fontSize: 28,
    fontFamily: "Tajawal_700Bold",
    padding: 15,
    borderRadius: 12,
    textAlign: "center",
    letterSpacing: 8,
    marginBottom: 25,
    color: COLORS.primary,
  },
  paymentDisplay: {
    alignItems: "center",
    marginBottom: 15,
    backgroundColor: COLORS.background,
    padding: 15,
    borderRadius: 12,
  },
  paymentLabel: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
    color: COLORS.textLight,
    marginBottom: 5,
  },
  paymentValue: {
    fontSize: 24,
    fontFamily: "Tajawal_800ExtraBold",
    color: COLORS.primary,
  },
  reasonRow: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  reasonText: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: "center",
    fontFamily: "Tajawal_500Medium",
  },
});

// Map Style (Clean Grayscale)
const CUSTOM_MAP_STYLE = [
  // --- 1. FORCE LIGHT MODE COLORS ---
  {
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }],
  },
  {
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#f5f5f5" }],
  },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels.text.fill",
    stylers: [{ color: "#bdbdbd" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#e5e5e5" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.arterial",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#dadada" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
  {
    featureType: "transit.line",
    elementType: "geometry",
    stylers: [{ color: "#e5e5e5" }],
  },
  {
    featureType: "transit.station",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9c9c9" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },

  // --- 2. YOUR SPECIFIC OVERRIDES (Keep these at the bottom) ---
  {
    featureType: "poi.business",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "transit",
    elementType: "labels.icon",
    stylers: [{ visibility: "on" }],
  },
];
