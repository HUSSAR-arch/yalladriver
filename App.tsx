import React, { useState, useEffect } from "react";
import MyDocumentsScreen from "./src/screens/MyDocumentsScreen";
import { NavigationContainer } from "@react-navigation/native";
import SettingsScreen from "./src/screens/SettingsScreen";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, ActivityIndicator } from "react-native";
import { supabase } from "./src/lib/supabase";
import { useFonts } from "expo-font";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import {
  Tajawal_400Regular,
  Tajawal_500Medium,
  Tajawal_700Bold,
  Tajawal_800ExtraBold,
} from "@expo-google-fonts/tajawal";

// --- CONTEXT ---
import { LanguageProvider } from "./src/context/LanguageContext";

// --- SCREENS ---
import OnboardingScreen from "./src/screens/OnboardingScreen";
import DriverDashboard from "./src/screens/DriverDashboard";
import HistoryScreen from "./src/screens/HistoryScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import WalletScreen from "./src/screens/WalletScreen";
import AdminVoucherScreen from "./src/screens/AdminVoucherScreen";
import MenuScreen from "./src/screens/MenuScreen";
import TopUpScreen from "./src/screens/TopUpScreen";
import EditDetailsScreen from "./src/screens/EditDetailsScreen";

// --- NEW SCREENS FOR PROTECTED ROUTES ---
import PendingVerificationScreen from "./src/screens/PendingVerificationScreen";
import SuspendedScreen from "./src/screens/SuspendedScreen";

const Stack = createNativeStackNavigator();

// --- Main App Logic ---
function MainApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Store strict user status details
  const [userProfile, setUserProfile] = useState<{
    role: string;
    isVerified: boolean;
    isSuspended: boolean;
  } | null>(null);

  // --- 1. FETCH PROFILE FUNCTION ---
  // We extract this so we can reuse it when the user taps "Check Status"
  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("role, is_verified, is_suspended")
        .eq("id", userId)
        .single();

      if (data) {
        setUserProfile({
          role: data.role,
          isVerified: data.is_verified || false, // Default to false if null
          isSuspended: data.is_suspended || false, // Default to false if null
        });
        return true;
      }
    } catch (e) {
      console.log("Error fetching profile", e);
    }
    return false;
  };

  // --- 2. AUTH LISTENER ---
  useEffect(() => {
    // Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) startRolePolling(session.user.id);
      else setLoading(false);
    });

    // Realtime Auth Changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session) {
          startRolePolling(session.user.id);
        } else {
          setUserProfile(null);
          setLoading(false);
        }
      }
    );
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // --- 3. POLLING LOGIC ---
  // Helps catch profile creation delays during signup
  const startRolePolling = (userId: string) => {
    setLoading(true);

    // Try immediately
    fetchProfile(userId).then((found) => {
      if (found) setLoading(false);
    });

    // Then poll for a few seconds to handle race conditions
    const intervalId = setInterval(async () => {
      const found = await fetchProfile(userId);
      if (found) {
        clearInterval(intervalId);
        setLoading(false);
      }
    }, 1000);

    // Stop polling after 15 seconds max
    setTimeout(() => {
      clearInterval(intervalId);
      if (!userProfile) setLoading(false);
    }, 15000);
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FFC107",
        }}
      >
        <ActivityIndicator size="large" color="black" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* CASE 1: NOT LOGGED IN */}
        {!session || !userProfile ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : userProfile.role === "DRIVER" && userProfile.isSuspended ? (
          /* CASE 2: SUSPENDED */
          <Stack.Screen name="Suspended">
            {() => <SuspendedScreen />}
          </Stack.Screen>
        ) : userProfile.role === "DRIVER" && !userProfile.isVerified ? (
          /* CASE 3: PENDING VERIFICATION (modified) */
          <>
            <Stack.Screen name="PendingVerification">
              {(props) => (
                <PendingVerificationScreen
                  {...props}
                  session={session}
                  onCheckStatus={() => fetchProfile(session.user.id)}
                />
              )}
            </Stack.Screen>

            {/* ADD THIS LINE HERE: Allow access to documents while pending */}
            <Stack.Screen
              name="MyDocuments"
              component={MyDocumentsScreen}
              // Pass session as initial params so it doesn't crash
              initialParams={{ session }}
            />
          </>
        ) : (
          /* CASE 4: APPROVED DRIVER */
          <>
            <Stack.Screen name="DriverHome">
              {(props) => <DriverDashboard {...props} session={session} />}
            </Stack.Screen>

            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />

            <Stack.Screen
              name="Wallet"
              children={(props) => (
                <WalletScreen {...props} session={session} />
              )}
              options={{ headerShown: true, title: "My Wallet" }}
            />

            <Stack.Screen
              name="AdminConsole"
              component={AdminVoucherScreen}
              options={{ headerShown: true, title: "Admin Console" }}
            />

            <Stack.Screen
              name="MenuScreen"
              component={MenuScreen}
              options={{
                presentation: "transparentModal",
                animation: "fade",
                headerShown: false,
              }}
              initialParams={{ session }}
            />
            <Stack.Screen
              name="TopUpScreen"
              component={TopUpScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="EditDetailsScreen"
              component={EditDetailsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="MyDocuments"
              component={MyDocumentsScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// --- 4. EXPORT WRAPPED APP ---
export default function App() {
  const [fontsLoaded] = useFonts({
    "Tajawal-Regular": Tajawal_400Regular,
    "Tajawal-Medium": Tajawal_500Medium,
    "Tajawal-Bold": Tajawal_700Bold,
    "Tajawal-ExtraBold": Tajawal_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F3F4F6",
        }}
      >
        <ActivityIndicator size="large" color="#111827" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <MainApp />
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
