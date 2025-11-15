import React, { useState, useCallback, useEffect } from 'react';
import { AppView, PaymentMethod, CompletedRide, RideDetails } from './types';
import BookingView from './components/BookingView';
import ChatBotView from './components/ChatBotView';
import ExploreView from './components/ExploreView';
import PaymentView from './components/PaymentView';
import VoiceAssistant from './components/VoiceAssistant';
import ToastNotification from './components/ToastNotification';
import AuthView from './components/AuthView';
import { RideIcon, ExploreIcon, WalletIcon, LogoIcon, MicIcon, UserIcon, ChatIcon } from './components/icons/Icons';

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentView, setCurrentView] = useState<AppView>(AppView.BOOKING);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
        { id: 'CASH', type: 'CASH' },
        { id: '1', type: 'CARD', brand: 'Visa', last4: '4242' }
    ]);
    const [rideHistory, setRideHistory] = useState<CompletedRide[]>([]);
    const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [userProfilePhoto, setUserProfilePhoto] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>('');
    const [initialExploreQuery, setInitialExploreQuery] = useState('');


    // State for booking form
    const [pickup, setPickup] = useState('');
    const [destination, setDestination] = useState('');
    const [vehicle, setVehicle] = useState<'BIKE' | 'AUTO' | 'CAR'>('CAR');
    const [passengerCount, setPassengerCount] = useState<number>(1);

    useEffect(() => {
        const checkMobile = () => {
            const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            setIsMobile(isMobileDevice);
        };
        checkMobile();
    }, []);
    
    useEffect(() => {
        const storedHistory = localStorage.getItem('chalorideHistory');
        if (storedHistory) {
            setRideHistory(JSON.parse(storedHistory));
        }
    }, []);

    const handleAuthSuccess = () => {
        setIsAuthenticated(true);
    };

    const handleRideComplete = useCallback((ride: { pickup: string; destination: string; } & RideDetails) => {
        const newCompletedRide: CompletedRide = {
            ...ride,
            id: new Date().toISOString(),
            date: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        };
        setRideHistory(prev => {
            const updatedHistory = [newCompletedRide, ...prev];
            localStorage.setItem('chalorideHistory', JSON.stringify(updatedHistory));
            return updatedHistory;
        });
    }, []);

    const handleRateRide = useCallback((rideId: string, rating: number) => {
        setRideHistory(prev => {
            const updatedHistory = prev.map(ride => 
                ride.id === rideId ? { ...ride, rating } : ride
            );
            localStorage.setItem('chalorideHistory', JSON.stringify(updatedHistory));
            return updatedHistory;
        });
    }, []);

    const showToast = (message: string) => {
        setToastMessage(message);
    };

    if (!isAuthenticated) {
        return <AuthView onAuthSuccess={handleAuthSuccess} setUserName={setUserName} />;
    }

    const renderView = () => {
        switch (currentView) {
            case AppView.BOOKING:
                return <BookingView 
                    pickup={pickup}
                    setPickup={setPickup}
                    destination={destination}
                    setDestination={setDestination}
                    vehicle={vehicle}
                    setVehicle={setVehicle}
                    passengerCount={passengerCount}
                    setPassengerCount={setPassengerCount}
                    paymentMethods={paymentMethods}
                    rideHistory={rideHistory}
                    onRideComplete={handleRideComplete}
                    showToast={showToast}
                    userName={userName}
                    setCurrentView={setCurrentView}
                    setInitialExploreQuery={setInitialExploreQuery}
                />;
            case AppView.CHAT:
                return <ChatBotView />;
            case AppView.EXPLORE:
                return <ExploreView initialQuery={initialExploreQuery} />;
            case AppView.PAYMENT:
                return <PaymentView 
                            paymentMethods={paymentMethods} 
                            setPaymentMethods={setPaymentMethods} 
                            userProfilePhoto={userProfilePhoto}
                            setUserProfilePhoto={setUserProfilePhoto}
                            userName={userName}
                            setUserName={setUserName}
                        />;
            default:
                return <BookingView 
                    pickup={pickup}
                    setPickup={setPickup}
                    destination={destination}
                    setDestination={setDestination}
                    vehicle={vehicle}
                    setVehicle={setVehicle}
                    passengerCount={passengerCount}
                    setPassengerCount={setPassengerCount}
                    paymentMethods={paymentMethods}
                    rideHistory={rideHistory}
                    onRideComplete={handleRideComplete}
                    showToast={showToast}
                    userName={userName}
                    setCurrentView={setCurrentView}
                    setInitialExploreQuery={setInitialExploreQuery}
                />;
        }
    };

    const NavItem: React.FC<{ view: AppView; label: string; icon: React.ReactNode }> = ({ view, label, icon }) => (
        <button
            onClick={() => {
                if (view === AppView.EXPLORE) setInitialExploreQuery(''); // Reset query when manually clicking explore
                setCurrentView(view);
            }}
            className={`flex flex-col items-center justify-center w-full transition-colors duration-200 ${currentView === view ? 'text-blue-600' : 'text-gray-500'}`}
        >
            {icon}
            <span className="text-xs font-medium mt-1">{label}</span>
        </button>
    );

    return (
        <div className="h-screen w-screen bg-gray-50 flex flex-col max-w-md mx-auto shadow-2xl relative">
            {toastMessage && <ToastNotification message={toastMessage} onClose={() => setToastMessage(null)} />}
            <header className="bg-white p-4 shadow-md z-10 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <LogoIcon className="w-8 h-8 text-gray-800"/>
                    <h1 className="text-2xl font-bold text-gray-800">Chaloride</h1>
                </div>
                 <button onClick={() => setCurrentView(AppView.PAYMENT)} className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden transition-transform transform hover:scale-105">
                    {userProfilePhoto ? (
                        <img src={userProfilePhoto} alt="User profile" className="w-full h-full object-cover" />
                    ) : (
                        <UserIcon className="w-6 h-6 text-gray-500" />
                    )}
                </button>
            </header>
            
            <main className="flex-grow overflow-y-auto relative">
                <div key={currentView} className="animate-fade-in">
                    {renderView()}
                </div>
            </main>

            {isMobile && currentView === AppView.BOOKING && (
                 <button
                    onClick={() => setIsVoiceAssistantOpen(true)}
                    className="absolute bottom-24 right-5 z-30 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-110 active:scale-95"
                    aria-label="Start Voice Assistant"
                >
                    <MicIcon className="w-7 h-7"/>
                </button>
            )}

            {isVoiceAssistantOpen && (
                <VoiceAssistant
                    setPickup={setPickup}
                    setDestination={setDestination}
                    setVehicle={setVehicle}
                    setCurrentView={setCurrentView}
                    onClose={() => setIsVoiceAssistantOpen(false)}
                />
            )}

            <footer className="bg-white w-full border-t border-gray-200 p-2 grid grid-cols-4 gap-2 shadow-up z-20">
                <NavItem view={AppView.BOOKING} label="Ride" icon={<RideIcon className="w-6 h-6"/>} />
                <NavItem view={AppView.EXPLORE} label="Explore" icon={<ExploreIcon className="w-6 h-6"/>} />
                <NavItem view={AppView.CHAT} label="Assistant" icon={<ChatIcon className="w-6 h-6"/>} />
                <NavItem view={AppView.PAYMENT} label="Wallet" icon={<WalletIcon className="w-6 h-6"/>} />
            </footer>
        </div>
    );
};

export default App;