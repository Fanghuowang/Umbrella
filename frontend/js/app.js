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
    } catch (err) {
        console.error(err);
    }
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
    if (el) el.textContent = 'RM ' + currentBalance.toFixed(2);
}

async function showLoadingModal() {
    const modal = document.getElementById('loadingModal');
    modal.style.display = 'flex';
    const steps = ['step1', 'step2', 'step3'];
    for (let i = 0; i < steps.length; i++) {
        await sleep(800);
        document.getElementById(steps[i]).classList.add('active');
        let width = '25%';
        if (i === 1) width = '60%';
        if (i === 2) width = '100%';
        document.getElementById('progressBar').style.width = width;
    }
}

function hideLoadingModal() {
    document.getElementById('loadingModal').style.display = 'none';
    ['step1', 'step2', 'step3'].forEach(function (id) {
        document.getElementById(id).classList.remove('active');
    });
    document.getElementById('progressBar').style.width = '0%';
}

function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
}

async function handleTransfer(e) {
    e.preventDefault();

    const recipient_account = document.getElementById('recipientAccount').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const remark = document.getElementById('remark').value;

    if (!recipient_account) {
        alert('Please enter recipient account number');
        return;
    }
    if (!amount || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    if (!remark || remark.trim() === '') {
        alert('Remark is required. Please describe the purpose of this transfer');
        return;
    }
    if (amount > currentBalance) {
        alert('Insufficient balance. Current balance: RM ' + currentBalance.toFixed(2));
        return;
    }

    await showLoadingModal();

    const transferBtn = document.getElementById('transferBtn');
    transferBtn.disabled = true;
    transferBtn.textContent = 'Processing...';

    try {
        const response = await fetch('/api/transactions/initiate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: 'user1',
                recipient_account: recipient_account,
                amount: amount,
                remark: remark.trim()
            })
        });

        const result = await response.json();
        hideLoadingModal();

        if (result.success && result.decision === 'ALLOW') {
            if (result.newBalance !== undefined) {
                currentBalance = result.newBalance;
                updateBalanceDisplay();
            }
            showResultModal('Transaction Completed', 'Your transfer has been processed successfully.', 'success');
            addToHistory(recipient_account, amount, remark, 'COMPLETED');
            clearForm();
        }
        else if (result.decision === 'BLOCK') {
            currentTransactionId = result.transactionId;
            showBlockedModal(result.reason, recipient_account, amount);
            addToHistory(recipient_account, amount, remark, 'BLOCKED');
            clearForm();
        }
        else if (result.decision === 'WARN') {
            currentTransactionId = result.transactionId;
            trustedWindow = window.open('trusted.html?txnId=' + result.transactionId, '_blank');
            showWaitingModal(result.transactionId, result.reason);
            startPolling(result.transactionId);
        }
        else if (result.error) {
            alert(result.error);
        }
    } catch (err) {
        console.error(err);
        alert('Connection error. Please check if the server is running.');
    } finally {
        transferBtn.disabled = false;
        transferBtn.textContent = 'check and transfer';
    }
}

function showWaitingModal(txnId, warningReason) {
    const modal = document.getElementById('waitingModal');
    const timerSpan = document.getElementById('timerText');
    const waitingMessage = document.getElementById('waitingMessage');

    if (warningReason) {
        waitingMessage.innerHTML = 'TRANSACTION HELD\n\nReason: ' + warningReason + '\n\nWe have notified your trusted person (Siti Ahmad).\nPlease wait for their approval or rejection.';
    } else {
        waitingMessage.innerHTML = 'We have notified your trusted person. Please wait for their decision.';
    }

    modal.style.display = 'flex';
    let seconds = 20;
    timerSpan.innerText = seconds + ' seconds remaining';

    if (waitingModalTimeout) clearInterval(waitingModalTimeout);
    waitingModalTimeout = setInterval(function () {
        seconds = seconds - 1;
        timerSpan.innerText = seconds + ' seconds remaining';
        if (seconds <= 0) {
            clearInterval(waitingModalTimeout);
            modal.style.display = 'none';
            window.open('call.html?txnId=' + txnId, '_blank');
        }
    }, 1000);
}

