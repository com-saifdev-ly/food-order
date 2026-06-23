import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, deleteToken } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAvt305CHhyqU9ioX4lo6BSMibNHhnBogg",
  authDomain: "foodorder-61363.firebaseapp.com",
  projectId: "foodorder-61363",
  storageBucket: "foodorder-61363.firebasestorage.app",
  messagingSenderId: "899507605246",
  appId: "1:899507605246:web:7336640e3105e28ce4dfaf",
  measurementId: "G-0RVRQBB7S8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
const messaging = getMessaging(app);

export { app, messaging, getToken, onMessage, deleteToken };
