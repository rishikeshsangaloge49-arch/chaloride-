import React, { useState, useRef, useEffect } from 'react';
import { LogoIcon, PhoneIcon, EnvelopeIcon, UserIcon } from './icons/Icons';

interface AuthViewProps {
    onAuthSuccess: () => void;
    setUserName: (name: string) => void;
}

const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess, setUserName }) => {
    const [step, setStep] = useState<'entry' | 'otp' | 'profile'>('entry');
    const [authMethod, setAuthMethod] = useState<'PHONE' | 'EMAIL'>('PHONE');
    const [contactInfo, setContactInfo] = useState('');
    const [name, setName] = useState('');
    const [otp, setOtp] = useState(['', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (step === 'otp' && otpInputsRef.current[0]) {
            otpInputsRef.current[0]?.focus();
        }
    }, [step]);

    const handleSendOtp = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (authMethod === 'PHONE' && !/^\d{10}$/.test(contactInfo)) {
            setError('Please enter a valid 10-digit phone number.');
            return;
        }
        if (authMethod === 'EMAIL' && !/\S+@\S+\.\S+/.test(contactInfo)) {
            setError('Please enter a valid email address.');
            return;
        }

        setIsLoading(true);
        console.log(`Simulating OTP sent to ${contactInfo}. The code is 1234.`);
        setTimeout(() => {
            setIsLoading(false);
            setStep('otp');
        }, 1500);
    };
    
    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);

        // Move to next input
        if (value && index < otp.length - 1) {
            otpInputsRef.current[index + 1]?.focus();
        }
    };
    
    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpInputsRef.current[index - 1]?.focus();
        }
    };

    const handleVerifyOtp = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const enteredOtp = otp.join('');
        if (enteredOtp.length < 4) {
            setError('Please enter the complete 4-digit OTP.');
            return;
        }

        setIsLoading(true);
        setTimeout(() => {
            if (enteredOtp === '1234') {
                const adminPhoneNumber = '+918762042431';
                console.log(`[ADMIN NOTIFICATION] Simulating notification sent to ${adminPhoneNumber}: User with contact info "${contactInfo}" has successfully logged in.`);
                setStep('profile');
            } else {
                setError('Invalid OTP. Please try again.');
                setOtp(['', '', '', '']);
                otpInputsRef.current[0]?.focus();
            }
            setIsLoading(false);
        }, 1500);
    };

    const handleProfileSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (name.trim().length < 2) {
            setError('Please enter a valid name.');
            return;
        }
        setUserName(name.trim());
        onAuthSuccess();
    };
    
    const handleResendOtp = () => {
        setOtp(['', '', '', '']);
        setStep('entry');
        setError('');
    }

    const renderEntryStep = () => (
        <div className="w-full animate-fade-in-up">
            <div className="flex border border-gray-200 rounded-lg p-1 mb-6 bg-gray-100">
                <button
                    onClick={() => setAuthMethod('PHONE')}
                    className={`w-1/2 py-2 rounded-md font-semibold transition-colors ${authMethod === 'PHONE' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                >
                    Phone
                </button>
                <button
                    onClick={() => setAuthMethod('EMAIL')}
                    className={`w-1/2 py-2 rounded-md font-semibold transition-colors ${authMethod === 'EMAIL' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                >
                    Email
                </button>
            </div>
            <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        {authMethod === 'PHONE' ? <PhoneIcon className="w-5 h-5 text-gray-400" /> : <EnvelopeIcon className="w-5 h-5 text-gray-400" />}
                    </div>
                    <input
                        type={authMethod === 'PHONE' ? 'tel' : 'email'}
                        value={contactInfo}
                        onChange={(e) => setContactInfo(e.target.value)}
                        placeholder={authMethod === 'PHONE' ? 'Enter your phone number' : 'Enter your email address'}
                        className="w-full p-3 pl-10 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500"
                        maxLength={authMethod === 'PHONE' ? 10 : undefined}
                    />
                </div>
                 {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors shadow-md disabled:bg-blue-400 flex items-center justify-center"
                >
                    {isLoading ? 'Sending...' : 'Send OTP'}
                </button>
            </form>
        </div>
    );

    const renderOtpStep = () => (
        <div className="w-full animate-fade-in-up text-center">
             <p className="text-gray-600 mb-2">Enter the 4-digit code sent to</p>
             <p className="font-semibold text-gray-800 mb-6">{contactInfo}</p>
             <form onSubmit={handleVerifyOtp}>
                <div className="flex justify-center space-x-3 mb-4">
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={el => { otpInputsRef.current[index] = el; }}
                            type="tel"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                            className="w-12 h-14 text-center text-2xl font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    ))}
                </div>
                 {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors shadow-md disabled:bg-blue-400 flex items-center justify-center"
                >
                     {isLoading ? 'Verifying...' : 'Verify OTP'}
                </button>
             </form>
             <div className="mt-6 text-sm">
                <span className="text-gray-500">Didn't receive code? </span>
                <button onClick={handleResendOtp} className="font-semibold text-blue-600 hover:underline">Resend OTP</button>
             </div>
        </div>
    );

    const renderProfileStep = () => (
        <div className="w-full animate-fade-in-up text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-2">One last step!</h3>
            <p className="text-gray-600 mb-6">What should we call you?</p>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="relative">
                     <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <UserIcon className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full p-3 pl-10 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                >
                    Continue
                </button>
            </form>
        </div>
    );

    return (
        <div className="h-screen w-screen bg-gray-50 flex flex-col justify-center items-center max-w-md mx-auto p-8">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <LogoIcon className="w-16 h-16 text-gray-800 mx-auto mb-4"/>
                    <h1 className="text-3xl font-bold text-gray-800">Welcome to</h1>
                    <h2 className="text-2xl font-semibold text-blue-600">Chaloride</h2>
                </div>
                
                <div className="bg-white p-8 rounded-2xl shadow-xl">
                   {step === 'entry' && renderEntryStep()}
                   {step === 'otp' && renderOtpStep()}
                   {step === 'profile' && renderProfileStep()}
                </div>
            </div>
        </div>
    );
};

export default AuthView;