let currentUser = null;
let currentTransactionId = null;
let transactionHistory = [];
let currentBalance = 10000;
let waitingModalTimeout = null;
let trustedWindow = null;
let statusPollingInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const transferForm = document.getElementById('transferForm');
    if (transferForm) transferForm.addEventListener('submit', handleTransfer);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    const closeBlockedBtn = document.getElementById('closeBlockedBtn');
    if (closeBlockedBtn) closeBlockedBtn.addEventListener('click', () => {
        document.getElementById('blockedModal').style.display = 'none';
        clearForm();
    });

    const closeWaitingModalBtn = document.getElementById('closeWaitingModalBtn');
    if (closeWaitingModalBtn) closeWaitingModalBtn.addEventListener('click', () => {
        document.getElementById('waitingModal').style.display = 'none';
        if (waitingModalTimeout) clearInterval(waitingModalTimeout);
    });

    const closeResultBtn = document.getElementById('closeResultBtn');
    if (closeResultBtn) {
        closeResultBtn.addEventListener('click', () => {
            document.getElementById('resultModal').style.display = 'none';
        });
    }

    const closeRejectionBtn = document.getElementById('closeRejectionBtn');
    if (closeRejectionBtn) {
        closeRejectionBtn.addEventListener('click', () => {
            document.getElementById('rejectionModal').style.display = 'none';
        });
    }
});

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) return alert('Please enter both fields');
    currentUser = { id: 'user1', name: username };
    document.getElementById('userNameDisplay').innerText = username;
    try {
        const res = await fetch('/api/transactions/balance/user1');
        const data = await res.json();
        currentBalance = data.balance;
        updateBalanceDisplay();
    } catch (err) { console.error(err); }
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('bankingSection').style.display = 'block';
}

