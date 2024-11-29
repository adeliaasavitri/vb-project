// server.js

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');

// For handling JSON database
const usersFilePath = './users.json';
let users = {};

// Load users from JSON file
function loadUsers() {
    if (fs.existsSync(usersFilePath)) {
        const data = fs.readFileSync(usersFilePath);
        users = JSON.parse(data);
    }
}

// Save users to JSON file
function saveUsers() {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
}

// Call loadUsers at startup
loadUsers();

// Serve static files from public directory
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Handle socket connections
let rooms = {};
let players = {}; // Map socket.id to player info

io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);

    // Handle login
    socket.on('login', (data) => {
        const { username, password } = data;
        if (users[username] && users[username].password === password) {
            players[socket.id] = { username };
            socket.emit('loginSuccess', { username });
            console.log(`${username} logged in`);
        } else {
            socket.emit('loginError', 'Invalid username or password');
        }
    });

    // Handle registration
    socket.on('register', (data) => {
        const { username, password } = data;
        if (users[username]) {
            socket.emit('registerError', 'Username already taken');
        } else {
            users[username] = { password };
            saveUsers();
            players[socket.id] = { username };
            socket.emit('registerSuccess', { username });
            console.log(`${username} registered and logged in`);
        }
    });

    // Handle room creation
    socket.on('createRoom', () => {
        const roomId = generateRoomId();
        rooms[roomId] = {
            id: roomId,
            players: [socket.id],
            state: {} // Game state
        };
        socket.join(roomId);
        socket.emit('roomCreated', { roomId, playerRole: 'player1' });
        console.log(`${socket.id} created room ${roomId}`);
    });

    // Handle room joining
    socket.on('joinRoom', (data) => {
        const { roomId } = data;
        if (rooms[roomId]) {
            if (rooms[roomId].players.length < 2) {
                rooms[roomId].players.push(socket.id);
                socket.join(roomId);
                socket.emit('roomJoined', { roomId });
                console.log(`${socket.id} joined room ${roomId}`);
                // Notify both players that the game can start
                const [player1SocketId, player2SocketId] = rooms[roomId].players;
                io.to(player1SocketId).emit('startGame', { playerRole: 'player1' });
                io.to(player2SocketId).emit('startGame', { playerRole: 'player2' });
            } else {
                socket.emit('joinError', 'Room is full');
            }
        } else {
            socket.emit('joinError', 'Room not found');
        }
    });

    // Handle game state updates from clients
    socket.on('gameStateUpdate', (data) => {
        const roomId = getRoomId(socket);
        if (roomId) {
            // Broadcast to the other player
            socket.to(roomId).emit('gameStateUpdate', data);
        }
    });

    // Handle point scoring
    socket.on('pointScored', (data) => {
        const roomId = getRoomId(socket);
        if (roomId) {
            io.to(roomId).emit('pointScored', data);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
        // Remove player from rooms
        const roomId = getRoomId(socket);
        if (roomId) {
            const room = rooms[roomId];
            room.players = room.players.filter(id => id !== socket.id);
            // If room is empty, delete it
            if (room.players.length === 0) {
                delete rooms[roomId];
            } else {
                // Notify remaining player that opponent has left
                socket.to(roomId).emit('opponentLeft');
            }
        }
        // Remove player from players map
        delete players[socket.id];
    });
});

// Generate a unique room ID
function generateRoomId() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Get the room ID that a socket is in
function getRoomId(socket) {
    const roomsOfSocket = Object.keys(socket.rooms);
    // The first room is socket.id, so we need the second one
    if (roomsOfSocket.length > 1) {
        return roomsOfSocket[1]; // Should be the room ID
    }
    return null;
}

// Start the server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
