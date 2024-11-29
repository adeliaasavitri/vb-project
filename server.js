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
            state: {},
            mapSelected: false,
            charactersSelected: 0,
            playersReady: {}, // Changed to object
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
                socket.emit('roomJoined', { roomId, playerRole: 'player2' });
                console.log(`${socket.id} joined room ${roomId}`);
                socket.to(roomId).emit('opponentJoined');
            } else {
                socket.emit('joinError', 'Room is full');
            }
        } else {
            socket.emit('joinError', 'Room not found');
        }
    });

    // Handle map selection (only by player1)
    socket.on('backgroundSelected', (data) => {
        const roomId = getRoomId(socket);
        if (roomId && rooms[roomId].players[0] === socket.id) {
            rooms[roomId].state.backgroundIndex = data.backgroundIndex;
            rooms[roomId].mapSelected = true;
            socket.to(roomId).emit('backgroundSelected', data);
            console.log(`Background selected for room ${roomId}: ${data.backgroundIndex}`);
        } else {
            socket.emit('mapSelectionError', 'Only the room creator can select the map');
        }
    });

    // Handle character selection
    socket.on('characterSelected', (data) => {
        const roomId = getRoomId(socket);
        if (roomId) {
            const playerIndex = rooms[roomId].players.indexOf(socket.id);
            if (playerIndex !== -1) {
                rooms[roomId].state[`player${playerIndex + 1}Character`] = data.characterIndex;
                rooms[roomId].charactersSelected++;

                // Broadcast to the other player
                socket.to(roomId).emit('characterSelected', { characterIndex: data.characterIndex, socketId: socket.id });

                // Check if both characters are selected and map is selected
                if (rooms[roomId].charactersSelected === 2 && rooms[roomId].mapSelected) {
                    // Notify both players to proceed
                    io.to(roomId).emit('bothCharactersSelected');
                }
            }
        }
    });

    // Handle player readiness
    socket.on('playerReady', () => {
        const roomId = getRoomId(socket);
        if (roomId && rooms[roomId]) {
            rooms[roomId].playersReady[socket.id] = true;
            console.log(`Player ${socket.id} is ready in room ${roomId}.`);

            // Check if both players are ready
            const room = rooms[roomId];
            if (room.players.length === 2 &&
                room.playersReady[room.players[0]] &&
                room.playersReady[room.players[1]]) {
                io.to(roomId).emit('bothPlayersReady');
                console.log(`Both players in room ${roomId} are ready. Emitting 'bothPlayersReady'.`);
            }
        }
    });

    // Handle initial positions
    socket.on('initialPositions', (data) => {
        const roomId = getRoomId(socket);
        if (roomId) {
            socket.to(roomId).emit('initialPositions', data);
        }
    });

    // Handle game state updates
    socket.on('gameStateUpdate', (data) => {
        const roomId = getRoomId(socket);
        if (roomId) {
            socket.to(roomId).emit('gameStateUpdate', data);
        }
    });

    // Handle request for background
    socket.on('requestBackground', () => {
        const roomId = getRoomId(socket);
        if (roomId) {
            const player1SocketId = rooms[roomId].players[0];
            io.to(player1SocketId).emit('requestBackground');
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
        const roomId = getRoomId(socket);
        if (roomId && rooms[roomId]) {
            const room = rooms[roomId];
            // Remove the player from the room
            room.players = room.players.filter(id => id !== socket.id);
            // Remove readiness status
            delete room.playersReady[socket.id];
            if (room.players.length === 0) {
                delete rooms[roomId];
                console.log(`Room ${roomId} deleted as it became empty.`);
            } else {
                socket.to(roomId).emit('opponentDisconnected');
                console.log(`Player ${socket.id} disconnected from room ${roomId}.`);
            }
        }
        delete players[socket.id];
    });

    // Utility functions
    function generateRoomId() {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    function getRoomId(socket) {
        const roomsOfSocket = Array.from(socket.rooms);
        return roomsOfSocket.length > 1 ? roomsOfSocket[1] : null;
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
