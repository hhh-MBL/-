const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3001; // Use port 3001 for the user management server

const usersFilePath = path.join(__dirname, 'users.json');

// Middleware
app.use(cors());
app.use(express.json());

// Function to load users from the file
function loadUsers() {
    try {
        if (fs.existsSync(usersFilePath)) {
            const usersData = fs.readFileSync(usersFilePath, 'utf8');
            if (usersData.trim() === '') {
                return {};
            }
            return JSON.parse(usersData);
        }
    } catch (error) {
        console.error('Error loading users from file:', error);
        return {};
    }
    return {};
}

// Function to save users to the file
function saveUsers(users) {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
}

let activeUsers = loadUsers();

// Endpoint to get user data
app.get('/api/userData', (req, res) => {
    const userId = req.query.userId;
    if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID required' });
    }

    const user = activeUsers[userId];
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ coins: user.coins });
});

// Endpoint to update user coins
app.post('/api/updateUserCoins', (req, res) => {
    const { userId, coins } = req.body;
    if (!userId || typeof coins !== 'number') {
        return res.status(400).json({ success: false, message: 'Invalid input' });
    }

    let user = activeUsers[userId];
    if (!user) {
        user = { id: userId, coins: 1000 }; // Default to 1000 coins for new users
    }

    user.coins += coins; // Update coins
    activeUsers[userId] = user;
    saveUsers(activeUsers);

    res.json({ success: true, coins: user.coins });
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
    console.log(`User management server running at http://localhost:${port}`);
});
