
import React, { useState } from 'react';
import { PaymentMethod } from '../types';
import { CreditCardIcon, TrashIcon, WalletIcon, CashIcon, GooglePayIcon, PhonePeIcon, UserIcon } from './icons/Icons';
import PhotoCaptureView from './PhotoCaptureView';

interface PaymentViewProps {
    paymentMethods: PaymentMethod[];
    setPaymentMethods: React.Dispatch<React.SetStateAction<PaymentMethod[]>>;
    userProfilePhoto: string | null;
    setUserProfilePhoto: (photo: string | null) => void;
    userName: string;
    setUserName: (name: string) => void;
}

const PaymentView: React.FC<PaymentViewProps> = ({ paymentMethods, setPaymentMethods, userProfilePhoto, setUserProfilePhoto, userName, setUserName }) => {
    const [isAddingCard, setIsAddingCard] = useState(false);
    const [cardNumber, setCardNumber] = useState('');
    const [error, setError] = useState('');
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(userName);

    const handleAddCard = (e: React.FormEvent) => {
        e.preventDefault();
        if (cardNumber.length < 16 || !/^\d+$/.test(cardNumber)) {
            setError('Please enter a valid 16-digit card number.');
            return;
        }

        const newCard: PaymentMethod = {
            id: new Date().toISOString(),
            type: 'CARD',
            brand: 'Visa', // Dummy brand
            last4: cardNumber.slice(-4),
        };

        setPaymentMethods(prev => [...prev, newCard]);
        setCardNumber('');
        setError('');
        setIsAddingCard(false);
    };

    const handleDeleteCard = (id: string) => {
        setPaymentMethods(prev => prev.filter(card => card.id !== id));
    };

    const handleAddUpi = (type: 'GOOGLE_PAY' | 'PHONE_PE') => {
        if (!paymentMethods.some(method => method.type === type)) {
            const newUpiMethod: PaymentMethod = { id: type, type: type };
            setPaymentMethods(prev => [...prev, newUpiMethod]);
        }
    };

    const handlePhotoSet = (photoDataUrl: string) => {
        setUserProfilePhoto(photoDataUrl);
        setIsPhotoModalOpen(false);
    };

    const handleNameSave = () => {
        if (nameInput.trim()) {
            setUserName(nameInput.trim());
            setIsEditingName(false);
        }
    };

    const hasGooglePay = paymentMethods.some(m => m.type === 'GOOGLE_PAY');
    const hasPhonePe = paymentMethods.some(m => m.type === 'PHONE_PE');

    const PaymentMethodItem: React.FC<{ method: PaymentMethod }> = ({ method }) => {
        const getIcon = () => {
            switch (method.type) {
                case 'CASH': return <CashIcon className="w-8 h-8 text-green-600 mr-4" />;
                case 'CARD': return <CreditCardIcon className="w-8 h-8 text-blue-600 mr-4" />;
                case 'GOOGLE_PAY': return <GooglePayIcon className="w-8 h-8 text-gray-700 mr-4" />;
                case 'PHONE_PE': return <PhonePeIcon className="w-8 h-8 text-purple-600 mr-4" />;
                default: return null;
            }
        };

        const getLabel = () => {
             switch (method.type) {
                case 'CASH': return 'Cash';
                case 'CARD': return `${method.brand} **** ${method.last4}`;
                case 'GOOGLE_PAY': return 'Google Pay';
                case 'PHONE_PE': return 'PhonePe';
                default: return 'Unknown';
            }
        };

        return (
             <div className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between">
                <div className="flex items-center">
                    {getIcon()}
                    <div>
                        <p className="font-semibold text-gray-700">{getLabel()}</p>
                        {method.type === 'CARD' && <p className="text-sm text-gray-500">Expires 12/26</p>}
                    </div>
                </div>
                {method.type === 'CARD' && (
                    <button onClick={() => handleDeleteCard(method.id)} className="text-gray-400 hover:text-red-500">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                )}
            </div>
        )
    };

    return (
        <>
        {isPhotoModalOpen && <PhotoCaptureView onClose={() => setIsPhotoModalOpen(false)} onPhotoSet={handlePhotoSet} />}
        <div className="p-4 h-full flex flex-col bg-gray-50">
            <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex items-center space-x-4">
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {userProfilePhoto ? (
                        <img src={userProfilePhoto} alt="User profile" className="w-full h-full object-cover" />
                    ) : (
                        <UserIcon className="w-12 h-12 text-gray-400" />
                    )}
                </div>
                <div>
                    {isEditingName ? (
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={nameInput}
                                onChange={e => setNameInput(e.target.value)}
                                className="text-xl font-bold text-gray-800 border-b-2 border-blue-500 focus:outline-none bg-transparent"
                                autoFocus
                            />
                            <button onClick={handleNameSave} className="text-sm font-semibold text-green-600 hover:underline">Save</button>
                            <button onClick={() => { setIsEditingName(false); setNameInput(userName); }} className="text-sm text-gray-500 hover:underline">Cancel</button>
                        </div>
                    ) : (
                        <h2 className="text-xl font-bold text-gray-800">{userName || 'Your Profile'}</h2>
                    )}
                    <div className="mt-1">
                        {!isEditingName && (
                            <button onClick={() => { setNameInput(userName); setIsEditingName(true); }} className="text-sm font-semibold text-blue-600 hover:underline">
                                Edit Name
                            </button>
                        )}
                        <button onClick={() => setIsPhotoModalOpen(true)} className={`text-sm font-semibold text-blue-600 hover:underline ${!isEditingName ? 'ml-4' : ''}`}>
                            Change Photo
                        </button>
                    </div>
                </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-4">Payment Methods</h2>
            
            <div className="flex-grow space-y-4">
                {paymentMethods.length > 0 ? (
                    paymentMethods.map(method => <PaymentMethodItem key={method.id} method={method} />)
                ) : (
                    !isAddingCard && (
                        <div className="text-center text-gray-500 pt-16 animate-fade-in-up">
                            <WalletIcon className="w-16 h-16 mx-auto mb-4 text-gray-300"/>
                            <p className="font-semibold text-lg">Your Wallet is Empty</p>
                            <p>Add a card or UPI to enjoy faster checkout for your rides.</p>
                        </div>
                    )
                )}

                {isAddingCard && (
                    <form onSubmit={handleAddCard} className="bg-white p-4 rounded-lg shadow-sm space-y-4 animate-fade-in-up">
                        <h3 className="font-semibold text-lg">Add New Card</h3>
                        <div>
                            <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                            <input
                                type="text"
                                id="cardNumber"
                                value={cardNumber}
                                onChange={(e) => setCardNumber(e.target.value)}
                                placeholder=".... .... .... ...."
                                maxLength={16}
                                className="w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                        <div className="flex items-center space-x-2">
                             <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">
                                Save Card
                            </button>
                            <button type="button" onClick={() => setIsAddingCard(false)} className="w-full bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300">
                                Cancel
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {!isAddingCard && (
                 <div className="mt-4 space-y-3">
                    <button onClick={() => setIsAddingCard(true)} className="w-full bg-white border border-gray-300 text-gray-800 font-bold py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors shadow-sm">
                        Add Debit/Credit Card
                    </button>
                    {(!hasGooglePay || !hasPhonePe) && (
                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-gray-300"></div>
                            <span className="flex-shrink mx-4 text-gray-400 text-sm">or add UPI</span>
                            <div className="flex-grow border-t border-gray-300"></div>
                        </div>
                    )}
                     {!hasGooglePay && (
                        <button onClick={() => handleAddUpi('GOOGLE_PAY')} className="w-full bg-white border border-gray-300 text-gray-800 font-bold py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors shadow-sm flex items-center justify-center">
                            <GooglePayIcon className="w-6 h-6 mr-3" />
                            Add Google Pay
                        </button>
                     )}
                     {!hasPhonePe && (
                        <button onClick={() => handleAddUpi('PHONE_PE')} className="w-full bg-white border border-gray-300 text-gray-800 font-bold py-3 px-4 rounded-lg hover:bg-gray-100 transition-colors shadow-sm flex items-center justify-center">
                            <PhonePeIcon className="w-6 h-6 mr-3" />
                            Add PhonePe
                        </button>
                     )}
                </div>
            )}
        </div>
        </>
    );
};

export default PaymentView;
