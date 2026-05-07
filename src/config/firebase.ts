import admin from 'firebase-admin';

import { config } from '@/config/index';

let firebaseApp: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App {
  if (!firebaseApp) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        privateKey: config.firebase.privateKey.replace(/\\n/g, '\n'),
        clientEmail: config.firebase.clientEmail,
      }),
    });
  }
  return firebaseApp;
}

function getMessaging(): admin.messaging.Messaging {
  return getFirebaseApp().messaging();
}

export { getFirebaseApp, getMessaging };
