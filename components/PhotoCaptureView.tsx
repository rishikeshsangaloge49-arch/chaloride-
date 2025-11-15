
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CameraIcon, GalleryIcon, CloseIcon } from './icons/Icons';

interface PhotoCaptureViewProps {
    onClose: () => void;
    onPhotoSet: (photoDataUrl: string) => void;
}

const PhotoCaptureView: React.FC<PhotoCaptureViewProps> = ({ onClose, onPhotoSet }) => {
    const [view, setView] = useState<'options' | 'camera'>('options');
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const cleanupCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const startCamera = async () => {
        setError(null);
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setView('camera');
            } else {
                setError('Camera not supported on this device.');
            }
        } catch (err) {
            console.error('Camera access error:', err);
            setError('Could not access the camera. Please check your browser permissions.');
        }
    };

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            const dataUrl = canvas.toDataURL('image/jpeg');
            onPhotoSet(dataUrl);
            cleanupCamera();
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    onPhotoSet(e.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    useEffect(() => {
        // Cleanup camera on component unmount
        return () => {
            cleanupCamera();
        };
    }, [cleanupCamera]);

    const renderOptions = () => (
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col items-center animate-fade-in-up">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Update Profile Photo</h3>
            <div className="w-full space-y-4">
                <button onClick={startCamera} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2">
                    <CameraIcon className="w-6 h-6" />
                    <span>Take Photo</span>
                </button>
                <button onClick={handleUploadClick} className="w-full bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center space-x-2">
                    <GalleryIcon className="w-6 h-6" />
                    <span>Upload from Gallery</span>
                </button>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            </div>
             {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
        </div>
    );
    
    const renderCamera = () => (
        <div className="bg-black w-full h-full flex flex-col items-center justify-center relative">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <button onClick={handleCapture} className="absolute bottom-10 w-20 h-20 bg-white rounded-full border-4 border-white/50 ring-4 ring-black/30 focus:outline-none" aria-label="Capture photo"></button>
            <button onClick={() => { cleanupCamera(); setView('options'); }} className="absolute top-5 left-5 text-white bg-black/40 rounded-full p-2" aria-label="Back to options">
                <CloseIcon className="w-6 h-6" />
            </button>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
            {view === 'camera' && renderCamera()}
            {view === 'options' && (
                <div className="relative">
                    {renderOptions()}
                    <button onClick={onClose} className="absolute -top-3 -right-3 text-white bg-gray-800 rounded-full p-2 shadow-lg" aria-label="Close">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default PhotoCaptureView;
