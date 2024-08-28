const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

const usersFilePath = path.join(__dirname, 'users.json');

// Load and save users functions
function loadUsers() {
    try {
        if (fs.existsSync(usersFilePath)) {
            const usersData = fs.readFileSync(usersFilePath, 'utf8');
            if (usersData.trim() === '') return {};
            return JSON.parse(usersData);
        }
    } catch (error) {
        console.error('Error loading users from file:', error);
        return {};
    }
    return {};
}

function saveUsers(users) {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
}

let activeUsers = loadUsers();

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

let currentGame = {}; // Store current game state for each user

// Endpoint to get user data
app.get('/api/user', (req, res) => {
    const userId = req.query.userId || '1';

    if (!activeUsers[userId]) {
        activeUsers[userId] = { id: userId, coins: 1000 };
        saveUsers(activeUsers);
    }

    res.json({
        userId: userId,
        coins: activeUsers[userId].coins,
    });
});

// Endpoint to start a new game
app.post('/api/startGame', (req, res) => {
    const { betAmount, userId, numMines } = req.body;

    if (!userId || betAmount <= 0 || numMines < 1 || numMines > 24) {
        return res.status(400).json({ success: false, message: "Invalid input parameters." });
    }

    if (currentGame[userId]) {
        return res.status(400).json({ success: false, message: "Finish your current game before starting a new one." });
    }

    const user = activeUsers[userId];
    if (betAmount > user.coins) {
        return res.status(400).json({ success: false, message: "Not enough coins." });
    }

    user.coins -= betAmount;
    saveUsers(activeUsers);

    // Initialize game state
    const gridSize = 25;
    const mines = new Set();
    while (mines.size < numMines) {
        mines.add(Math.floor(Math.random() * gridSize));
    }

    currentGame[userId] = {
        betAmount: betAmount,
        mines: Array.from(mines),
        revealed: new Set(),
        multiplier: 1.0,
        numMines: numMines,
        gridSize: gridSize,
    };

    res.json({
        success: true,
        newBalance: user.coins,
        gridSize: gridSize,
        multiplier: 1.0,
    });
});

// Endpoint to reveal a box
app.post('/api/reveal', (req, res) => {
    const { userId, boxIndex } = req.body;

    if (!userId || boxIndex < 0 || boxIndex >= 25) {
        return res.status(400).json({ success: false, message: "Invalid input parameters." });
    }

    const game = currentGame[userId];
    if (!game) {
        return res.status(400).json({ success: false, message: "No active game." });
    }

    if (game.revealed.has(boxIndex)) {
        return res.status(400).json({ success: false, message: "Box already revealed." });
    }

    if (game.mines.includes(boxIndex)) {
        // Player hit a mine
        delete currentGame[userId]; // End the game
        return res.json({
            success: false,
            message: "You hit a mine!",
            revealed: Array.from(game.revealed),
            mineHit: true, // Indicate that a mine was hit
            mineIndex: boxIndex // Send the index of the mine hit
        });
    }

    game.revealed.add(boxIndex);
    game.multiplier += 0.1; // Increase multiplier by 0.1 for each safe box

    // Check if all non-mine boxes are revealed
    if (game.revealed.size === game.gridSize - game.numMines) {
        const user = activeUsers[userId];
        const winnings = game.betAmount * game.multiplier;
        user.coins += winnings;

        delete currentGame[userId]; // End the game

        saveUsers(activeUsers);

        return res.json({
            success: true,
            autoCashOut: true,
            newBalance: user.coins,
            winnings: winnings,
            multiplier: game.multiplier,
            revealed: Array.from(game.revealed),
        });
    }

    res.json({
        success: true,
        multiplier: game.multiplier,
        revealed: Array.from(game.revealed),
    });
});

// Endpoint to cash out
app.post('/api/cashOut', (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, message: "User ID is required." });
    }

    const game = currentGame[userId];
    if (!game) {
        return res.status(400).json({ success: false, message: "No active game." });
    }

    const user = activeUsers[userId];
    const winnings = game.betAmount * game.multiplier;
    user.coins += winnings;

    delete currentGame[userId]; // End the game
    saveUsers(activeUsers);

    res.json({
        success: true,
        newBalance: user.coins,
        winnings: winnings,
    });
});

// Cleanup function to save user data when the server is shutting down
function handleExit(signal) {
    console.log(`Received ${signal}. Saving users and exiting...`);
    saveUsers(activeUsers);
    process.exit(0);
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
