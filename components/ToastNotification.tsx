
import React, { useEffect, useState } from 'react';
import { BellIcon } from './icons/Icons';

interface ToastNotificationProps {
  message: string;
  onClose: () => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ message, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const inTimer = setTimeout(() => setIsVisible(true), 50);

    // Set timer to animate out and then call onClose
    const outTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation to finish before unmounting
    }, 4000); // Show for 4 seconds

    return () => {
      clearTimeout(inTimer);
      clearTimeout(outTimer);
    };
  }, [message, onClose]);

  return (
    <div
      className={`fixed top-5 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 ease-in-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'
      }`}
    >
      <div className="bg-white rounded-full shadow-lg p-3 flex items-center space-x-3">
        <div className="bg-blue-100 p-2 rounded-full">
           <BellIcon className="w-5 h-5 text-blue-600" />
        </div>
        <p className="font-semibold text-gray-700 pr-2">{message}</p>
      </div>
    </div>
  );
};

export default ToastNotification;
