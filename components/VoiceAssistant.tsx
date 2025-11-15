import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { AppView } from '../types';
import { encode, decode, decodeAudioData } from '../services/audioUtils';
import { MicIcon, StopIcon } from './icons/Icons';

interface VoiceAssistantProps {
    setPickup: (value: string) => void;
    setDestination: (value: string) => void;
    setVehicle: (value: 'BIKE' | 'AUTO' | 'CAR') => void;
    setCurrentView: (view: AppView) => void;
    onClose: () => void;
}

const controlRideFunctionDeclaration: FunctionDeclaration = {
  name: 'controlRide',
  description: 'Sets the pickup location, destination, and vehicle type for a ride booking.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      pickup: { type: Type.STRING, description: 'The starting point of the ride, e.g., "Basavakalyan Fort"' },
      destination: { type: Type.STRING, description: 'The ending point of the ride, e.g., "City Bus Stand"' },
      vehicle: { type: Type.STRING, description: 'The type of vehicle. Can be one of: BIKE, AUTO, CAR.' },
    },
  },
};

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ setPickup, setDestination, setVehicle, setCurrentView, onClose }) => {
    const [status, setStatus] = useState('Initializing...');
    const [userTranscription, setUserTranscription] = useState('');
    const [assistantResponse, setAssistantResponse] = useState('');
    const [isListening, setIsListening] = useState(false);
    
    const sessionRef = useRef<any>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef(0);
    
    const connectAndListen = useCallback(async () => {
        setStatus('Connecting...');
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = mediaStream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const source = inputAudioContextRef.current.createMediaStreamSource(mediaStream);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations: [controlRideFunctionDeclaration] }],
                    systemInstruction: 'You are a helpful and friendly voice assistant for "Chaloride". Start by greeting the user. Your main goal is to collect the pickup location, destination, and vehicle type (bike, auto, or car). Be conversational and guide the user. Use local landmarks as examples, like "Where should I pick you up? For instance, near the Basavakalyan Fort?". Once you have all three pieces of information, confirm the details with the user before using the `controlRide` tool. Do not make up functions.'
                },
                callbacks: {
                    onopen: () => {
                        setStatus('Listening...');
                        setIsListening(true);
                        processor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = { data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)), mimeType: 'audio/pcm;rate=16000' };
                            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };
                        source.connect(processor);
                        processor.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            setUserTranscription(message.serverContent.inputTranscription.text);
                        }
                        if (message.serverContent?.outputTranscription) {
                            setAssistantResponse(message.serverContent.outputTranscription.text);
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        const ctx = outputAudioContextRef.current;
                        if (base64Audio && ctx) {
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                            const sourceNode = ctx.createBufferSource();
                            sourceNode.buffer = audioBuffer;
                            sourceNode.connect(ctx.destination);
                            sourceNode.addEventListener('ended', () => { sourcesRef.current.delete(sourceNode); });
                            sourceNode.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourcesRef.current.add(sourceNode);
                        }

                        if (message.serverContent?.interrupted) {
                            for (const sourceNode of sourcesRef.current.values()) {
                                sourceNode.stop();
                            }
                            sourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                            setAssistantResponse('');
                        }

                        if (message.toolCall) {
                            for (const fc of message.toolCall.functionCalls) {
                                if (fc.name === 'controlRide' && fc.args) {
                                    const { pickup, destination, vehicle } = fc.args;
                                    if (pickup) setPickup(pickup as string);
                                    if (destination) setDestination(destination as string);
                                    if (vehicle && ['BIKE', 'AUTO', 'CAR'].includes(vehicle as string)) {
                                        setVehicle(vehicle as 'BIKE' | 'AUTO' | 'CAR');
                                    }
                                    setCurrentView(AppView.BOOKING);
                                    sessionPromise.then(session => session.sendToolResponse({
                                        functionResponses: { id: fc.id, name: fc.name, response: { result: "ok, details have been updated on the user's screen." } }
                                    }));
                                }
                            }
                        }
                         if (message.serverContent?.turnComplete) {
                            setUserTranscription('');
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live API Error:', e);
                        setStatus('Connection error. Please try again.');
                        setIsListening(false);
                    },
                    onclose: () => {
                        setStatus('Connection closed.');
                        setIsListening(false);
                    }
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (error: any) {
            console.error('Failed to start voice assistant:', error);
            if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                setStatus('No microphone found. Please connect a microphone and grant permission.');
            } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                setStatus('Microphone access denied. Please allow permission in your browser settings.');
            } else {
                setStatus('Could not start microphone. Please check permissions.');
            }
        }
    }, [setPickup, setDestination, setVehicle, setCurrentView]);

    const stopListening = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }
        sourcesRef.current.forEach(source => source.stop());
        sourcesRef.current.clear();
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (sessionRef.current) {
            sessionRef.current.close();
            sessionRef.current = null;
        }
        setIsListening(false);
        onClose();
    }, [onClose]);

    useEffect(() => {
        connectAndListen();
        return () => {
            stopListening();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4" onClick={stopListening}>
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md flex flex-col items-center relative" onClick={e => e.stopPropagation()}>
                <p className="text-gray-500 font-medium mb-4">{status}</p>
                <div className={`relative w-24 h-24 flex items-center justify-center rounded-full transition-colors ${isListening ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    {isListening && <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping"></div>}
                    <MicIcon className={`w-12 h-12 z-10 ${isListening ? 'text-blue-600' : 'text-gray-400'}`} />
                </div>
                
                <div className="w-full text-left mt-6 space-y-4 px-2 max-h-[200px] overflow-y-auto">
                    {assistantResponse && (
                        <div className="animate-fade-in-up">
                            <span className="font-semibold text-blue-600">Assistant:</span>
                            <p className="text-lg text-gray-800">{assistantResponse}</p>
                        </div>
                    )}
                     <div className="animate-fade-in-up">
                        <span className="font-semibold text-gray-500">You:</span>
                        <p className="text-lg text-gray-800 min-h-[28px]">
                            {userTranscription || <span className="text-gray-400">...</span>}
                        </p>
                    </div>
                </div>

                <p className="text-center text-sm text-gray-400 mt-4 min-h-[20px]">
                    {(!userTranscription && !assistantResponse && isListening) ? 'Say something like "Book a car..."' : ''}
                </p>

                <button
                    onClick={stopListening}
                    className="mt-6 bg-red-500 text-white font-bold py-2 px-6 rounded-full hover:bg-red-600 transition-colors flex items-center"
                >
                    <StopIcon className="w-5 h-5 mr-2" />
                    Stop
                </button>
            </div>
        </div>
    );
};

export default VoiceAssistant;