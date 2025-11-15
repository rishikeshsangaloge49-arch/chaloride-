import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { GooglePayIcon } from './icons/Icons';

interface GooglePayModalProps {
    amount: string;
    onSuccess: () => void;
    onCancel: () => void;
}

const GooglePayModal: React.FC<GooglePayModalProps> = ({ amount, onSuccess, onCancel }) => {
    const [isProcessing, setIsProcessing] = useState(false);

    const handlePay = () => {
        setIsProcessing(true);
        // Simulate payment processing
        setTimeout(() => {
            onSuccess();
        }, 2500);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col items-center animate-fade-in-up">
                <GooglePayIcon className="w-16 h-16 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800">Chaloride</h2>
                <p className="text-gray-500 mt-1">Paying for your ride</p>
                <div className="my-6 text-center">
                    <p className="text-lg text-gray-600">Amount to Pay</p>
                    <p className="text-5xl font-bold text-gray-900">₹{amount}</p>
                </div>

                {isProcessing ? (
                    <div className="text-center">
                        <LoadingSpinner />
                        <p className="mt-2 text-gray-600">Processing payment...</p>
                    </div>
                ) : (
                    <div className="w-full space-y-3">
                        <button
                            onClick={handlePay}
                            className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center"
                        >
                            Pay with Google Pay
                        </button>
                        <button
                            onClick={onCancel}
                            className="w-full bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GooglePayModal;
