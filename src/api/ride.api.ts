// CONFIG: Change this to your computer's IP if testing on a real phone!
// Android Emulator uses: 'http://10.0.2.2:3000'
// iOS Simulator uses: 'http://localhost:3000'
// const API_URL = "http://192.168.1.11:3000"; // <--- UPDATE THIS IP

export const rideApi = {
  /**
   * Driver accepts a pending ride
   */
  acceptRide: async (rideId: string, driverId: string) => {
    return sendRequest("/rides/accept", { rideId, driverId });
  },

  /**
   * Driver notifies passenger they are at pickup location
   */
  arrivedAtPickup: async (rideId: string, driverId: string) => {
    return sendRequest("/rides/arrived", { rideId, driverId });
  },

  /**
   * Trip starts (Passenger is in the car)
   */
  startTrip: async (rideId: string, driverId: string) => {
    return sendRequest("/rides/start", { rideId, driverId });
  },

  /**
   * Trip finished (Payment collected)
   */
  completeTrip: async (rideId: string, driverId: string) => {
    return sendRequest("/rides/complete", { rideId, driverId });
  },
};

// --- Helper Function ---
async function sendRequest(endpoint: string, body: any) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "API request failed");
    }

    return data;
  } catch (error: any) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}
