import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameGateway } from './socket/GameGateway.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Phục vụ các file tĩnh của Frontend sau khi build
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all for demo
    methods: ['GET', 'POST']
  }
});

// Initialize game gateway
new GameGateway(io);

// Bất kỳ route nào không khớp với API sẽ trả về file index.html của Frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`[Server] Exploding Kittens Backend running on port ${PORT}`);
});