function startPolling(txnId) {
    if (statusPollingInterval) clearInterval(statusPollingInterval);
    statusPollingInterval = setInterval(async function () {
        try {
            const res = await fetch('/api/transactions/status/' + txnId);
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
                showResultModal('Transaction Approved', 'Your trusted person has approved the transaction. The transfer is complete.', 'success');
                const details = await fetch('/api/transactions/details/' + txnId);
                const tx = await details.json();
                addToHistory(tx.recipient_account, tx.amount, tx.remark, 'APPROVED');
                clearForm();
                currentTransactionId = null;
            } else if (status === 'REJECTED') {
                clearInterval(statusPollingInterval);
                document.getElementById('waitingModal').style.display = 'none';
                if (waitingModalTimeout) clearInterval(waitingModalTimeout);
                const details = await fetch('/api/transactions/details/' + txnId);
                const tx = await details.json();
                showRejectionModal('Trusted Person', tx.ai_reason, tx.recipient_account, tx.amount);
                addToHistory(tx.recipient_account, tx.amount, tx.remark, 'REJECTED');
                clearForm();
                currentTransactionId = null;
            } else if (status === 'REJECTED_BY_NSRC') {
                clearInterval(statusPollingInterval);
                document.getElementById('waitingModal').style.display = 'none';
                if (waitingModalTimeout) clearInterval(waitingModalTimeout);
                const details = await fetch('/api/transactions/details/' + txnId);
                const tx = await details.json();
                showRejectionModal('National Scam Response Centre', tx.ai_reason, tx.recipient_account, tx.amount);
                addToHistory(tx.recipient_account, tx.amount, tx.remark, 'REJECTED');
                clearForm();
                currentTransactionId = null;
            }
        } catch (err) {
            console.error('Polling error', err);
        }
    }, 2000);
}

function showRejectionModal(rejectedBy, reason, recipient, amount) {
    const modal = document.getElementById('rejectionModal');
    const messageEl = document.getElementById('rejectionMessage');
    messageEl.innerHTML = 'Rejected by: ' + rejectedBy + '\nRecipient: ' + recipient + '\nAmount: RM ' + amount + '\nReason: ' + reason + '\n\nThis transaction has been blocked and will not be processed.';
    modal.style.display = 'flex';
}

function showBlockedModal(reason, recipient, amount) {
    const modal = document.getElementById('blockedModal');
    const msg = 'Transaction to ' + recipient + ' of RM ' + amount + ' has been BLOCKED.\nReason: ' + reason + '\nYour trusted person has also been notified.';
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
    setTimeout(function () {
        modal.style.display = 'none';
    }, 5000);
}

function addToHistory(account, amount, remark, status) {
    const item = {
        date: new Date().toLocaleString(),
        account: account,
        amount: amount,
        remark: remark,
        status: status
    };
    transactionHistory.unshift(item);
    const historyList = document.getElementById('transactionHistory');
    if (transactionHistory.length === 0) {
        historyList.innerHTML = '<li class="empty-history">no transactions yet</li>';
    } else {
        var html = '';
        for (var i = 0; i < Math.min(transactionHistory.length, 8); i++) {
            var tx = transactionHistory[i];
            var color = '#8F9E6E';
            if (tx.status === 'APPROVED') color = '#B9B07E';
            if (tx.status === 'REJECTED' || tx.status === 'BLOCKED') color = '#C17B4A';
            html += '<li><strong>' + tx.date + '</strong><br>to: ' + tx.account + ' | amount: RM ' + tx.amount + '<br>remark: ' + (tx.remark || '-') + ' | <span style="color:' + color + '">' + tx.status.toLowerCase() + '</span></li>';
        }
        historyList.innerHTML = html;
    }
}

function clearForm() {
    document.getElementById('recipientAccount').value = '';
    document.getElementById('amount').value = '';
    document.getElementById('remark').value = '';
}