function logout() {
    if (trustedWindow && !trustedWindow.closed) trustedWindow.close();
    if (statusPollingInterval) clearInterval(statusPollingInterval);
    currentUser = null;
    currentTransactionId = null;
    transactionHistory = [];
    if (waitingModalTimeout) clearInterval(waitingModalTimeout);
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('bankingSection').style.display = 'none';
    document.getElementById('waitingModal').style.display = 'none';
    document.getElementById('loadingModal').style.display = 'none';
    document.getElementById('blockedModal').style.display = 'none';
    document.getElementById('resultModal').style.display = 'none';
    document.getElementById('rejectionModal').style.display = 'none';
    clearForm();
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function updateBalanceDisplay() {
    const el = document.getElementById('balance');
    if (el) el.textContent = `RM ${currentBalance.toFixed(2)}`;
}

async function showLoadingModal() {
    const modal = document.getElementById('loadingModal');
    modal.style.display = 'flex';
    const steps = ['step1', 'step2', 'step3'];
    for (let i = 0; i < steps.length; i++) {
        await sleep(800);
        document.getElementById(steps[i]).classList.add('active');
        document.getElementById('progressBar').style.width = i === 0 ? '25%' : i === 1 ? '60%' : '100%';
    }
}
function hideLoadingModal() {
    document.getElementById('loadingModal').style.display = 'none';
    ['step1', 'step2', 'step3'].forEach(id => document.getElementById(id).classList.remove('active'));
    document.getElementById('progressBar').style.width = '0%';
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function handleTransfer(e) {
    e.preventDefault();
    const recipient = document.getElementById('recipientAccount').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const remark = document.getElementById('remark').value;
    if (!recipient || !amount || amount <= 0 || !remark.trim()) return alert('Please fill all fields');
    if (amount > currentBalance) return alert(`Insufficient balance (RM ${currentBalance.toFixed(2)})`);

    await showLoadingModal();

    try {
        const res = await fetch('/api/transactions/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: 'user1', recipient_account: recipient, amount, remark: remark.trim() })
        });
        const data = await res.json();
        hideLoadingModal();

        if (data.success && data.decision === 'ALLOW') {
            currentBalance = data.newBalance;
            updateBalanceDisplay();
            addToHistory(recipient, amount, remark, 'COMPLETED');
            clearForm();
            showResultModal('Transaction Completed', 'Your transfer has been processed successfully.', 'success');
        }
        else if (data.decision === 'BLOCK') {
            currentTransactionId = data.transactionId;
            showBlockedModal(data.reason, recipient, amount);
            addToHistory(recipient, amount, remark, 'BLOCKED');
            clearForm();
        }
        else if (data.decision === 'WARN') {
            currentTransactionId = data.transactionId;
            trustedWindow = window.open(`trusted.html?txnId=${data.transactionId}`, '_blank');
            showWaitingModal(data.transactionId);
            startPolling(data.transactionId);
        }
        else if (data.error) alert(data.error);
    } catch (err) { console.error(err); alert('Connection error'); }
    finally { document.getElementById('transferBtn').disabled = false; }
}

function startPolling(txnId) {
    if (statusPollingInterval) clearInterval(statusPollingInterval);
    statusPollingInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/transactions/status/${txnId}`);
            const data = await res.json();
            const status = data.status;
            if (status === 'APPROVED' || status === 'APPROVED_BY_NSRC') {
                clearInterval(statusPollingInterval);
                document.getElementById('waitingModal').style.display = 'none';
                if (waitingModalTimeout) clearInterval(waitingModalTimeout);
                const balanceRes = await fetch('/api/transactions/balance/user1');
                const balanceData = await balanceRes.json();
                currentBalance = balanceData.balance;
                updateBalanceDisplay();
                showResultModal('Transaction Approved', 'Your trusted person (or NSRC) has approved the transaction. The transfer is complete.', 'success');
                const details = await fetch(`/api/transactions/details/${txnId}`);
                const tx = await details.json();
                addToHistory(tx.recipient_account, tx.amount, tx.remark, 'APPROVED');
                clearForm();
                currentTransactionId = null;
            } else if (status === 'REJECTED') {
                clearInterval(statusPollingInterval);
                document.getElementById('waitingModal').style.display = 'none';
                if (waitingModalTimeout) clearInterval(waitingModalTimeout);
                const details = await fetch(`/api/transactions/details/${txnId}`);
                const tx = await details.json();
                showRejectionModal('Trusted Person', tx.ai_reason, tx.recipient_account, tx.amount);
                addToHistory(tx.recipient_account, tx.amount, tx.remark, 'REJECTED');
                clearForm();
                currentTransactionId = null;
            } else if (status === 'REJECTED_BY_NSRC') {
                clearInterval(statusPollingInterval);
                document.getElementById('waitingModal').style.display = 'none';
                if (waitingModalTimeout) clearInterval(waitingModalTimeout);
                const details = await fetch(`/api/transactions/details/${txnId}`);
                const tx = await details.json();
                showRejectionModal('National Scam Response Centre (997)', tx.ai_reason, tx.recipient_account, tx.amount);
                addToHistory(tx.recipient_account, tx.amount, tx.remark, 'REJECTED');
                clearForm();
                currentTransactionId = null;
            } else if (status === 'ESCALATED') {
                // Handled by timeout -> call.html
            }
        } catch (err) { console.error('Polling error', err); }
    }, 2000);
}

function showRejectionModal(rejectedBy, reason, recipient, amount) {
    const modal = document.getElementById('rejectionModal');
    const messageEl = document.getElementById('rejectionMessage');
    messageEl.innerHTML = `
        <strong>Rejected by:</strong> ${rejectedBy}<br>
        <strong>Recipient:</strong> ${recipient}<br>
        <strong>Amount:</strong> RM ${amount}<br>
        <strong>Reason:</strong> ${reason}<br><br>
        This transaction has been blocked and will not be processed.
    `;
    modal.style.display = 'flex';
}

function showWaitingModal(txnId) {
    const modal = document.getElementById('waitingModal');
    const timerSpan = document.getElementById('timerText');
    modal.style.display = 'flex';
    let seconds = 20; // 20 seconds timeout
    timerSpan.innerText = `${seconds} seconds remaining`;
    waitingModalTimeout = setInterval(() => {
        seconds--;
        timerSpan.innerText = `${seconds} seconds remaining`;
        if (seconds <= 0) {
            clearInterval(waitingModalTimeout);
            modal.style.display = 'none';
            window.open(`call.html?txnId=${txnId}`, '_blank');
        }
    }, 1000);
}

function showBlockedModal(reason, recipient, amount) {
    const modal = document.getElementById('blockedModal');
    const msg = `Transaction to ${recipient} of RM ${amount} has been BLOCKED.\nReason: ${reason}\nYour trusted person has also been notified.`;
    document.getElementById('blockedMessage').innerText = msg;
    modal.style.display = 'flex';
}

function showResultModal(title, message, type) {
    const modal = document.getElementById('resultModal');
    const titleEl = document.getElementById('resultTitle');
    const msgEl = document.getElementById('resultMessage');
    titleEl.innerText = title;
    msgEl.innerText = message;
    modal.style.display = 'flex';
    setTimeout(() => { modal.style.display = 'none'; }, 5000);
}

function addToHistory(account, amount, remark, status) {
    const item = { date: new Date().toLocaleString(), account, amount, remark, status };
    transactionHistory.unshift(item);
    const historyList = document.getElementById('transactionHistory');
    if (transactionHistory.length === 0) historyList.innerHTML = '<li class="empty-history">no transactions yet</li>';
    else {
        historyList.innerHTML = transactionHistory.slice(0, 8).map(tx => `
            <li><strong>${tx.date}</strong><br>to: ${tx.account} | amount: RM ${tx.amount}<br>remark: ${tx.remark} | <span style="color:${tx.status === 'COMPLETED' ? '#8F9E6E' : tx.status === 'APPROVED' ? '#B9B07E' : '#C17B4A'}">${tx.status.toLowerCase()}</span></li>
        `).join('');
    }
}
function clearForm() {
    document.getElementById('recipientAccount').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('remark').value = '';
}