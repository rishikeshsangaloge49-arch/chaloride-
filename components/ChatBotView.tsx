import React, { useState, useRef, useEffect } from 'react';
import { Chat } from '@google/genai';
import { ChatMessage } from '../types';
import { createChatSession, sendChatMessageStream } from '../services/geminiService';
import { SendIcon, PhoneIcon, EmailIcon } from './icons/Icons';

const ChatBotView: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatSessionRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatSessionRef.current = createChatSession();
        setMessages([
            {
                sender: 'GEMINI',
                text: 'Hello! How can I help you with Chaloride or your trip in Basavakalyan today?'
            }
        ]);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedInput = inputValue.trim();
        if (!trimmedInput || isLoading) return;

        setInputValue('');
        
        // Add user message and an empty placeholder for the Gemini response
        const newMessages: ChatMessage[] = [
            ...messages,
            { sender: 'USER', text: trimmedInput },
            { sender: 'GEMINI', text: '' }
        ];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            if (chatSessionRef.current) {
                const stream = await sendChatMessageStream(chatSessionRef.current, trimmedInput);
                let currentText = '';
                for await (const chunk of stream) {
                    currentText += chunk.text;
                    setMessages(prev => {
                        const updatedMessages = [...prev];
                        updatedMessages[updatedMessages.length - 1].text = currentText;
                        return updatedMessages;
                    });
                }
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => {
                const updatedMessages = [...prev];
                updatedMessages[updatedMessages.length - 1].text = "Sorry, I'm having trouble connecting. Please try again later.";
                return updatedMessages;
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const MessageBubble: React.FC<{ msg: ChatMessage }> = ({ msg }) => (
        <div className={`flex ${msg.sender === 'USER' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${msg.sender === 'USER' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 shadow-sm rounded-bl-none'}`}>
                <p className="whitespace-pre-wrap">{msg.text || '...'}</p>
            </div>
        </div>
    );


    return (
        <div className="flex flex-col h-full bg-gray-100">
             <div className="p-4 bg-white border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800 mb-3">Contact Support Directly</h2>
              <div className="space-y-2">
                <a href="tel:+918762042431" className="flex items-center text-gray-700 hover:text-blue-600 transition-colors">
                  <PhoneIcon className="w-5 h-5 mr-3 text-gray-500"/>
                  <span>+91 8762042431</span>
                </a>
                <a href="tel:+919108247369" className="flex items-center text-gray-700 hover:text-blue-600 transition-colors">
                  <PhoneIcon className="w-5 h-5 mr-3 text-gray-500"/>
                  <span>+91 9108247369</span>
                </a>
                <a href="mailto:rishikeshsangolge19@gmail.com" className="flex items-center text-gray-700 hover:text-blue-600 transition-colors">
                  <EmailIcon className="w-5 h-5 mr-3 text-gray-500"/>
                  <span>rishikeshsangolge19@gmail.com</span>
                </a>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => <MessageBubble key={index} msg={msg} />)}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-gray-200">
                <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type your message..."
                        className="w-full p-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !inputValue.trim()}
                        className="bg-blue-600 text-white rounded-full p-3 hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                        aria-label="Send message"
                    >
                        <SendIcon className="w-6 h-6" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatBotView;