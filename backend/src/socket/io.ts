import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from '../config/index.js';

let io: Server | null = null;

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Allow local frontend connections
      methods: ['GET', 'POST', 'PATCH'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO has not been initialized yet!');
  }
  return io;
}

export function emitTelemetry(data: any) {
  if (io) {
    io.emit('telemetry:new', data);
  }
}

export function emitIncident(incident: any) {
  if (io) {
    io.emit('incident:new', incident);
  }
}

export function emitIncidentUpdate(incident: any) {
  if (io) {
    io.emit('incident:updated', incident);
  }
}

export function emitHelmetStatus(status: { helmetId: string; status: string; lastSeen: Date }) {
  if (io) {
    io.emit('helmet:status', status);
  }
}
