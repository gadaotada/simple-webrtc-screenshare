'use client';
import { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
}

const senderIdentifier = Math.random().toString(36).substring(2, 15);

export default function Chat({ ws }: { ws: WebSocket | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ws) {
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chat') {
            setMessages(prev => [...prev, data.message]);
          }
        } catch (error) {
          console.error('Error parsing chat message:', error);
        }
      };
    }
  }, [ws]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ws || !newMessage.trim()) return;

    const message: Message = {
      id: Date.now().toString(),
      text: newMessage.trim(),
      sender: senderIdentifier,
      timestamp: Date.now()
    };

    ws.send(JSON.stringify({
      type: 'chat',
      message
    }));

    setNewMessage('');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 h-[400px] flex flex-col">
      <h2 className="text-xl font-semibold mb-4">Chat</h2>
      <div className="flex-1 overflow-y-auto mb-4 space-y-2">
        {messages.map((message) => (
          <div key={message.id} className="bg-gray-100 p-2 rounded-lg">
            <div className="text-sm text-gray-500">
              {message.sender} - {new Date(message.timestamp).toLocaleTimeString()}
            </div>
            <div>{message.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-2 border rounded-lg"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
        >
          Send
        </button>
      </form>
    </div>
  );
} 