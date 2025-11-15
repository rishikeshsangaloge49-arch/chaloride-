import React, { useState, useCallback, useEffect } from 'react';
import { RideStatus, RideDetails, PaymentMethod, CompletedRide, FareEstimate, Suggestion, AppView } from '../types';
import { generateRideDetails, estimateFare, getPersonalizedSuggestions } from '../services/geminiService';
import { BikeIcon, AutoIcon, CarIcon, ErrorIcon, CheckCircleIcon, HistoryIcon, UserIcon, LicenseIcon, PriceIcon, CalendarIcon, MapPinIcon, MapViewIcon, ListIcon, ClockIcon, PlusIcon, MinusIcon, SparklesIcon, HomeIcon, WorkIcon, CafeIcon, LandmarkIcon, RideIcon as SuggestionRideIcon } from './icons/Icons';
import MapView from './MapView';
import RideDetailsCard from './RideDetailsCard';
import LoadingSpinner from './LoadingSpinner';
import GooglePayModal from './GooglePayModal';

interface BookingViewProps {
    pickup: string;
    setPickup: (value: string) => void;
    destination: string;
    setDestination: (value: string) => void;
    vehicle: 'BIKE' | 'AUTO' | 'CAR';
    setVehicle: (value: 'BIKE' | 'AUTO' | 'CAR') => void;
    passengerCount: number;
    setPassengerCount: (value: number) => void;
    paymentMethods: PaymentMethod[];
    rideHistory: CompletedRide[];
    onRideComplete: (ride: { pickup: string; destination: string; } & RideDetails) => void;
    showToast: (message: string) => void;
    userName: string;
    setCurrentView: (view: AppView) => void;
    setInitialExploreQuery: (query: string) => void;
}

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
    <div className="flex items-start space-x-4">
        <div className="bg-blue-100 p-2 rounded-full mt-1">{icon}</div>
        <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="font-semibold text-gray-800">{value}</p>
        </div>
    </div>
);

const SuggestionsSkeleton: React.FC = () => (
    <div className="p-4 bg-white rounded-lg shadow-sm mb-4">
        <div className="animate-shimmer">
            <div className="h-5 w-1/3 rounded bg-gray-200 mb-4"></div>
            <div className="flex space-x-3">
                <div className="w-1/2 h-24 rounded-lg bg-gray-300"></div>
                <div className="w-1/2 h-24 rounded-lg bg-gray-200"></div>
            </div>
        </div>
    </div>
);


