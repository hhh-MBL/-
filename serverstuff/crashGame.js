const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // To communicate with the user management API

const app = express();
const port = 3000; // Use port 3000 for the game server

let currentMultiplier = 1.0;
let gameActive = false;
let crashed = false;
let bets = [];
let crashTimeout;

app.use(cors());
app.use(express.json());

// Simulated URL for the user management API
const USER_API_URL = 'http://localhost:3001/api'; // Adjust this URL to your user management API

// Endpoint to get the current multiplier and game status
app.get('/api/multiplier', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID required' });
    }

    try {
        const userRes = await fetch(`${USER_API_URL}/userData?userId=${userId}`);
        const userData = await userRes.json();

        res.json({
            multiplier: currentMultiplier,
            crashed,
            gameActive,
            coins: userData.coins
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user data' });
    }
});

// Endpoint to place a bet
app.post('/api/placeBet', async (req, res) => {
    const { betAmount, userId } = req.body;

    if (!userId || betAmount <= 0 || isNaN(betAmount)) {
        return res.status(400).json({ success: false, message: 'Invalid input' });
    }

    if (!gameActive) {
        return res.status(400).json({ success: false, message: 'Betting is closed for this round.' });
    }

    // Check if a bet has already been placed
    if (bets.some(bet => bet.userId === userId)) {
        return res.status(400).json({ success: false, message: 'You can only place one bet per round.' });
    }

    try {
        const userRes = await fetch(`${USER_API_URL}/updateUserCoins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, coins: -betAmount })
        });

        if (!userRes.ok) throw new Error('Failed to update user coins');

        // Place the bet
        bets.push({ userId, betAmount });
        res.json({ success: true, message: 'Bet placed successfully.' });
    } catch (error) {
        console.error('Error placing bet:', error);
        res.status(500).json({ success: false, message: 'Error processing your bet' });
    }
});

// Function to start a new game round
function startGameRound() {
    gameActive = true;
    crashed = false;
    currentMultiplier = 1.0;
    bets = [];

    // Increment multiplier until it crashes
    crashTimeout = setInterval(() => {
        if (crashed || !gameActive) {
            clearInterval(crashTimeout);
            return;
        }
        currentMultiplier += Math.random() * 0.1 + 0.1; // Increment multiplier
        if (currentMultiplier >= 10.0) { // Random crash condition
            crashed = true;
            gameActive = false;
            clearInterval(crashTimeout);
        }
    }, 1000);
}

// Start the first game round after 5 seconds
setTimeout(startGameRound, 5000);

app.listen(port, () => {
    console.log(`Crash game server running at http://localhost:${port}`);
});
