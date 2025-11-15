export enum AppView {
    BOOKING = 'BOOKING',
    CHAT = 'CHAT',
    EXPLORE = 'EXPLORE',
    PAYMENT = 'PAYMENT',
}

export enum VehicleType {
    BIKE = 'BIKE',
    AUTO = 'AUTO',
    CAR = 'CAR',
}

export enum RideStatus {
    IDLE = 'IDLE',
    SEARCHING = 'SEARCHING',
    CONFIRMED = 'CONFIRMED',
    PAID = 'PAID',
    COMPLETED = 'COMPLETED',
    ERROR = 'ERROR',
}

export interface ChatMessage {
    sender: 'USER' | 'GEMINI';
    text: string;
}

export interface RideDetails {
    driverName: string;
    driverPhotoUrl: string;
    driverBio: string;
    vehicleModel: string;
    licensePlate: string;
    eta: string;
    fare: string;
}

export interface PaymentMethod {
    id: string;
    type: 'CARD' | 'CASH' | 'GOOGLE_PAY' | 'PHONE_PE';
    brand?: string;
    last4?: string;
}

export interface CompletedRide extends RideDetails {
    id: string;
    pickup: string;
    destination: string;
    date: string;
    rating?: number;
}

export interface FareEstimate {
    estimatedFare: string;
}

export interface Suggestion {
    type: 'BOOK_RIDE' | 'EXPLORE';
    icon: 'HOME' | 'WORK' | 'CAFE' | 'LANDMARK' | 'RIDE';
    title: string;
    description: string;
    payload: string; // e.g., destination address or search query
}
