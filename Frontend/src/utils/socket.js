import { io } from 'socket.io-client';
import { getApiUrl } from './config';

const apiUrl = getApiUrl();
// In some environments, Socket.io is mounted at /socket.io, but we mounted it at /socket.io in FastAPI
// Standard client will try /socket.io path by default
const socket = io(apiUrl, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
});

socket.on('connect', () => {
    console.log('Socket.io connected');
});

socket.on('disconnect', () => {
    console.log('Socket.io disconnected');
});

export default socket;
