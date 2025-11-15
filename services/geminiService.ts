import { GoogleGenAI, Type, Chat, GenerateContentResponse } from '@google/genai';
import { RideDetails, FareEstimate, CompletedRide, Suggestion } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MAX_RETRIES = 3;

/**
 * A wrapper function that adds a retry mechanism with exponential backoff for API calls.
 * This makes the app more resilient to transient errors like "503 model overloaded".
 * @param apiCall The asynchronous function to call.
 * @returns The result of the API call.
 */
async function withRetry<T>(apiCall: () => Promise<T>): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await apiCall();
    } catch (e: any) {
      lastError = e;
      // Check if the error message indicates a retriable overload error.
      if (e.toString().includes('overloaded') || e.toString().includes('UNAVAILABLE')) {
        // Exponential backoff with jitter
        const delay = (Math.pow(2, i) * 1000) + (Math.random() * 1000);
        console.warn(`Model overloaded. Retrying in ${delay.toFixed(0)}ms... (Attempt ${i + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Not a retriable error, so fail immediately.
        throw e;
      }
    }
  }
  // If all retries fail, throw the last captured error.
  throw lastError || new Error("API call failed after multiple retries.");
}


const rideDetailsSchema = {
    type: Type.OBJECT,
    properties: {
        driverName: { type: Type.STRING },
        driverPhotoUrl: { type: Type.STRING, description: "A plausible URL for a driver's profile picture. Use a placeholder service like https://picsum.photos/seed/UNIQUE_SEED/200/200." },
        driverBio: { type: Type.STRING, description: "A short, one-sentence, friendly bio for the driver, e.g., '5-star driver with 4 years of experience.'" },
        vehicleModel: { type: Type.STRING },
        licensePlate: { type: Type.STRING },
        eta: { type: Type.STRING },
        fare: { type: Type.STRING, description: "Estimated fare in Indian Rupees, just the number." },
    },
    required: ['driverName', 'driverPhotoUrl', 'driverBio', 'vehicleModel', 'licensePlate', 'eta', 'fare'],
};

const fareEstimateSchema = {
    type: Type.OBJECT,
    properties: {
        estimatedFare: { type: Type.STRING, description: "A plausible fare in INR, e.g., '120'." },
    },
    required: ['estimatedFare'],
};

export const estimateFare = async (
    pickup: string,
    destination: string,
    vehicle: 'BIKE' | 'AUTO' | 'CAR',
    passengerCount: number
): Promise<FareEstimate> => {
     const prompt = `For a ${vehicle.toLowerCase()} trip for ${passengerCount} passenger(s) in Basavakalyan, India from "${pickup}" to "${destination}", provide a JSON object with an 'estimatedFare' in INR.`;

    const response = await withRetry(() => ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: fareEstimateSchema,
        },
    }));

    try {
        const parsedJson = JSON.parse(response.text.trim());
        return parsedJson as FareEstimate;
    } catch (e) {
        console.error("Failed to parse fare estimate JSON:", e);
        throw new Error("Could not get fare estimate.");
    }
}


export const generateRideDetails = async (
    pickup: string,
    destination: string,
    vehicle: 'BIKE' | 'AUTO' | 'CAR',
    passengerCount: number
): Promise<RideDetails> => {
    const prompt = `You are an AI for "Chaloride", a ride-sharing app in Basavakalyan, a historical city in Karnataka, India.
Generate plausible ride details for a ${vehicle.toLowerCase()} trip for ${passengerCount} passenger(s) from "${pickup}" to "${destination}".
Your response must be realistic for the location.
- **Driver Name:** Use a common Indian name.
- **Driver Photo URL:** Generate a plausible URL for a driver's profile picture using \`https://picsum.photos/seed/DRIVER_NAME/200/200\`. Replace DRIVER_NAME with a random name.
- **Driver Bio:** A short, one-sentence, friendly bio for the driver.
- **Vehicle Model:** For a car, use models like Maruti Suzuki Swift or Hyundai i20. If passengers > 2, suggest a slightly larger car like a sedan or small SUV. For an auto, use Bajaj RE. For a bike, use Hero Splendor or Honda Activa.
- **License Plate:** Follow the Karnataka format, specifically for the Bidar district (KA 38). Example: KA 38 AB 1234.
- **ETA:** Provide a realistic travel time in minutes.
- **Fare:** Provide a plausible fare in Indian Rupees.`;

    const response = await withRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: rideDetailsSchema,
        },
    }));

    const jsonText = response.text.trim();
    try {
        const parsedJson = JSON.parse(jsonText);
        return parsedJson as RideDetails;
    } catch (e) {
        console.error("Failed to parse ride details JSON:", e);
        throw new Error("Could not get ride details from the server.");
    }
};

const suggestionsSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            type: { type: Type.STRING, enum: ['BOOK_RIDE', 'EXPLORE'] },
            icon: { type: Type.STRING, enum: ['HOME', 'WORK', 'CAFE', 'LANDMARK', 'RIDE'] },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            payload: { type: Type.STRING },
        },
        required: ['type', 'icon', 'title', 'description', 'payload'],
    },
};

export const getPersonalizedSuggestions = async (
    userName: string,
    rideHistory: CompletedRide[]
): Promise<Suggestion[]> => {
    const timeOfDay = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening';
    const recentDestinations = rideHistory.slice(0, 5).map(r => r.destination).join(', ');

    const prompt = `You are an AI assistant for Chaloride, a ride-sharing app in Basavakalyan.
    Your user's name is ${userName}. It's currently the ${timeOfDay}.
    Their recent destinations include: ${recentDestinations || 'None'}.
    
    Generate 2-3 creative, personalized, and actionable suggestions for the user.
    - If they have frequent destinations, suggest a ride there.
    - Suggest exploring a local point of interest relevant to Basavakalyan's history and the time of day (e.g., a cafe for the afternoon, a historical site).
    - Be friendly and concise.
    
    Examples of good suggestions:
    - Title: "Go to Basavakalyan Fort", Description: "Your frequent trip", Type: BOOK_RIDE, Icon: LANDMARK, Payload: "Basavakalyan Fort"
    - Title: "Explore Anubhava Mantapa", Description: "A place of history", Type: EXPLORE, Icon: LANDMARK, Payload: "Anubhava Mantapa history"
    - Title: "Coffee at Cafe Royal", Description: "Perfect for the afternoon", Type: EXPLORE, Icon: CAFE, Payload: "Cafe Royal near me"
    
    Return ONLY the JSON array.`;

    const response = await withRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: suggestionsSchema,
        },
    }));

    try {
        const parsedJson = JSON.parse(response.text.trim());
        return parsedJson as Suggestion[];
    } catch (e) {
        console.error("Failed to parse suggestions JSON:", e, "Raw text:", response.text);
        // Return an empty array or a default suggestion if parsing fails
        return [];
    }
};

export const createChatSession = (): Chat => {
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: `You are a friendly and helpful customer support chatbot for 'Chaloride', a local ride-sharing app. You are an expert on Basavakalyan, Karnataka.
            
Your knowledge base includes:
- **History:** Basavakalyan was the capital of the Western Chalukya dynasty and is renowned as the home of the 12th-century social reformer Basavanna. It was the center of the Sharana movement.
- **Key Landmarks:** You know about the Basavakalyan Fort, the 108-feet statue of Basavanna, the Anubhava Mantapa (spiritual parliament), Basaveshwara Temple, and various caves and rock-cut monuments.
- **App Support:** You can answer questions about the service, help with booking issues, and explain how the app works.
- **Local Tips:** Provide information on local food, culture, and best times to visit places.
- **Human Support:** If the user asks to speak to a person or for a customer care number, provide these details: Phone: +91 8762042431 and +91 9108247369, Email: rishikeshsangolge19@gmail.com.

Always be concise, friendly, and helpful. Your primary goal is to assist the user with the app and their journey in Basavakalyan.`,
        }
    });
};

export const sendChatMessage = async (chat: Chat, message: string): Promise<GenerateContentResponse> => {
    return withRetry(() => chat.sendMessage({ message }));
};

export const sendChatMessageStream = async (chat: Chat, message: string) => {
    return chat.sendMessageStream({ message });
};


export interface GroundingChunk {
    maps?: {
        uri: string;
        title: string;
    };
}

export const getMapsGroundedResponse = async (
    query: string,
    location: { latitude: number; longitude: number } | null
) => {
    const response = await withRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `I am in Basavakalyan, Karnataka. ${query}`,
        config: {
            tools: [{ googleMaps: {} }],
            toolConfig: location ? {
                retrievalConfig: {
                    latLng: {
                        latitude: location.latitude,
                        longitude: location.longitude,
                    },
                },
            } : undefined,
        },
    }));

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    return {
        text: response.text,
        chunks: chunks as GroundingChunk[],
    };
};