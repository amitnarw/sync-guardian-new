require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Firebase Admin Setup (Requires serviceAccountKey.json)
// For now, we'll use a placeholder or check for environment variables
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
  : null;

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('Firebase Admin initialized');
} else {
  console.warn('Firebase Admin NOT initialized: Missing environment variables');
}

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'SyncGuardian API is running' });
});

// Mock Realtime Sync Route
app.get('/api/sync/status', (req, res) => {
  res.json({
    syncLevel: 94,
    lastSync: new Date().toISOString(),
    devices: [
      { name: 'iPhone 15', status: 'connected' },
      { name: 'iPad Pro', status: 'connected' },
      { name: 'Samsung Tab S9', status: 'syncing' },
      { name: 'Sarah\'s MacBook', status: 'connected' },
    ],
  });
});

// Push Notification Route
app.post('/api/notifications/send', async (req, res) => {
  const { token, title, body } = req.body;
  
  if (!serviceAccount) {
    return res.status(500).json({ error: 'Firebase Admin not configured' });
  }

  try {
    const response = await admin.messaging().send({
      token,
      notification: { title, body },
      android: { priority: 'high' },
    });
    res.json({ success: true, messageId: response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
