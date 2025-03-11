import { box, randomBytes } from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

const stripe = Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
let ws;
let keyPair;
let groupId;
let messageCount = 0;
let isPro = false;

// Generate encryption keys
const generateKeyPair = () => {
    const keypair = box.keyPair();
    return {
        publicKey: encodeBase64(keypair.publicKey),
        secretKey: encodeBase64(keypair.secretKey)
    };
};

// Initialize WebSocket connection
const connectWebSocket = () => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname + (window.location.port ? ':' + window.location.port : '');
    const wsUrl = `${wsProtocol}//${wsHost}/ws`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleMessage(message);
    };

    ws.onclose = () => {
        document.getElementById('status').textContent = 'Disconnected';
        // Attempt to reconnect after a delay
        setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        document.getElementById('status').textContent = 'Connection error';
    };
};

// Handle incoming messages
const handleMessage = (message) => {
    switch (message.type) {
        case 'group_created':
            groupId = message.groupId;
            document.getElementById('connection-area').style.display = 'none';
            document.getElementById('chat-area').style.display = 'block';
            document.getElementById('status').textContent = `Connected to group: ${groupId}`;
            break;

        case 'chat_message':
            displayMessage(message);
            messageCount++;
            checkMessageLimit();
            break;

        case 'payment_required':
            showPaymentForm();
            break;

        case 'payment_intent_created':
            handlePaymentIntent(message.clientSecret);
            break;
    }
};

// Display message in the chat
const displayMessage = (message) => {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.textContent = `${message.sender}: ${message.content}`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
};

// Check message limit and show payment form if needed
const checkMessageLimit = () => {
    if (messageCount >= 500 && !isPro) {
        showPaymentForm();
    }
};

// Show payment form
const showPaymentForm = () => {
    document.getElementById('payment-area').style.display = 'block';
    const elements = stripe.elements();
    const card = elements.create('card');
    card.mount('#card-element');
};

// Handle payment intent
const handlePaymentIntent = async (clientSecret) => {
    const result = await stripe.confirmCardPayment(clientSecret);
    if (result.error) {
        alert('Payment failed: ' + result.error.message);
    } else {
        isPro = true;
        document.getElementById('payment-area').style.display = 'none';
        alert('Payment successful! You now have unlimited messages.');
    }
};

// Event Listeners
document.getElementById('createGroup').addEventListener('click', () => {
    keyPair = generateKeyPair();
    ws.send(JSON.stringify({
        type: 'create_group'
    }));
});

document.getElementById('joinGroup').addEventListener('click', async () => {
    if ('nfc' in navigator) {
        try {
            const ndef = new NDEFReader();
            await ndef.scan();
            
            ndef.addEventListener('reading', ({ message }) => {
                const decoder = new TextDecoder();
                const groupId = decoder.decode(message.records[0].data);
                
                ws.send(JSON.stringify({
                    type: 'join_group',
                    groupId: groupId
                }));
            });
        } catch (error) {
            alert('NFC scanning failed: ' + error);
        }
    } else {
        alert('NFC is not supported on this device');
    }
});

document.getElementById('sendMessage').addEventListener('click', () => {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (content) {
        ws.send(JSON.stringify({
            type: 'chat_message',
            content: content,
            isPro: isPro
        }));
        input.value = '';
    }
});

document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    ws.send(JSON.stringify({
        type: 'payment_intent'
    }));
});

// Initialize connection
connectWebSocket();