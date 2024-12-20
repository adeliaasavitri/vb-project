const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const bcrypt = require("bcrypt"); // PASSWORD


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
        if (users[username]) {
            if (bcrypt.compareSync(password, users[username].encryptedPassword)){ // Compare the hashed password and the actual pass
                players[socket.id] = { username };
                socket.emit('loginSuccess', { username });
                console.log(`${username} logged in`);
           }
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
            const encryptedPassword = bcrypt.hashSync(password, 10);
            users[username] = { encryptedPassword, matchWins:0 };
            saveUsers();
            players[socket.id] = { username };
            socket.emit('registerSuccess', { username });
            console.log(`${username} registered and logged in`);
        }
    });

    // Handle room creation
    socket.on('createRoom', () => {
        const roomId = generateRoomId();
        const newTime = new Date();
        rooms[roomId] = {
            id: roomId,
            players: [socket.id],
            state: {},
            mapSelected: false,
            charactersSelected: 0,
            playersReady: {}, // Changed to object
            gameStart: 0,
            timeStart: newTime
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
            room.gameStart+=1;
            console.log("Game Participants: ", room.gameStart);
            if (room.players.length === 2 &&
                room.playersReady[room.players[0]] &&
                room.playersReady[room.players[1]] &&
                room.gameStart == 2){
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

    socket.on('backWaiting', () => {
        const roomId = getRoomId(socket);
        if (roomId) {
            io.to(roomId).emit('go back waiting');
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


    socket.on('gameOver', () => {
        let user_name;
        // data would contain which players win
        const roomId = getRoomId(socket);
        user_name = players[socket.id]
        users[user_name.username].matchWins += 1
        /// Convert the object to an array of entries (username and user data)
        const usersArray = Object.entries(users);
        // Sort the array based on matchWins
        usersArray.sort(([, a], [, b]) => b.matchWins - a.matchWins); // Sort from highest to lowest
        saveUsers();
        const currTime = new Date();
        const timeTaken = ((currTime - rooms[roomId].timeStart)/1000).toFixed(4)

        const topFive = usersArray.slice(0, 5); // This will get the first 5 users
        io.to(roomId).emit('showGameOverScreen', {timeTaken, topFive});
    })

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