const BookingView: React.FC<BookingViewProps> = ({ pickup, setPickup, destination, setDestination, vehicle, setVehicle, passengerCount, setPassengerCount, paymentMethods, rideHistory, onRideComplete, showToast, userName, setCurrentView, setInitialExploreQuery }) => {
    const [rideStatus, setRideStatus] = useState<RideStatus>(RideStatus.IDLE);
    const [rideDetails, setRideDetails] = useState<RideDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [payingMethodId, setPayingMethodId] = useState<string | null>(null);
    const [isShowingHistory, setIsShowingHistory] = useState(false);
    const [selectedRide, setSelectedRide] = useState<CompletedRide | null>(null);
    const [isMapVisible, setIsMapVisible] = useState(true);
    const [driverPosition, setDriverPosition] = useState({ top: '40%', left: '60%' });
    const [cancellationStep, setCancellationStep] = useState<'idle' | 'confirm' | 'reason'>('idle');
    const [cancellationReason, setCancellationReason] = useState('');
    const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
    const [isEstimating, setIsEstimating] = useState(false);
    const [dynamicEta, setDynamicEta] = useState<number | null>(null);
    const [rideTrackingLink, setRideTrackingLink] = useState<string | null>(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isGPayModalOpen, setIsGPayModalOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("Finding your ride...");
    
    const CANCELLATION_REASONS = [
        "Driver is too far",
        "Changed my mind",
        "Booked by mistake",
        "Longer wait time than expected",
        "Found another ride",
    ];

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (rideStatus === RideStatus.IDLE) {
                setIsLoadingSuggestions(true);
                try {
                    const fetchedSuggestions = await getPersonalizedSuggestions(userName, rideHistory);
                    setSuggestions(fetchedSuggestions);
                } catch (e) {
                    console.error("Failed to fetch suggestions:", e);
                    // Don't show an error, just fail silently.
                } finally {
                    setIsLoadingSuggestions(false);
                }
            }
        };
        fetchSuggestions();
    }, [rideStatus, userName, rideHistory]);

    useEffect(() => {
        const maxPassengers = vehicle === 'BIKE' ? 1 : vehicle === 'AUTO' ? 4 : 4;
        if (passengerCount > maxPassengers) {
            setPassengerCount(maxPassengers);
        }
    }, [vehicle, passengerCount, setPassengerCount]);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        const debouncedEstimate = (p: string, d: string, v: 'BIKE' | 'AUTO' | 'CAR', pc: number) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(async () => {
                if (p.length > 2 && d.length > 2) {
                    setIsEstimating(true);
                    setFareEstimate(null); 
                    try {
                        const estimate = await estimateFare(p, d, v, pc);
                        setFareEstimate(estimate);
                    } catch (e) {
                        console.error("Fare estimation error:", e);
                    } finally {
                        setIsEstimating(false);
                    }
                } else {
                    setFareEstimate(null);
                }
            }, 500);
        };
        debouncedEstimate(pickup, destination, vehicle, passengerCount);
        return () => clearTimeout(timeoutId);
    }, [pickup, destination, vehicle, passengerCount]);

    useEffect(() => {
        let moveInterval: NodeJS.Timeout | null = null;
        let etaInterval: NodeJS.Timeout | null = null;

        if (rideStatus === RideStatus.CONFIRMED && rideDetails) {
            // Initialize ETA
            const initialEta = parseInt(rideDetails.eta.split(' ')[0], 10);
            if (!isNaN(initialEta)) {
                setDynamicEta(initialEta);
            }

            // Simulate driver movement
            moveInterval = setInterval(() => {
                setDriverPosition(prev => {
                    const newTop = parseFloat(prev.top) + (Math.random() - 0.5) * 4;
                    const newLeft = parseFloat(prev.left) + (Math.random() - 0.5) * 4;
                    return {
                        top: `${Math.max(10, Math.min(80, newTop))}%`,
                        left: `${Math.max(10, Math.min(90, newLeft))}%`,
                    };
                });
            }, 2000);

            // Simulate ETA countdown
            etaInterval = setInterval(() => {
                setDynamicEta(prevEta => {
                    if (prevEta !== null && prevEta > 0) {
                        const newEta = prevEta - 1;
                        if (newEta === 2) {
                             showToast("Your driver is 2 minutes away!");
                        }
                        return newEta;
                    }
                    return 0;
                });
            }, 60 * 1000); // Decrement every minute

        }

        return () => {
            if (moveInterval) clearInterval(moveInterval);
            if (etaInterval) clearInterval(etaInterval);
        };
    }, [rideStatus, rideDetails, showToast]);
    
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (rideStatus === RideStatus.SEARCHING) {
            const messages = [
                "Contacting nearby drivers...",
                "Calculating the fastest route...",
                "Checking traffic conditions...",
                "Finalizing your trip details..."
            ];
            let messageIndex = 0;
            setLoadingMessage("Finding your ride..."); // Initial message
            interval = setInterval(() => {
                messageIndex = (messageIndex + 1) % messages.length;
                setLoadingMessage(messages[messageIndex]);
            }, 2500);
        }

        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [rideStatus]);

    const handleFindRide = useCallback(async () => {
        if (!pickup || !destination) {
            setError("Please enter both pickup and destination.");
            return;
        }
        setError(null);
        setRideStatus(RideStatus.SEARCHING);
        try {
            const details = await generateRideDetails(pickup, destination, vehicle, passengerCount);
            setRideDetails(details);
            setRideStatus(RideStatus.CONFIRMED);
            
            const uniqueRideId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            setRideTrackingLink(`${window.location.origin}/track?rideId=${uniqueRideId}`);

            // Admin notification
            const adminEmail = "rishikeshsangolge19@gmail.com";
            const adminPhone = "+918762042431";
            console.log(`[ADMIN NOTIFICATION] Ride booked: ${pickup} to ${destination}. Simulating notification to ${adminEmail} and ${adminPhone}.`);

        } catch (e) {
            console.error(e);
            setError("Could not find a ride. Please try again later.");
            setRideStatus(RideStatus.ERROR);
        }
    }, [pickup, destination, vehicle, passengerCount]);

    const completeRideAction = useCallback(() => {
        if (rideDetails) {
            onRideComplete({
                pickup,
                destination,
                ...rideDetails,
            });
        }
        setPayingMethodId(null);
        setRideStatus(RideStatus.PAID);
        setDynamicEta(null);
        setIsGPayModalOpen(false);
    }, [rideDetails, onRideComplete, pickup, destination]);

    const handlePayment = useCallback((method: PaymentMethod) => {
        setPayingMethodId(method.id);
        
        if (method.type === 'GOOGLE_PAY') {
            setIsGPayModalOpen(true);
            return;
        }
        
        // For CASH or CARD
        const delay = method.type === 'CASH' ? 500 : 2000;
        setTimeout(() => {
            completeRideAction();
        }, delay);
    }, [completeRideAction]);
    
    const handleGPaySuccess = () => {
        showToast("Payment successful!");
        completeRideAction();
    };

    const handleGPayCancel = () => {
        setIsGPayModalOpen(false);
        setPayingMethodId(null); // Stop spinner on the button.
    };

    const handleNewRide = useCallback(() => {
        setRideStatus(RideStatus.IDLE);
        setRideDetails(null);
        setPickup('');
        setDestination('');
        setFareEstimate(null);
        setError(null);
        setDynamicEta(null);
        setSelectedRide(null);
        setIsShowingHistory(false);
        setCancellationStep('idle');
        setCancellationReason('');
        setRideTrackingLink(null);
        setIsShareModalOpen(false);
    }, [setPickup, setDestination]);

    const handleCancelRide = useCallback(async () => {
        if (cancellationStep === 'reason' && !cancellationReason) {
            showToast("Please select a reason.");
            return;
        }
        showToast("Your ride has been cancelled.");
        console.log(`Ride cancelled. Reason: ${cancellationReason}`);
        handleNewRide();
    }, [cancellationStep, cancellationReason, handleNewRide, showToast]);

    const handleShareRequest = useCallback(async () => {
        if (!rideDetails || !rideTrackingLink) return;

        const shareText = `I'm on my way in my Chaloride ride!
Driver: ${rideDetails.driverName} (${rideDetails.vehicleModel} - ${rideDetails.licensePlate})
ETA: ${dynamicEta !== null ? `${dynamicEta} min` : rideDetails.eta}
You can track my ride here: ${rideTrackingLink}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'My Ride Status',
                    text: shareText,
                    url: rideTrackingLink,
                });
                showToast('Ride status shared!');
            } catch (error) {
                console.error('Error sharing:', error);
            }
        } else {
            setIsShareModalOpen(true);
        }
    }, [rideDetails, rideTrackingLink, dynamicEta, showToast]);
    
    const handleSuggestionClick = (suggestion: Suggestion) => {
        if (suggestion.type === 'BOOK_RIDE') {
            setDestination(suggestion.payload);
            showToast(`Destination set to ${suggestion.title}`);
        } else if (suggestion.type === 'EXPLORE') {
            setInitialExploreQuery(suggestion.payload);
            setCurrentView(AppView.EXPLORE);
        }
    };

    const renderSuggestions = () => {
        const getIcon = (icon: Suggestion['icon']) => {
            switch(icon) {
                case 'HOME': return <HomeIcon className="w-6 h-6 text-white"/>;
                case 'WORK': return <WorkIcon className="w-6 h-6 text-white"/>;
                case 'CAFE': return <CafeIcon className="w-6 h-6 text-white"/>;
                case 'LANDMARK': return <LandmarkIcon className="w-6 h-6 text-white"/>;
                default: return <SuggestionRideIcon className="w-6 h-6 text-white"/>;
            }
        }
        const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500'];

        return (
            <div className="p-4">
                <div className="flex items-center mb-3">
                    <SparklesIcon className="w-5 h-5 text-yellow-500 mr-2"/>
                    <h3 className="font-bold text-lg text-gray-800">For You</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {suggestions.map((s, i) => (
                        <button key={i} onClick={() => handleSuggestionClick(s)} className={`p-3 rounded-xl text-white shadow-lg text-left flex flex-col justify-between h-28 hover:scale-105 transition-transform ${colors[i % colors.length]}`}>
                            <div>
                                <div className="p-2 bg-white/20 rounded-full w-10 h-10 mb-2">
                                    {getIcon(s.icon)}
                                </div>
                                <p className="font-bold text-sm">{s.title}</p>
                            </div>
                            <p className="text-xs opacity-80">{s.description}</p>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    const renderVehicleSelector = () => (
        <div className="flex justify-around items-center bg-gray-100 p-2 rounded-lg my-4">
            {(['BIKE', 'AUTO', 'CAR'] as const).map(v => (
                <button
                    key={v}
                    onClick={() => setVehicle(v)}
                    className={`flex flex-col items-center p-2 rounded-lg w-24 transition-all duration-200 ${vehicle === v ? 'bg-blue-500 text-white shadow-lg scale-105' : 'bg-white hover:bg-gray-200'}`}
                >
                    {v === 'BIKE' && <BikeIcon />}
                    {v === 'AUTO' && <AutoIcon />}
                    {v === 'CAR' && <CarIcon className="w-8 h-8"/>}
                    <span className="font-semibold text-sm mt-1">{v}</span>
                </button>
            ))}
        </div>
    );
    
    const renderPassengerSelector = () => {
        const maxPassengers = vehicle === 'BIKE' ? 1 : vehicle === 'AUTO' ? 4 : 4;

        const handleIncrement = () => {
            if (passengerCount < maxPassengers) {
                setPassengerCount(passengerCount + 1);
            }
        };

        const handleDecrement = () => {
            if (passengerCount > 1) {
                setPassengerCount(passengerCount - 1);
            }
        };

        return (
            <div className="flex justify-between items-center bg-gray-100 p-2 rounded-lg mb-4">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                        <UserIcon className="w-5 h-5 text-gray-600"/>
                    </div>
                    <span className="font-semibold text-gray-800">Passengers</span>
                </div>
                <div className="flex items-center space-x-3 bg-white px-2 py-1 rounded-lg shadow-sm">
                    <button onClick={handleDecrement} disabled={passengerCount <= 1} className="p-1 rounded-full text-gray-600 hover:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed">
                        <MinusIcon className="w-5 h-5"/>
                    </button>
                    <span className="font-bold text-lg text-gray-800 w-5 text-center">{passengerCount}</span>
                    <button onClick={handleIncrement} disabled={passengerCount >= maxPassengers} className="p-1 rounded-full text-gray-600 hover:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed">
                        <PlusIcon className="w-5 h-5"/>
                    </button>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (rideStatus) {
            case RideStatus.SEARCHING:
                return (
                    <div className="p-6 text-center">
                        <LoadingSpinner />
                        <p className="mt-4 font-semibold text-lg text-gray-700">{loadingMessage}</p>
                        <p className="text-gray-500">Please wait while we connect you with a nearby driver.</p>
                    </div>
                );
            case RideStatus.CONFIRMED:
                 if (!rideDetails) return null;
                 return (
                    <div className="p-4">
                        <div className="bg-white rounded-lg p-4 shadow-md text-center">
                            <h3 className="text-lg font-bold text-blue-600">Your driver will arrive in</h3>
                            <p className="text-4xl font-bold text-gray-800">{dynamicEta !== null ? `${dynamicEta} min` : rideDetails.eta}</p>
                        </div>
                         <div className="mt-4">
                             <RideDetailsCard 
                                details={rideDetails}
                                paymentMethods={paymentMethods}
                                onPay={handlePayment}
                                payingMethodId={payingMethodId}
                                onCancelRequest={() => setCancellationStep('confirm')}
                                onShareRequest={handleShareRequest}
                             />
                         </div>
                    </div>
                );
            case RideStatus.PAID:
                return (
                    <div className="p-6 text-center">
                        <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-800">Payment Successful!</h2>
                        <p className="text-gray-600 mt-2">Thank you for riding with us. We hope to see you again soon.</p>
                        <button onClick={handleNewRide} className="mt-6 w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                            Book Another Ride
                        </button>
                    </div>
                );
            case RideStatus.ERROR:
                return (
                    <div className="p-6 text-center">
                        <ErrorIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-800">Something Went Wrong</h2>
                        <p className="text-gray-600 mt-2">{error}</p>
                        <button onClick={handleNewRide} className="mt-6 w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                            Try Again
                        </button>
                    </div>
                );
            case RideStatus.IDLE:
            default:
                return (
                    <>
                        {isLoadingSuggestions ? <SuggestionsSkeleton /> : suggestions.length > 0 && renderSuggestions()}
                        <div className="p-4 border-t border-gray-200">
                            <div className="space-y-3">
                                <input type="text" value={pickup} onChange={e => setPickup(e.target.value)} placeholder="Enter pickup location" className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500" />
                                <input type="text" value={destination} onChange={e => setDestination(e.target.value)} placeholder="Enter destination" className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500" />
                            </div>
                            {isEstimating ? (
                                <div className="text-center p-4 text-gray-500">Estimating fare...</div>
                            ) : fareEstimate ? (
                                <div className="text-center p-3 my-2 bg-blue-50 rounded-lg">
                                    <p className="font-semibold text-blue-800">Est. Fare: ₹{fareEstimate.estimatedFare}</p>
                                </div>
                            ) : null}
                            {renderVehicleSelector()}
                            {renderPassengerSelector()}
                            <button onClick={handleFindRide} disabled={!pickup || !destination} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors shadow-md disabled:bg-gray-400">
                                Find Ride
                            </button>
                        </div>
                    </>
                );
        }
    };
    
    return (
        <div className="h-full flex flex-col bg-gray-100">
            <div className="flex-grow relative">
                {isMapVisible && (
                    <div className="absolute inset-0">
                        <MapView 
                            showDriver={rideStatus === RideStatus.CONFIRMED && !!rideDetails}
                            driverPosition={driverPosition}
                            vehicleType={vehicle}
                        />
                    </div>
                )}

                {(isShowingHistory || selectedRide) && (
                     <div className="absolute inset-0 bg-white p-4 overflow-y-auto z-40 animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold">{selectedRide ? 'Ride Details' : 'Ride History'}</h2>
                            <button onClick={() => { setSelectedRide(null); setIsShowingHistory(false); }} className="text-gray-500 hover:text-gray-800 font-bold text-2xl">&times;</button>
                        </div>
                        {selectedRide ? (
                            <div className="space-y-4">
                                <DetailRow icon={<MapPinIcon className="w-5 h-5 text-blue-600"/>} label="From" value={selectedRide.pickup} />
                                <DetailRow icon={<MapPinIcon className="w-5 h-5 text-green-600"/>} label="To" value={selectedRide.destination} />
                                <DetailRow icon={<CalendarIcon className="w-5 h-5 text-gray-600"/>} label="Date" value={selectedRide.date} />
                                <hr className="my-4"/>
                                <DetailRow icon={<UserIcon className="w-5 h-5 text-blue-600"/>} label="Driver" value={selectedRide.driverName} />
                                <DetailRow icon={<CarIcon className="w-5 h-5 text-gray-600"/>} label="Vehicle" value={selectedRide.vehicleModel} />
                                <DetailRow icon={<LicenseIcon className="w-5 h-5 text-gray-600"/>} label="License" value={selectedRide.licensePlate} />
                                <DetailRow icon={<PriceIcon className="w-5 h-5 text-yellow-600"/>} label="Fare Paid" value={`₹${selectedRide.fare}`} />
                            </div>
                        ) : rideHistory.length > 0 ? (
                            <div className="space-y-3">
                                {rideHistory.map(ride => (
                                    <div key={ride.id} onClick={() => setSelectedRide(ride)} className="bg-gray-50 p-3 rounded-lg cursor-pointer hover:bg-gray-100">
                                        <p className="font-semibold">{ride.destination}</p>
                                        <p className="text-sm text-gray-500">{ride.date}</p>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-center text-gray-500 mt-8">No past rides yet.</p>}
                     </div>
                )}
            </div>

            <div className="bg-white rounded-t-2xl shadow-up-strong z-10">
                {rideStatus === RideStatus.IDLE && (
                    <div className="p-2 flex justify-end items-center border-b border-gray-200">
                        <button onClick={() => setIsShowingHistory(true)} className="p-2 text-gray-500 hover:text-blue-600" aria-label="Show ride history"><HistoryIcon className="w-6 h-6"/></button>
                        <button onClick={() => setIsMapVisible(!isMapVisible)} className="p-2 text-gray-500 hover:text-blue-600" aria-label={isMapVisible ? "Show list view" : "Show map view"}>
                            {isMapVisible ? <ListIcon className="w-6 h-6"/> : <MapViewIcon className="w-6 h-6"/>}
                        </button>
                    </div>
                )}
                {renderContent()}
            </div>
            
            {cancellationStep !== 'idle' && (
                <div className="absolute inset-0 bg-black/50 z-30 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm animate-fade-in-up">
                        {cancellationStep === 'confirm' && (
                            <>
                                <h3 className="text-xl font-bold text-center mb-2">Cancel Ride?</h3>
                                <p className="text-center text-gray-600 mb-6">Are you sure you want to cancel this ride? A cancellation fee may apply.</p>
                                <div className="flex space-x-3">
                                    <button onClick={() => setCancellationStep('idle')} className="w-full bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">No, Keep Ride</button>
                                    <button onClick={() => setCancellationStep('reason')} className="w-full bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600">Yes, Cancel</button>
                                </div>
                            </>
                        )}
                        {cancellationStep === 'reason' && (
                            <>
                                <h3 className="text-xl font-bold text-center mb-4">Why are you cancelling?</h3>
                                <div className="space-y-2">
                                    {CANCELLATION_REASONS.map(reason => (
                                        <button key={reason} onClick={() => setCancellationReason(reason)} className={`w-full text-left p-3 border rounded-lg ${cancellationReason === reason ? 'bg-blue-100 border-blue-400' : 'hover:bg-gray-50'}`}>
                                            {reason}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={handleCancelRide} disabled={!cancellationReason} className="mt-4 w-full bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 disabled:bg-gray-400">Confirm Cancellation</button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {isShareModalOpen && (
                <div className="absolute inset-0 bg-black/50 z-30 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm animate-fade-in-up">
                        <h3 className="text-xl font-bold text-center mb-2">Share Your Ride</h3>
                        <p className="text-center text-gray-600 mb-6">Your browser doesn't support direct sharing. Copy the link below to share it manually.</p>
                        <div className="flex items-center space-x-2">
                            <input type="text" readOnly value={rideTrackingLink || ''} className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50"/>
                            <button onClick={() => {
                                if (rideTrackingLink) {
                                    navigator.clipboard.writeText(rideTrackingLink);
                                    showToast('Link copied to clipboard!');
                                }
                            }} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">Copy</button>
                        </div>
                        <button onClick={() => setIsShareModalOpen(false)} className="mt-4 w-full bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">Close</button>
                    </div>
                </div>
            )}

            {isGPayModalOpen && rideDetails && (
                <GooglePayModal
                    amount={rideDetails.fare}
                    onSuccess={handleGPaySuccess}
                    onCancel={handleGPayCancel}
                />
            )}
        </div>
    );
};

export default BookingView;