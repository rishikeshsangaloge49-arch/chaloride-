
import React from 'react';
import { BikeIcon, AutoIcon, CarIcon } from './icons/Icons';

interface MapViewProps {
    showDriver?: boolean;
    driverPosition?: { top: string; left: string };
    vehicleType?: 'BIKE' | 'AUTO' | 'CAR';
}

const MapView: React.FC<MapViewProps> = ({ showDriver = false, driverPosition = { top: '50%', left: '50%' }, vehicleType = 'CAR' }) => {
    
    const renderVehicleIcon = () => {
        switch (vehicleType) {
            case 'BIKE':
                return <BikeIcon />;
            case 'AUTO':
                return <AutoIcon />;
            case 'CAR':
            default:
                return <CarIcon className="w-8 h-8 text-blue-600" />;
        }
    };

    return (
        <div className="absolute inset-0 w-full h-full">
            <img 
                src="https://picsum.photos/seed/basavakalyan/800/1200" 
                alt="Map of Basavakalyan" 
                className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20"></div>
            
            {showDriver && (
                <div className="absolute transition-all duration-1000 ease-in-out" style={{ top: driverPosition.top, left: driverPosition.left }}>
                    <div className="p-2 bg-white rounded-full shadow-lg">
                        {renderVehicleIcon()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapView;