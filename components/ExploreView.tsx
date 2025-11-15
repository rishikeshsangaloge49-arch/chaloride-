

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { getMapsGroundedResponse, GroundingChunk } from '../services/geminiService';
import { SearchIcon, MapPinIcon, ExploreIcon, MicIcon } from './icons/Icons';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { encode } from '../services/audioUtils';

interface ExploreViewProps {
    initialQuery?: string;
}

const exampleQueries = [
    "Basavakalyan Fort history",
    "Restaurants near City Bus Stand",
    "How to reach Anubhava Mantapa",
    "Unique souvenirs in Basavakalyan",
];

const ExploreSkeleton: React.FC = () => (
    <div className="p-4 bg-white rounded-lg shadow w-full">
        <div className="space-y-3 animate-shimmer">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="pt-4 mt-4 border-t border-gray-200">
                <div className="h-5 bg-gray-300 rounded w-1/3 mb-3"></div>
                <div className="h-10 bg-gray-200 rounded-lg w-full"></div>
                <div className="h-10 bg-gray-200 rounded-lg w-full mt-2"></div>
            </div>
        </div>
    </div>
);


const ExploreView: React.FC<ExploreViewProps> = ({ initialQuery = '' }) => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [response, setResponse] = useState<string | null>(null);
    const [groundingChunks, setGroundingChunks] = useState<GroundingChunk[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [isListening, setIsListening] = useState(false);

    const sessionRef = useRef<any>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const finalQueryRef = useRef('');

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            (err) => {
                console.warn(`Geolocation error: ${err.message}`);
                setError("Could not get your location. Please enable location services for better results.");
            }
        );
    }, []);
    
    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) return;

        setIsLoading(true);
        setResponse(null);
        setGroundingChunks([]);
        setError(null);

        try {
            const result = await getMapsGroundedResponse(searchQuery, userLocation);
            setResponse(result.text);
            setGroundingChunks(result.chunks || []);
        } catch (e) {
            console.error("Maps grounding error:", e);
            setError("Sorry, I couldn't find information for that. Please try another search.");
        } finally {
            setIsLoading(false);
        }
    }, [userLocation]);

    useEffect(() => {
        if (initialQuery) {
            setQuery(initialQuery);
            performSearch(initialQuery);
        }
    }, [initialQuery, performSearch]);
    
    const handleSearch = useCallback(() => {
        const searchQuery = finalQueryRef.current || query;
        performSearch(searchQuery);
        finalQueryRef.current = '';
    }, [query, performSearch]);

    const handleExampleClick = useCallback((exampleQuery: string) => {
        setQuery(exampleQuery);
        performSearch(exampleQuery);
    }, [performSearch]);

    const cleanupAudio = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
    }, []);

    const stopListening = useCallback(() => {
        if (sessionRef.current) {
            sessionRef.current.close();
            sessionRef.current = null;
        }
        cleanupAudio();
        setIsListening(false);
    }, [cleanupAudio]);

    const startListening = useCallback(async () => {
        setIsListening(true);
        setError(null);
        setResponse(null);
        setGroundingChunks([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = mediaStream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

            const source = inputAudioContextRef.current.createMediaStreamSource(mediaStream);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    systemInstruction: 'You are a transcription service. Only transcribe the user\'s speech. Do not respond or engage in conversation.'
                },
                callbacks: {
                    onopen: () => {
                        processor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = { data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)), mimeType: 'audio/pcm;rate=16000' };
                            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };
                        source.connect(processor);
                        processor.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: (message: LiveServerMessage) => {
                        const transcript = message.serverContent?.inputTranscription?.text;
                        if (transcript) {
                            setQuery(transcript);
                            finalQueryRef.current = transcript;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live API Error:', e);
                        setError("Voice connection error. Please try again.");
                        stopListening();
                    },
                    onclose: () => {
                        cleanupAudio();
                        setIsListening(false);
                        handleSearch();
                    }
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (error: any) {
            console.error('Failed to start voice input:', error);
            if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                setError('No microphone found. Please connect a microphone and grant permission.');
            } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                setError('Microphone access denied. Please allow permission in your browser settings.');
            } else {
                setError('Could not start microphone. Please check permissions.');
            }
            setIsListening(false);
        }
    }, [stopListening, handleSearch, cleanupAudio]);

    const handleToggleListen = useCallback(() => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }, [isListening, startListening, stopListening]);

    useEffect(() => {
        return () => {
            if (isListening) {
                stopListening();
            }
        };
    }, [isListening, stopListening]);

    return (
        <div className="p-4 h-full flex flex-col">
            <div className="flex items-center bg-white rounded-full shadow-md p-2 mb-4 space-x-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={isListening ? "Listening..." : "e.g., 'Best hotels near Anubhava Mantapa'"}
                    className="w-full bg-transparent border-none focus:ring-0 px-4 py-1 text-gray-700"
                    disabled={isLoading}
                />
                <button
                    onClick={handleToggleListen}
                    className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    aria-label={isListening ? 'Stop listening' : 'Start voice search'}
                >
                    <MicIcon className="w-5 h-5"/>
                </button>
                <button
                    onClick={handleSearch}
                    disabled={isLoading || (!query.trim() && !finalQueryRef.current.trim())}
                    className="bg-blue-600 text-white rounded-full p-2 hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                    aria-label="Search"
                >
                    <SearchIcon className="w-5 h-5"/>
                </button>
            </div>

            <div className="flex-grow overflow-y-auto pr-2">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center p-8">
                        <ExploreSkeleton />
                    </div>
                )}

                {error && <div className="text-center p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}

                {response && (
                    <div className="bg-white p-4 rounded-lg shadow animate-fade-in-up">
                        <p className="text-gray-800 whitespace-pre-wrap">{response}</p>
                    </div>
                )}
                
                {groundingChunks.length > 0 && (
                    <div className="mt-4 animate-fade-in-up">
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">Sources from Google Maps</h3>
                        <div className="space-y-2">
                            {groundingChunks.map((chunk, index) => chunk.maps && (
                                <a
                                    key={index}
                                    href={chunk.maps.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center bg-white p-3 rounded-lg shadow-sm hover:bg-blue-50 transition-colors"
                                >
                                    <MapPinIcon className="w-5 h-5 text-blue-500 mr-3 shrink-0"/>
                                    <span className="text-blue-600 hover:underline font-medium">{chunk.maps.title}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {!isLoading && !response && !error && (
                    <div className="text-center text-gray-500 pt-10 animate-fade-in-up">
                        <ExploreIcon className="w-16 h-16 mx-auto mb-4 text-gray-300"/>
                        <h2 className="text-xl font-semibold">Discover Basavakalyan</h2>
                        <p className="mt-1">Ask anything about local places, from historic sites to the best chai spots.</p>
                        <div className="mt-8 px-4">
                            <h3 className="text-md font-semibold text-gray-600 mb-3">Or try one of these suggestions</h3>
                            <div className="flex flex-wrap justify-center gap-2">
                                {exampleQueries.map((exQuery) => (
                                    <button
                                        key={exQuery}
                                        onClick={() => handleExampleClick(exQuery)}
                                        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-full text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 shadow-sm"
                                    >
                                        {exQuery}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExploreView;
