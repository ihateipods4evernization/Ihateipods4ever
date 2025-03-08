import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import Stripe from 'stripe';
import pkg from 'tweetnacl';
const { box, randomBytes } = pkg;
import util from 'tweetnacl-util';
const { encodeBase64, decodeBase64 } = util;
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'your_stripe_key');

// In-memory storage (no persistence)
const activeGroups = new Map();
const userMessageCounts = new Map();
const FREE_MESSAGE_LIMIT = 500;

class Group {
  constructor() {
    this.id = uuidv4();
    this.clients = new Set();
    this.publicKey = null;
  }

  addClient(ws) {
    this.clients.add(ws);
  }

  removeClient(ws) {
    this.clients.delete(ws);
  }

  broadcast(message, sender) {
    this.clients.forEach(client => {
      if (client !== sender && client.readyState === 1) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

wss.on('connection', (ws) => {
  let userGroup = null;
  let userId = uuidv4();
  
  ws.on('message', async (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'create_group':
        userGroup = new Group();
        activeGroups.set(userGroup.id, userGroup);
        userGroup.addClient(ws);
        ws.send(JSON.stringify({
          type: 'group_created',
          groupId: userGroup.id
        }));
        break;

      case 'join_group':
        const group = activeGroups.get(message.groupId);
        if (group) {
          userGroup = group;
          group.addClient(ws);
          ws.send(JSON.stringify({
            type: 'joined_group',
            groupId: group.id
          }));
        }
        break;

      case 'chat_message':
        if (!userGroup) return;

        // Check message count
        const currentCount = userMessageCounts.get(userId) || 0;
        if (currentCount >= FREE_MESSAGE_LIMIT) {
          // Check if user has paid
          if (!message.isPro) {
            ws.send(JSON.stringify({
              type: 'payment_required',
              message: 'Please upgrade to continue sending messages'
            }));
            return;
          }
        }

        userMessageCounts.set(userId, currentCount + 1);
        
        // Broadcast encrypted message
        userGroup.broadcast({
          type: 'chat_message',
          content: message.content,
          sender: userId,
          timestamp: Date.now()
        }, ws);
        break;

      case 'payment_intent':
        try {
          const paymentIntent = await stripe.paymentIntents.create({
            amount: 100, // $1.00
            currency: 'usd',
            payment_method_types: ['card']
          });
          
          ws.send(JSON.stringify({
            type: 'payment_intent_created',
            clientSecret: paymentIntent.client_secret
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Payment processing failed'
          }));
        }
        break;
    }
  });

  ws.on('close', () => {
    if (userGroup) {
      userGroup.removeClient(ws);
      if (userGroup.clients.size === 0) {
        activeGroups.delete(userGroup.id);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});