const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const TRANSACTIONS_FILE = path.join(__dirname, '../data/transactions.json');
const USERS_FILE = path.join(__dirname, '../data/users.json');

function readTransactions() {
    if (!fs.existsSync(TRANSACTIONS_FILE)) return [];
    return JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf8'));
}

function writeTransactions(data) {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(data, null, 2));
}

function readUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function writeUsers(data) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

router.post('/approve/:transactionId', (req, res) => {
    const { transactionId } = req.params;
    const transactions = readTransactions();
    const transaction = transactions.find(t => t.id === transactionId);

    if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status !== 'PENDING') {
        return res.status(400).json({ error: `Cannot approve: transaction status is ${transaction.status}` });
    }

    if (transaction.decision === 'WARN') {
        const users = readUsers();
        const userIndex = users.findIndex(u => u.id === transaction.userId);

        if (userIndex !== -1 && users[userIndex].balance >= transaction.amount) {
            users[userIndex].balance -= transaction.amount;
            writeUsers(users);
            transaction.newBalance = users[userIndex].balance;
        } else {
            return res.status(400).json({ error: 'Insufficient balance for approval' });
        }
    }

    transaction.status = 'APPROVED';
    writeTransactions(transactions);

    res.json({
        success: true,
        message: 'Transaction approved successfully',
        transactionId,
        newBalance: transaction.newBalance || null
    });
});

router.post('/reject/:transactionId', (req, res) => {
    const { transactionId } = req.params;
    const transactions = readTransactions();
    const transaction = transactions.find(t => t.id === transactionId);

    if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status !== 'PENDING') {
        return res.status(400).json({ error: `Cannot reject: transaction status is ${transaction.status}` });
    }

    transaction.status = 'REJECTED';
    writeTransactions(transactions);

    res.json({
        success: true,
        message: 'Transaction rejected successfully',
        transactionId
    });
});

module.exports = router;