// In-memory storage: Map key = `${userId}:${recipientAccount}`
const userRecipientTransactions = new Map(); // key -> array of timestamps

function addTransaction(userId, recipientAccount) {
    const key = `${userId}:${recipientAccount}`;
    if (!userRecipientTransactions.has(key)) {
        userRecipientTransactions.set(key, []);
    }
    const timestamps = userRecipientTransactions.get(key);
    timestamps.push(Date.now());

    // Clean entries older than 60 minutes (3600000 ms)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const filtered = timestamps.filter(ts => ts > oneHourAgo);
    userRecipientTransactions.set(key, filtered);
}

function getTransactionCount(userId, recipientAccount, minutes = 60) {
    const key = `${userId}:${recipientAccount}`;
    if (!userRecipientTransactions.has(key)) return 0;
    const timestamps = userRecipientTransactions.get(key);
    const cutoff = Date.now() - minutes * 60 * 1000;
    return timestamps.filter(ts => ts > cutoff).length;
}

function resetUserSession(userId, recipientAccount) {
    const key = `${userId}:${recipientAccount}`;
    userRecipientTransactions.delete(key);
}

module.exports = { addTransaction, getTransactionCount, resetUserSession };