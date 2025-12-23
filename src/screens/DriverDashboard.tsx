import React, { useState, useEffect, useRef } from "react";
import RatingModal from "../components/RatingModal";
import { useColorScheme } from "react-native";
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
  Image,
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
  MessageSquare,
  Moon,
  Sun,
  Shield,
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

const WAIT_THRESHOLD = 10;

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
  style, // <--- 1. Add this param
}: any) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[
      styles.btnBase,
      { backgroundColor: disabled ? COLORS.textLight : color },
      style, // <--- 2. Add this here to allow overrides
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

  const theme = useColorScheme();

  const polylineColor = theme === "dark" ? "#8ceebaff" : "black";

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

  const [isNightMode, setIsNightMode] = useState(false);
  const [compassHeading, setCompassHeading] = useState(0);

  const [offerStats, setOfferStats] = useState({
    driverToPickup: { time: "", dist: "" },
    pickupToDropoff: { time: "", dist: "" },
  });
  // Refs
  const mapRef = useRef<MapView>(null);
  const sound = useRef<Audio.Sound | null>(null);
  const isOnlineRef = useRef(isOnline);
  const lastRouteStatus = useRef<string | null>(null);
  const panY = useRef(new Animated.Value(0)).current;

  const slideAnim = useRef(new Animated.Value(500)).current; // Start off-screen (500)

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const progressAnim = useRef(new Animated.Value(1)).current;
  const OFFER_DURATION = 30;

  const prevStatusRef = useRef<string | null>(null);
  const driverMarkerRef = useRef<any>(null);
  // --- CONSTANTS ---
  const CANCELLATION_REASONS = [
    { id: "TRAFFIC", label: t("heavyTraffic") || "Heavy Traffic" },
    { id: "CAR_ISSUE", label: t("carTrouble") || "Car Trouble" },
    { id: "TOO_FAR", label: t("pickupTooFar") || "Pickup Too Far" },
    { id: "PERSONAL", label: t("personalReason") || "Personal Reason" },
  ];

  const renderFloatingControls = () => {
    if (!activeRide) return null;

    return (
      <View style={styles.lyftFloatingContainer}>
        {/* Safety Shield */}
        <TouchableOpacity
          style={styles.lyftIconBtn}
          onPress={() => setIsCancelModalVisible(true)}
        >
          <Shield size={24} color="#111827" />
        </TouchableOpacity>

        {/* NAVIGATE BUTTON - NOW USES INTERNAL MAP */}
        <TouchableOpacity
          style={[
            styles.lyftNavigatePill,
            isNavigationMode && { backgroundColor: "#3B82F6" },
          ]}
          onPress={() => {
            if (isNavigationMode) {
              setIsNavigationMode(false);
              // ... existing zoom out logic ...
            } else {
              setIsNavigationMode(true);
              if (location && mapRef.current) {
                mapRef.current.animateCamera(
                  {
                    center: location.coords,
                    heading: location.coords.heading || 0,
                    pitch: 0, // <--- CHANGE THIS TO 0 (Top Down View)
                    zoom: 18, // Adjusted zoom slightly for better 2D view
                  },
                  { duration: 1000 }
                );
              }
            }
          }}
        >
          <Navigation
            size={20}
            color={isNavigationMode ? "white" : "#111827"}
            fill={isNavigationMode ? "white" : "#111827"}
          />
          <Text
            style={{
              fontFamily: "Tajawal_700Bold",
              color: isNavigationMode ? "white" : "#111827",
            }}
          >
            {isNavigationMode
              ? t("stopNav") || "Exit Nav"
              : t("navigate") || "Navigate"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };
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
            // CHANGE: Increase bottom padding to 450 (or height * 0.5)
            edgePadding: { top: 50, right: 50, bottom: 450, left: 50 },
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
  // --- LOCATION LOGIC ---
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    const startWatch = async () => {
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 2,
        },
        (loc) => {
          // 1. Update the Car Marker (Sliding Animation)
          if (driverMarkerRef.current) {
            driverMarkerRef.current.animateMarkerToCoordinate(
              {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              },
              1000 // Duration matches the update interval for smooth sliding
            );
          }

          // 2. Save Location to State
          setLocation(loc);

          // 3. UPDATE CAMERA (The "Follow Me" Logic)
          // We check if "isNavigationMode" is true.
          if (isNavigationMode && mapRef.current) {
            mapRef.current.animateCamera(
              {
                center: {
                  latitude: loc.coords.latitude,
                  longitude: loc.coords.longitude,
                },
                heading: loc.coords.heading || 0, // Rotate map with car
                pitch: 50, // 3D Tilt for better view
                zoom: 17, // Consistent Zoom
              },
              { duration: 1000 } // Smooth camera slide matching the marker
            );
          }
        }
      );
    };
    startWatch();
    return () => {
      if (sub) sub.remove();
    };
  }, [isNavigationMode]); // <--- Crucial: Re-runs when mode toggles

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

    // Define the safe area for the map (pushes content up)
    const MAP_EDGE_PADDING = {
      top: 100,
      right: 50,
      bottom: 450, // <--- INCREASED from 350 to 450 to clear the new sheet
      left: 50,
    };

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
          edgePadding: MAP_EDGE_PADDING,
          animated: true,
        }
      );
    }
    // CASE 2: Active Ride (Show Route)
    else if (activeRide && routeCoords.length > 0) {
      mapRef.current.fitToCoordinates(routeCoords, {
        edgePadding: MAP_EDGE_PADDING,
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
    if (!incomingOffer || !location) return;

    const fetchEstimates = async () => {
      try {
        // 1. Define the two routes we need
        // Route A: Driver (Current Location) -> Pickup
        const toPickupUrl = `https://router.project-osrm.org/route/v1/driving/${location.coords.longitude},${location.coords.latitude};${incomingOffer.pickup_lng},${incomingOffer.pickup_lat}?overview=false`;

        // Route B: Pickup -> Dropoff
        const tripUrl = `https://router.project-osrm.org/route/v1/driving/${incomingOffer.pickup_lng},${incomingOffer.pickup_lat};${incomingOffer.dropoff_lng},${incomingOffer.dropoff_lat}?overview=false`;

        // 2. Fetch both in parallel
        const [pickupRes, tripRes] = await Promise.all([
          fetch(toPickupUrl),
          fetch(tripUrl),
        ]);

        const pickupJson = await pickupRes.json();
        const tripJson = await tripRes.json();

        // 3. Format Function (Seconds -> Mins, Meters -> Km)
        const format = (route: any) => {
          if (!route) return { time: "--", dist: "--" };
          const mins = Math.round(route.duration / 60);
          const dist = (route.distance / 1000).toFixed(1);
          return { time: `${mins} min`, dist: `${dist} km` };
        };

        // 4. Update State
        setOfferStats({
          driverToPickup: format(pickupJson.routes?.[0]),
          pickupToDropoff: format(tripJson.routes?.[0]),
        });
      } catch (error) {
        console.error("Estimate Calc Error:", error);
      }
    };

    fetchEstimates();
  }, [incomingOffer]);

  useEffect(() => {
    if (incomingOffer) {
      // 1. Reset bar to full
      progressAnim.setValue(1);

      // 2. Animate to empty over OFFER_DURATION
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: OFFER_DURATION * 1000, // Convert to ms
        easing: Easing.linear,
        useNativeDriver: false, // 'width' property does not support native driver
      }).start();
    } else {
      // Stop/Reset if offer is accepted/rejected
      progressAnim.setValue(1);
    }
  }, [incomingOffer]);

  useEffect(() => {
    let headingSubscriber: any;

    const startCompass = async () => {
      // Check permissions (usually included with location)
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      headingSubscriber = await Location.watchHeadingAsync((newHeading) => {
        setCompassHeading(newHeading.magHeading);
      });
    };

    startCompass();

    return () => {
      if (headingSubscriber) {
        headingSubscriber.remove();
      }
    };
  }, []);

  useEffect(() => {
    // Automatically turn ON navigation mode when a ride is active
    if (
      activeRide &&
      (activeRide.status === "ACCEPTED" || activeRide.status === "IN_PROGRESS")
    ) {
      setIsNavigationMode(true);
    }
  }, [activeRide?.status]);

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
      setOfferTimer(30); // Set this to your desired timeout (e.g., 30 seconds)

      // ⬇️ ADD THIS LINE ⬇️
      fetchPassengerDetails(data.passenger_id);
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
      // 1. Allow touches to pass through initially (so buttons work)
      onStartShouldSetPanResponder: () => false,

      // 2. Only claim the touch if the user DRAGS more than 10 pixels
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 10,

      onPanResponderGrant: () => {
        // Optional: Visual feedback when drag starts
        panY.setOffset(panY._value);
        panY.setValue(0);
      },

      onPanResponderMove: (_, { dy }) => {
        // Prevent dragging UP too far (negative values) if you want
        // Or just let it follow the finger:
        if (dy > -50) panY.setValue(dy);
      },

      onPanResponderRelease: (_, { dy }) => {
        panY.flattenOffset(); // Merge offset

        // If dragged down significantly (>100), minimize
        if (dy > 100) {
          Animated.spring(panY, {
            toValue: 280, // Minimize position
            useNativeDriver: true,
            friction: 8,
          }).start();
        } else {
          // Otherwise snap back to top
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  // --- RENDER HELPERS ---

  const renderHeader = () => {
    // 1. IF RIDE IS ACTIVE: Show Lyft-style Top Banner (Location)
    if (activeRide) {
      const isPickup =
        activeRide.status === RideStatus.ACCEPTED ||
        activeRide.status === RideStatus.ARRIVED;
      const title = isPickup
        ? t("pickUpAt") || "Pick up at"
        : t("dropOffAt") || "Drop off at";
      const address = isPickup
        ? activeRide.pickup_address
        : activeRide.dropoff_address;

      return (
        <View style={[styles.lyftTopBanner, { top: insets.top + 10 }]}>
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              padding: 8,
              borderRadius: 8,
            }}
          >
            <MapPin size={24} color="white" />
          </View>
          <View style={styles.lyftBannerText}>
            <Text style={styles.lyftBannerTitle}>
              {activeRide.location_name || title}
            </Text>
            <Text style={styles.lyftBannerAddress} numberOfLines={1}>
              {address}
            </Text>
          </View>
        </View>
      );
    }

    // 2. DEFAULT HEADER (Online/Offline Toggle)
    return (
      <View
        style={[
          styles.headerContainer,
          { flexDirection: flexDir, top: insets.top + 10 },
        ]}
      >
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => navigation.navigate("MenuScreen", { session })}
        >
          <Menu size={24} color={"#45986cff"} />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          onPress={handleToggleOnline}
          style={styles.headerPill}
        >
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
  };

  const renderActiveRideCard = () => {
    // 1. If we are offline/idle with no tasks, hide the sheet completely.
    if (!incomingOffer && !activeRide) return null;

    const isOfferMode = !!incomingOffer;

    // ============================================================
    // MODE A: INCOMING OFFER (The "Ring" Screen)
    // ============================================================
    if (isOfferMode) {
      return (
        <Animated.View
          style={[
            styles.bottomSheet,
            {
              transform: [{ translateY: Animated.add(slideAnim, panY) }],
              zIndex: 100,
              paddingBottom: insets.bottom + 10,
            },
          ]}
        >
          <View>
            {/* PRICE & RATING SECTION */}
            <View style={{ marginBottom: 20, marginTop: 10 }}>
              <View
                style={{
                  flexDirection: flexDir,
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                {/* Price */}
                <View>
                  <Text
                    style={[
                      styles.modalPriceValue,
                      { fontSize: 32, textAlign: textAlign },
                    ]}
                  >
                    {incomingOffer?.fare_estimate}{" "}
                    <Text
                      style={{
                        fontSize: 18,
                        color: "#6B7280",
                        fontFamily: "Tajawal_500Medium",
                      }}
                    >
                      DZD
                    </Text>
                  </Text>
                </View>

                {/* Rating */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 12,
                    borderColor: "#e4e4e4ff",
                  }}
                >
                  <Star size={18} color="#313131ff" fill="#313131ff" />
                  <Text
                    style={{
                      marginHorizontal: 6,
                      fontFamily: "Tajawal_700Bold",
                      color: "#313131ff",
                      fontSize: 16,
                    }}
                  >
                    {passengerDetails?.average_rating
                      ? Number(passengerDetails.average_rating).toFixed(1)
                      : "5.0"}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#313131ff",
                      fontFamily: "Tajawal_500Medium",
                    }}
                  >
                    ({passengerDetails?.rating_count || 0})
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View
                style={{
                  height: 6,
                  backgroundColor: "#F3F4F6",
                  borderRadius: 3,
                  overflow: "hidden",
                  marginBottom: 10,
                }}
              >
                <Animated.View
                  style={{
                    height: "100%",
                    borderRadius: 3,
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                    backgroundColor: progressAnim.interpolate({
                      inputRange: [0, 0.2, 1],
                      outputRange: ["#45986cff", "#45986cff", "#45986cff"],
                    }),
                  }}
                />
              </View>
            </View>

            {/* TIMELINE (Pickup/Dropoff) */}
            <View style={styles.timelineContainer}>
              {/* PICKUP */}
              <View style={[styles.timelineRow, { flexDirection: flexDir }]}>
                <View style={styles.timelineIconCol}>
                  <View
                    style={[
                      styles.timelineDot1,
                      { backgroundColor: "#45986cff" },
                    ]}
                  />
                  <View style={styles.timelineLine} />
                </View>
                <View
                  style={[
                    styles.timelineTextContent,
                    { alignItems: isRTL ? "flex-end" : "flex-start" },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: flexDir,
                      justifyContent: "space-between",
                      width: "100%",
                      alignItems: "center",
                    }}
                  >
                    <Text style={styles.timelineLabel}>
                      {t("pickup") || "PICKUP"}
                    </Text>
                    <View
                      style={{
                        backgroundColor: "#ecfdf5",
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Tajawal_700Bold",
                          color: "#059669",
                        }}
                      >
                        {offerStats.driverToPickup.time} •{" "}
                        {offerStats.driverToPickup.dist}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[styles.timelineAddress, { textAlign: textAlign }]}
                    numberOfLines={2}
                  >
                    {incomingOffer?.pickup_address}
                  </Text>
                </View>
              </View>

              {/* DROPOFF */}
              <View style={[styles.timelineRow, { flexDirection: flexDir }]}>
                <View style={styles.timelineIconCol}>
                  <View
                    style={[
                      styles.timelineDot,
                      { backgroundColor: "#9405b8ff" },
                    ]}
                  />
                </View>
                <View
                  style={[
                    styles.timelineTextContent,
                    {
                      paddingBottom: 0,
                      alignItems: isRTL ? "flex-end" : "flex-start",
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: flexDir,
                      justifyContent: "space-between",
                      width: "100%",
                      alignItems: "center",
                    }}
                  >
                    <Text style={styles.timelineLabel}>
                      {t("dropoff") || "DROPOFF"}
                    </Text>
                    <View
                      style={{
                        backgroundColor: "#f5f3ff",
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Tajawal_700Bold",
                          color: "#7c3aed",
                        }}
                      >
                        {offerStats.pickupToDropoff.time} •{" "}
                        {offerStats.pickupToDropoff.dist}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[styles.timelineAddress, { textAlign: textAlign }]}
                    numberOfLines={2}
                  >
                    {incomingOffer?.dropoff_address}
                  </Text>
                </View>
              </View>
            </View>

            {/* ACTION BUTTON */}
            <View style={[styles.modalBtnRow, { flexDirection: flexDir }]}>
              <PrimaryButton
                title={t("acceptRide") || "Accept Ride"}
                onPress={handleAcceptOffer}
                color="#45986cff"
                style={{ borderRadius: 50, height: 60 }}
              />
            </View>
          </View>
        </Animated.View>
      );
    }

    // ============================================================
    // MODE B: ACTIVE RIDE (The "Lyft" Style)
    // ============================================================
    return (
      <>
        {/* 1. FLOATING CONTROLS (Above Sheet) */}
        {/* HERE IS THE FIX: We simply call the helper function. 
            This avoids the hardcoded "Google Maps" bug you had here before. */}
        {renderFloatingControls()}

        {/* 2. BOTTOM SHEET */}
        <Animated.View
          style={[
            styles.lyftSheetContainer,
            {
              transform: [{ translateY: slideAnim }],
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          {/* Drag Handle */}
          <View style={{ alignItems: "center", marginBottom: 10 }}>
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: "#E5E7EB",
                borderRadius: 2,
              }}
            />
          </View>

          {/* Passenger Row: Avatar - Name (Centered) - Call */}
          <View style={[styles.lyftPassengerRow, { flexDirection: flexDir }]}>
            {/* Avatar */}
            <View style={styles.lyftAvatar}>
              <User size={24} color="#4B5563" />
            </View>

            {/* Name & Rating */}
            <View style={styles.lyftNameContainer}>
              <Text style={styles.lyftName}>
                {passengerDetails?.full_name || "Passenger"}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  marginTop: 4,
                }}
              >
                <Star size={12} color="#F59E0B" fill="#F59E0B" />
                <Text
                  style={{ fontFamily: "Tajawal_500Medium", color: "#6B7280" }}
                >
                  {passengerDetails?.average_rating
                    ? Number(passengerDetails.average_rating).toFixed(1)
                    : "5.0"}
                </Text>
                <Text style={{ fontSize: 12, color: "#9CA3AF" }}>
                  • {passengerDetails?.rating_count || 0} rides
                </Text>
              </View>
            </View>

            {/* Call Button */}
            <TouchableOpacity
              style={styles.lyftCallBtn}
              onPress={() => Linking.openURL(`tel:${passengerDetails?.phone}`)}
            >
              <Phone size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* Wait Time Indicator (Only when Arrived) */}
          {activeRide?.status === RideStatus.ARRIVED && (
            <View style={{ alignItems: "center", marginBottom: 15 }}>
              <Text
                style={{
                  fontFamily: "Tajawal_700Bold",
                  color: waitTime > 300 ? "#DC2626" : "#6B7280",
                }}
              >
                {t("waitTime") || "Wait Time"}: {Math.floor(waitTime / 60)}:
                {(waitTime % 60).toString().padStart(2, "0")}
              </Text>
            </View>
          )}

          {/* Main Action Button */}
          {activeRide?.status === RideStatus.ACCEPTED && (
            <PrimaryButton
              title={t("iHaveArrived") || "Arrive"}
              onPress={() => updateRideStatus(RideStatus.ARRIVED)}
              color="#5b21b6" // Deep Purple like Lyft
              style={{ borderRadius: 30, height: 60 }}
            />
          )}

          {activeRide?.status === RideStatus.ARRIVED && (
            <View>
              <PrimaryButton
                title={t("startTrip") || "Pick Up Passenger"}
                onPress={() => {
                  setOtpInput("");
                  setIsOtpModalVisible(true);
                }}
                color="#5b21b6"
                style={{ borderRadius: 30, height: 60 }}
              />
              {/* No Show Option */}
              {waitTime >= WAIT_THRESHOLD && (
                <TouchableOpacity
                  style={{ marginTop: 15, alignItems: "center" }}
                  onPress={() => {
                    Alert.alert(
                      "Charge No Show?",
                      "Passenger will be charged a cancellation fee.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Charge",
                          style: "destructive",
                          onPress: async () => {
                            // Your no-show logic here
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text
                    style={{ color: "#DC2626", fontFamily: "Tajawal_700Bold" }}
                  >
                    Charge No Show
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {activeRide?.status === RideStatus.IN_PROGRESS && (
            <PrimaryButton
              title={t("completeTrip") || "Drop Off"}
              onPress={() => {
                setCashCollected(activeRide.fare_estimate?.toString() || "");
                setIsPaymentModalVisible(true);
              }}
              color="#DC2626" // Red for dropoff action
              style={{ borderRadius: 30, height: 60 }}
            />
          )}
        </Animated.View>
      </>
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

      {/* Toggle Night Mode Button */}
      <TouchableOpacity
        style={[
          styles.recenterBtn,
          { top: insets.top + 140 }, // Place it below the Recenter button
        ]}
        onPress={() => setIsNightMode(!isNightMode)}
      >
        {isNightMode ? (
          <Sun size={24} color="#F59E0B" />
        ) : (
          <Moon size={24} color={COLORS.primary} />
        )}
      </TouchableOpacity>

      {/* MAP LAYER */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        customMapStyle={isNightMode ? DARK_MAP_STYLE : CUSTOM_MAP_STYLE}
        showsUserLocation={false}
        // ADD THIS PROP:
        mapPadding={{
          top: 50, // Keep space at the top
          right: 0,
          // If we are in a ride, the bottom ~400px are covered by the sheet.
          // We tell the map to ignore that area so the car centers ABOVE it.
          bottom: activeRide || incomingOffer ? 450 : 0,
          left: 0,
        }}
        initialRegion={{
          latitude: location?.coords.latitude || 36.75,
          longitude: location?.coords.longitude || 3.05,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onTouchStart={() => {
          // If user touches map, stop auto-following
          if (isNavigationMode) setIsNavigationMode(false);
        }}
      >
        {routeCoords.length > 0 && (
          <>
            {/* 1. Outer Stroke (Border) */}

            {/* 2. Inner Stroke (Fill) */}
            <Polyline
              coordinates={routeCoords}
              strokeWidth={6}
              strokeColor={polylineColor}
            />
            {/* --- 1. PICKUP MARKER (Passenger - Green Icon) --- */}
            {(incomingOffer ||
              (activeRide && activeRide.status !== RideStatus.IN_PROGRESS)) && (
              <Marker
                coordinate={{
                  latitude:
                    incomingOffer?.pickup_lat || activeRide?.pickup_lat || 0,
                  longitude:
                    incomingOffer?.pickup_lng || activeRide?.pickup_lng || 0,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={2}
              >
                {/* White Circle with Green Border & Green Icon */}
                <View
                  style={[
                    styles.markerCircle,
                    { backgroundColor: "white", borderColor: "#45986cff" },
                  ]}
                >
                  <User size={24} color="#45986cff" fill="#45986cff" />
                </View>
              </Marker>
            )}

            {/* --- 2. DROPOFF MARKER (Destination) --- */}
            {/* Always show if we have data */}
            {(incomingOffer || activeRide) && (
              <Marker
                coordinate={{
                  latitude:
                    incomingOffer?.dropoff_lat || activeRide?.dropoff_lat || 0,
                  longitude:
                    incomingOffer?.dropoff_lng || activeRide?.dropoff_lng || 0,
                }}
                anchor={{ x: 0.5, y: 1 }} // Pin tip is at the bottom
                zIndex={1}
              >
                <View style={styles.markerContainer}>
                  <View
                    style={[
                      styles.markerCircle,
                      { backgroundColor: "#111827", borderColor: "white" },
                    ]}
                  >
                    <MapPin size={20} color="white" />
                  </View>
                  <View style={styles.markerArrow} />
                </View>
              </Marker>
            )}

            {/* CUSTOM DRIVER CAR ICON */}
            {/* CUSTOM DRIVER ARROW (LYFT STYLE) */}
            {location && (
              <Marker
                ref={driverMarkerRef}
                coordinate={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }}
                flat={true}
                rotation={location.coords.heading || 0}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={999}
              >
                <Image
                  source={require("../../assets/navigation_arrow.png")}
                  style={{
                    width: 50,
                    height: 50,
                    resizeMode: "contain",
                  }}
                />
              </Marker>
            )}
          </>
        )}
      </MapView>

      {/* 2. NAVIGATION BUTTON (Stacked under Night Mode) */}

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
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32, // More curvature for a modern feel
    borderTopRightRadius: 32,
    paddingHorizontal: 20, // consistent side padding
    paddingTop: 16,
    zIndex: 100,
    // sophisticated shadow (softer, more dispersed)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 20,
  },
  dragHandleArea: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 25, // Adds a big invisible touch zone (easier to grab)
    marginTop: -10, // Adjusts position so it doesn't look weird
    marginBottom: 5,
    backgroundColor: "transparent", // Ensures touches are registered
    zIndex: 999, // Forces it to be on top of everything
  },
  dragHandle: {
    width: 48,
    height: 5,
    backgroundColor: "#E5E7EB", // Lighter gray
    borderRadius: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  sheetLabel: {
    fontSize: 12,
    color: "#2c2c2cff",
    textTransform: "uppercase",
    fontFamily: "Tajawal_500Medium",
  },
  sheetTitle: {
    fontSize: 16,
    color: "#2c2c2cff",
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
    marginBottom: 24,
    backgroundColor: "#f5f4f4ff",
    padding: 16,
    borderColor: "#F3F4F6",
    borderRadius: 12,
    // inner shadow
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
    color: "#2c2c2cff",
  },
  passengerPhone: {
    fontSize: 12,
    color: "#2c2c2cff",
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
    color: "#2c2c2cff",
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
    color: "#2c2c2cff",
  },
  timerValue: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    fontVariant: ["tabular-nums"],
    color: "#2c2c2cff",
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
    height: 56, // Slightly taller
    borderRadius: 16, // More rounded
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    // Add shadow to buttons
    shadowColor: "#45986cff", // Glow with the brand color
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
    backgroundColor: "#2c2c2cff",
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
    color: "#2c2c2cff",
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
  modalPriceBox: {
    alignItems: "center",
    marginVertical: 20,
  },
  modalPriceLabel: {
    // New style for "Est. Price"
    fontSize: 14,
    color: "#6B7280",
    fontFamily: "Tajawal_500Medium",
    marginBottom: 4,
  },
  modalPriceValue: {
    fontSize: 36, // Bigger, bolder
    color: "#525252ff",
    fontFamily: "Tajawal_800ExtraBold",
    letterSpacing: -1, // Tighten numbers
  },
  timelineContainer: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#ebeaeaff",
    borderRadius: 8,
    marginBottom: 25,
    backgroundColor: "#fafafa",
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  timelineIconCol: {
    width: 30, // Fixed width to align dots perfectly
    alignItems: "center",
    // Remove marginRight here, we will use gap in the row or margin on the text
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    zIndex: 2, // Keeps dot on top of the line
  },
  timelineDot1: {
    width: 14,
    height: 14,
    borderRadius: 7,
    zIndex: 2, // Keeps dot on top of the line
    marginTop: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1, // Stretches to fill the height of the row
    backgroundColor: "#E5E7EB",
    marginTop: 20, // Slight overlap with top dot
    marginBottom: -10, // Slight overlap with bottom dot area
    zIndex: 1,
  },

  timelineTextContent: {
    flex: 1,
    paddingBottom: 30, // <--- THIS is the secret. It pushes the next row down while keeping the line growing.
    marginStart: 12, // Replaces marginRight on icon for better RTL support
  },
  timelineText: {
    fontSize: 15,
    color: "#2c2c2cff",
    flex: 1,
    fontFamily: "Tajawal_500Medium",
  },
  timelineLabel: {
    fontSize: 13,
    color: "#6B7280", // Lighter gray for better contrast
    fontFamily: "Tajawal_700Bold", // Made Bold
    marginBottom: 4,
    textTransform: "uppercase", // MAKE IT STAND OUT
  },

  timelineAddress: {
    fontSize: 15, // Increased from 15
    color: "#111827",
    fontFamily: "Tajawal_700Bold",
    lineHeight: 24,
  },
  modalBtnRow: {
    marginBottom: 20,
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
  noteContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(94, 94, 94, 0.1)",
  },
  noteText: {
    fontFamily: "Tajawal_500Medium",
    fontSize: 14,
    color: "#2c2c2cff",
    flex: 1,
    fontStyle: "italic",
  },
  markerContainer: { alignItems: "center" },
  markerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  markerArrow: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#111827", // Matches dropoff color
    marginTop: -2, // Pulls it up to touch the circle
  },

  lyftTopBanner: {
    position: "absolute",
    top: 60, // Adjust for safe area
    left: 16,
    right: 16,
    backgroundColor: "#115e59", // Dark Teal/Green
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 50,
  },
  lyftBannerText: {
    marginLeft: 12,
    flex: 1,
  },
  lyftBannerTitle: {
    color: "white",
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
  },
  lyftBannerAddress: {
    color: "#ccfbf1", // Light teal text
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    marginTop: 2,
  },

  // Floating Buttons (Right Side)
  lyftFloatingContainer: {
    position: "absolute",
    bottom: 240, // Pushes it above the bottom sheet
    right: 16,
    alignItems: "flex-end",
    gap: 12,
    zIndex: 50,
  },
  lyftIconBtn: {
    width: 48,
    height: 48,
    backgroundColor: "white",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lyftNavigatePill: {
    flexDirection: "row",
    backgroundColor: "white",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Clean Bottom Sheet
  lyftSheetContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  lyftPassengerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    marginTop: 8,
  },
  lyftAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  lyftNameContainer: {
    alignItems: "center", // Center the name like Lyft
    flex: 1,
  },
  lyftName: {
    fontSize: 15,
    fontFamily: "Tajawal_800ExtraBold",
    color: "#111827",
  },
  lyftCallBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  lyftMainBtn: {
    height: 60,
    borderRadius: 30,
    backgroundColor: "#5b21b6", // Deep Purple
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
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

const DARK_MAP_STYLE = [
  {
    elementType: "geometry",
    stylers: [{ color: "#242f3e" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#242f3e" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];
