// js/firebase-config.js

// Firebase v10 (modular) SDKs ko import karein
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// TODO: YAHAN APNI FIREBASE CONFIG DAALEIN
const firebaseConfig = {
    apiKey: "AIzaSyCxVmGqlbomo47KqXZm4S8QqfL3bXZN6pg", // Keep your actual key
    authDomain: "drywash-7d086.firebaseapp.com",
    projectId: "drywash-7d086",
    storageBucket: "drywash-7d086.appspot.com", // Check if this is correct (usually .appspot.com)
    messagingSenderId: "850083946512",
    appId: "1:850083946512:web:f0ae239d283abd1dffaa95",
    measurementId: "G-TLPBTQ31KT" // Optional
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Services ko export karein taaki doosri files use kar sakein
export const auth = getAuth(app);
export const db = getFirestore(app);