const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

// Static files route for mani-app/public folder
app.use(express.static(path.join(__dirname, 'mani-app', 'public')));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://sarathisdh_db_user:Sarathi2007@cluster0.qmjrufz.mongodb.net/dream66?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('🔥 Connected to MongoDB Atlas Successfully!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Schemas & Models
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    totalDeposit: { type: Number, default: 0 },
    totalTurnover: { type: Number, default: 0 },
    vipLevel: { type: Number, default: 1 },
    isBlocked: { type: Boolean, default: false },
    bankDetails: {
        accountHolderName: { type: String, default: '' },
        accountNumber: { type: String, default: '' },
        ifscCode: { type: String, default: '' }
    }
});

const transactionSchema = new mongoose.Schema({
    phone: { type: String, required: true },
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    utrNumber: { type: String },
    status: { type: String, default: 'Pending' },
    date: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
    phone: { type: String, required: true },
    sender: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Chat = mongoose.model('Chat', chatSchema);

const otpStorage = {};
let globalAnnouncement = "Welcome to DREAM 66! Play Aviator & JetX safely.";
let activeOnlineUsers = 0;

let aviatorHistory = [1.50, 2.10, 1.12, 3.40];
let jetxHistory = [1.80, 1.30, 2.50, 1.05];

let aviatorNextTarget = 2.00;
let jetxNextTarget = 2.00;
let aviatorManualSet = false;
let jetxManualSet = false;

// --- PERFECT ROUTING FOR FLAT PUBLIC FOLDER STRUCTURE ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'mani-app', 'public', 'index.html'));
});

app.get('/:page', (req, res, next) => {
    let pageName = req.params.page;
    if (pageName.startsWith('api')) return next();
    if (!pageName.includes('.')) pageName += '.html';
    
    const filePath = path.join(__dirname, 'mani-app', 'public', pageName);
    
    res.sendFile(filePath, (err) => {
        if (err) {
            res.sendFile(path.join(__dirname, 'mani-app', 'public', 'index.html'));
        }
    });
});

// APIs & Auth
app.post('/api/send-otp', (req, res) => {
    const { phone } = req.body;
    if (!phone || phone.length !== 10) {
        return res.status(400).json({ success: false, message: 'சரியான 10 இலக்க மொபைல் எண்ணை உள்ளிடவும்.' });
    }
    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStorage[phone] = otp;
    res.status(200).json({ success: true, message: 'OTP வெற்றிகரமாக அனுப்பப்பட்டது!' });
});

