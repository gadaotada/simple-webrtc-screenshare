import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let clients = [];
let messages = []; // Store chat messages in memory

wss.on('connection', (ws) => {
  clients.push(ws);
  console.log('New client connected. Total clients:', clients.length);

  // Send existing messages to new client
  if (messages.length > 0) {
    ws.send(JSON.stringify({
      type: 'chatHistory',
      messages
    }));
  }

  // Notify all clients about the new connection
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'clientCount', count: clients.length }));
    }
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);
      
      if (data.type === 'chat') {
        // Store the message
        messages.push(data.message);
        // Keep only the last 100 messages
        if (messages.length > 100) {
          messages = messages.slice(-100);
        }
        
        // Broadcast to all clients
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'chat',
              message: data.message
            }));
          }
        });
      } else {
        // Handle other types of messages (WebRTC signaling)
        clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            console.log('Broadcasting message to another client');
            client.send(message);
          }
        });
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed with code ${code} and reason: ${reason}`);
    clients = clients.filter(client => client !== ws);
    console.log('Client disconnected. Total clients:', clients.length);
    
    // Notify remaining clients about the disconnection
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'clientCount', count: clients.length }));
      }
    });
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', clients: clients.length, messages: messages.length });
});

server.listen(4000, () => {
  console.log('WebSocket server running on ws://localhost:4000');
});
