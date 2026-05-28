import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { GameGateway } from './socket/GameGateway.js';

dotenv.config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all for demo
    methods: ['GET', 'POST']
  }
});

// Initialize game gateway
new GameGateway(io);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`[Server] Exploding Kittens Backend running on port ${PORT}`);
});