app.post('/api/register', async (req, res) => {
    try {
        const { name, phone, otp, password } = req.body;
        if (!name || !phone || !otp || !password) {
            return res.status(400).json({ success: false, message: 'அனைத்து விவரங்களையும் நிரப்பவும்.' });
        }
        if (otpStorage[phone] != otp) {
            return res.status(400).json({ success: false, message: 'தவறான OTP!' });
        }

        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'இந்த எண் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது!' });
        }

        const newUser = new User({ name, phone, password, balance: 0, vipLevel: 1 });
        await newUser.save();
        delete otpStorage[phone];
        res.status(200).json({ success: true, message: 'பதிவு வெற்றிகரமாக முடிந்தது!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const user = await User.findOne({ phone, password });
        if (!user) {
            return res.status(400).json({ success: false, message: 'தவறான மொபைல் எண் அல்லது கடவுச்சொல்!' });
        }
        if (user.isBlocked) {
            return res.status(403).json({ success: false, message: 'உங்கள் கணக்கு நிர்வாகியால் முடக்கப்பட்டுள்ளது!' });
        }
        res.status(200).json({ 
            success: true, 
            message: 'Login successful', 
            balance: user.balance,
            vipLevel: user.vipLevel,
            bankDetails: user.bankDetails 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USER || "admin";
    const adminPass = process.env.ADMIN_PASS || "Sarathi@2007";

    if (username === adminUser && password === adminPass) {
        res.status(200).json({ success: true, message: 'Admin Login successful' });
    } else {
        res.status(400).json({ success: false, message: 'தவறான அட்மின் யூசர் பெயர் அல்லது கடவுச்சொல்!' });
    }
});

app.post('/api/deposit', async (req, res) => {
    try {
        const { phone, amount, utrNumber } = req.body;
        const existingTx = await Transaction.findOne({ utrNumber });
        if (existingTx) {
            return res.status(400).json({ success: false, message: 'இந்த UTR எண் ஏற்கனவே பயன்படுத்தப்பட்டுள்ளது!' });
        }

        const newTx = new Transaction({ phone, type: 'Deposit', amount: Number(amount), utrNumber, status: 'Pending' });
        await newTx.save();
        res.status(200).json({ success: true, message: 'டெபாசிட் கோரிக்கை சமர்ப்பிக்கப்பட்டது!' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/withdraw', async (req, res) => {
    try {
        const { phone, amount } = req.body;
        const numAmount = Number(amount);

        if (numAmount < 110) {
            return res.status(400).json({ success: false, message: 'குறைந்தபட்ச வித்ராவ் தொகை ₹110 இருக்க வேண்டும்!' });
        }

        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(400).json({ success: false, message: 'பயனர் கிடைக்கவில்லை.' });
        }

        let maxPerWithdraw = 1000;
        let maxDailyCount = 2;

        switch (user.vipLevel) {
            case 1: maxPerWithdraw = 1000; maxDailyCount = 2; break;
            case 2: maxPerWithdraw = 3000; maxDailyCount = 3; break;
            case 3: maxPerWithdraw = 5000; maxDailyCount = 4; break;
            case 4: maxPerWithdraw = 10000; maxDailyCount = 5; break;
            case 5: maxPerWithdraw = 20000; maxDailyCount = 7; break;
            case 6: maxPerWithdraw = 30000; maxDailyCount = 10; break;
            case 7: maxPerWithdraw = 50000; maxDailyCount = 15; break;
            case 8: maxPerWithdraw = 70000; maxDailyCount = 20; break;
            case 9: maxPerWithdraw = 80000; maxDailyCount = 25; break;
            case 10: maxPerWithdraw = 100000; maxDailyCount = 30; break;
            default: maxPerWithdraw = 500000; maxDailyCount = 60; break;
        }

        if (numAmount > maxPerWithdraw) {
            return res.status(400).json({ success: false, message: `அதிகபட்ச வித்ராவ் வரம்பு ₹${maxPerWithdraw}` });
        }

        if (user.balance < numAmount) {
            return res.status(400).json({ success: false, message: 'கணக்கில் போதுமான பேலன்ஸ் இல்லை!' });
        }

        user.balance -= numAmount;
        await user.save();

        const newTx = new Transaction({ phone, type: 'Withdrawal', amount: numAmount, status: 'Pending' });
        await newTx.save();

        res.status(200).json({ success: true, message: 'வித்ராவ் கோரிக்கை சமர்ப்பிக்கப்பட்டது!', newBalance: user.balance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/chat/history/:phone', async (req, res) => {
    try {
        const chats = await Chat.find({ phone: req.params.phone }).sort({ timestamp: 1 });
        res.status(200).json({ success: true, chats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/set-target', (req, res) => {
    const { game, target } = req.body;
    if (game === 'jetx') {
        jetxNextTarget = parseFloat(target);
        jetxManualSet = true;
        io.emit('jetxNextTargetUpdate', jetxNextTarget.toFixed(2));
    } else if (game === 'aviator') {
        aviatorNextTarget = parseFloat(target);
        aviatorManualSet = true;
        io.emit('aviatorNextTargetUpdate', aviatorNextTarget.toFixed(2));
    }
    res.status(200).json({ success: true, message: 'Target updated' });
});

app.post('/api/admin/block-user', async (req, res) => {
    try {
        const { phone, isBlocked } = req.body;
        const user = await User.findOne({ phone });
        if (!user) return res.status(400).json({ success: false, message: 'Not found' });
        user.isBlocked = isBlocked;
        await user.save();
        res.status(200).json({ success: true, message: 'Updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/adjust-balance', async (req, res) => {
    try {
        const { phone, amount, type } = req.body;
        const user = await User.findOne({ phone });
        if (!user) return res.status(400).json({ success: false, message: 'Not found' });
        const numAmount = Number(amount);
        if (type === 'add') user.balance += numAmount;
        else if (type === 'subtract') user.balance = Math.max(0, user.balance - numAmount);
        await user.save();
        res.status(200).json({ success: true, message: 'Balance adjusted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/announcement', (req, res) => {
    const { message } = req.body;
    if (message) {
        globalAnnouncement = message;
        io.emit('announcementUpdate', globalAnnouncement);
        res.status(200).json({ success: true, message: 'Announcement posted' });
    } else {
        res.status(400).json({ success: false, message: 'Empty message' });
    }
});

app.get('/api/announcement', (req, res) => {
    res.status(200).json({ success: true, announcement: globalAnnouncement });
});

app.post('/api/admin/action', async (req, res) => {
    try {
        const { transactionId, status } = req.body;
        const tx = await Transaction.findById(transactionId);
        if (!tx) return res.status(400).json({ success: false, message: 'Not found' });
        const user = await User.findOne({ phone: tx.phone });

        if (tx.type === 'Deposit' && status === 'Approved' && user) {
            user.balance += tx.amount;
            user.totalDeposit = (user.totalDeposit || 0) + tx.amount;
            await user.save();
        } else if (tx.type === 'Withdrawal' && status === 'Rejected' && user) {
            user.balance += tx.amount;
            await user.save();
        }

        tx.status = status;
        await tx.save();
        res.status(200).json({ success: true, message: 'Action completed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/admin/detailed-stats', async (req, res) => {
    try {
        const users = await User.find({}, { password: 0 });
        res.status(200).json({ success: true, users, totalUsersCount: users.length });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/admin/pending-transactions', async (req, res) => {
    try {
        const pendingDeposits = await Transaction.find({ type: 'Deposit', status: 'Pending' }).sort({ date: -1 });
        const pendingWithdrawals = await Transaction.find({ type: 'Withdrawal', status: 'Pending' }).sort({ date: -1 });
        res.status(200).json({ success: true, pendingDeposits, pendingWithdrawals });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Socket.io Events
io.on('connection', (socket) => {
    activeOnlineUsers++;
    io.emit('onlineUsersUpdate', activeOnlineUsers);

    socket.on('disconnect', () => {
        activeOnlineUsers = Math.max(0, activeOnlineUsers - 1);
        io.emit('onlineUsersUpdate', activeOnlineUsers);
    });

    socket.on('sendChatMessage', async (data) => {
        const { phone, sender, message } = data;
        const newChat = new Chat({ phone, sender, message });
        await newChat.save();
        io.emit(`chatMessage_${phone}`, newChat);
    });

    socket.emit('initHistory', jetxHistory);
    socket.emit('initAviatorHistory', aviatorHistory);
});

server.listen(PORT, () => {
    console.log(`🚀 DREAM 66 Server running smoothly on port ${PORT}`);
});
