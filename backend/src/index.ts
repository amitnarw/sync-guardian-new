import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import { SyncStatus, DeviceStatus } from '@sync-guardian/shared';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Firebase Admin Setup
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
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'SyncGuardian API is running (TypeScript)' });
});

// Realtime Sync Route
app.get('/api/sync/status', (req: Request, res: Response) => {
  const status: SyncStatus = {
    syncLevel: 94,
    lastSync: new Date().toISOString(),
    devices: [
      { name: 'iPhone 15', status: DeviceStatus.CONNECTED },
      { name: 'iPad Pro', status: DeviceStatus.CONNECTED },
      { name: 'Samsung Tab S9', status: DeviceStatus.SYNCING },
      { name: 'Sarah\'s MacBook', status: DeviceStatus.CONNECTED },
    ],
  };
  res.json(status);
});

// Push Notification Route
app.post('/api/notifications/send', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[TypeScript] Server running on port ${PORT}`);
});
