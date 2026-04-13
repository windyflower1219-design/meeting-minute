import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyASpHBTutEdzNR6KWIEmVZpI3Zk5Ykcyoo",
  authDomain: "meeting-5baf4.firebaseapp.com",
  projectId: "meeting-5baf4",
  storageBucket: "meeting-5baf4.firebasestorage.app",
  messagingSenderId: "836973075927",
  appId: "1:836973075927:web:2c97dd868516a59ce83f92",
  measurementId: "G-KE8XC20BVJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

export default app;
