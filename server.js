const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // whatever
        methods: ['GET', 'POST']
    }
});

// debug
app.get("/", (req, res) => {
    res.send("Socket.io server is running!!!");
});

let boards = {};
let turnNums = {};
let players = {};

io.on('connection', (socket) => {
    socket.on("validateJoin", (roomCode, username, callback) => {
        if (!players[roomCode]) {
            callback(false, "that room dont exist lil bro 😹who tf you tryna join");
            return;
        }
        // check for duplicate usernames
        if (players[roomCode]["white"] && players[roomCode]["white"]["username"] == username) {
            callback(false, "that username is WHITE 👿daddy's angry");
            return;
        }
        if (players[roomCode]["black"] && players[roomCode]["black"]["username"] == username) {
            callback(false, "that username is BLACK 👿daddy's angry");
            return;
        }
        if (players[roomCode]["spectators"])
            for (const spectator of players[roomCode]["spectators"]) {
                if (spectator["username"] == username) {
                    callback(false, "that username is TAKEN 👿daddy's angry");
                    return;
                }
            }

        callback(true, null);
    });

    socket.on("place-cube", (roomCode, index) => {
        const playedPiece = turnNums[roomCode] % 2;
        boards[roomCode][index].push(playedPiece);

        io.to(roomCode).emit("updateClientStats", roomCode, boards[roomCode], turnNums[roomCode] + 1);
        winData = checkWins(index, boards[roomCode], playedPiece);
        if (winData) {
            io.to(roomCode).emit("gameWin", roomCode, winData);
        }
        turnNums[roomCode]++;
    });

    socket.on("reset", (roomCode) => {
        boards[roomCode] = Array.from({
            length: 25
        }, () => []);
        turnNums[roomCode] = Math.random() > 0.5 ? 1 : 0;
        players[roomCode] = {};
        io.to(roomCode).emit("updateClientStats", roomCode, boards[roomCode], turnNums[roomCode]);
    });

    socket.on("boardConnect", (roomCode, username) => {
        socket.join(roomCode); // socket.io sh*t you wouldnt get it...

        if (!players[roomCode]["white"]) {
            players[roomCode]["white"] = {
                "username": username,
                "id": socket.id
            };
        } else if (!players[roomCode]["black"]) {
            players[roomCode]["black"] = {
                "username": username,
                "id": socket.id
            };
        } else {
            if (!players[roomCode]["spectators"]) players[roomCode]["spectators"] = [];
            players[roomCode]["spectators"].push({
                "username": username,
                "id": socket.id
            });
        }

        io.to(roomCode).emit("updateClientBaseStats", roomCode, boards[roomCode], turnNums[roomCode], players[roomCode]);
    });

    socket.on("disconnecting", () => {
        for (const roomCode of socket.rooms) {
            if (roomCode != socket.id) { // since remember how theyre technically in their default id room
                socket.leave(roomCode);
                if (players[roomCode]) {
                    if (players[roomCode]["white"] && players[roomCode]["white"]["id"] == socket.id) {
                        delete players[roomCode]["white"];
                    }
                    if (players[roomCode]["black"] && players[roomCode]["black"]["id"] == socket.id) {
                        delete players[roomCode]["black"];
                    }
                    let spectators = players[roomCode]["spectators"];
                    if (spectators) {
                        spectators = spectators.filter(spectator => spectator["id"] != socket.id);
                        players[roomCode]["spectators"] = spectators;
                    }
                }

                // TODO i dont think this has ever been run ever
                if (io.sockets.adapter.rooms.get(roomCode)?.size === 0) {
                    boards[roomCode] = Array.from({
                        length: 25
                    }, () => []);
                    turnNums[roomCode] = 0;
                    players[roomCode] = {};
                }
                io.to(roomCode).emit("updateClientBaseStats", roomCode, boards[roomCode], turnNums[roomCode], players[roomCode]);
            }
        }
    });
});

function checkWins(index, board, playedPiece) {
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                if (x == 0 && y == 0 && z == 0) continue;
                let win = true;
                for (let i = 1; i < 4; i++) {
                    if (index + x * 5 * i + z * i < 0 || index + x * 5 * i + z * i > 24) {
                        win = false;
                        break;
                    }
                    let column = board[index + x * 5 * i + z * i];
                    if (board[index].length + y * i < 1 || board[index].length + y * i > column.length) {
                        win = false;
                        break;
                    }
                    let piece = column[board[index].length + y * i - 1];
                    if (piece != playedPiece) {
                        win = false;
                        break;
                    }
                }
                if (win) {
                    return [index, x, y, z, board[index].length]; // if it aint broke am i right!
                }
            }
        }
    }
    return null;
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});