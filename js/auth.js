// js/auth.js

import { auth } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


const loginBtn = document.getElementById('login-btn');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const errorEl = document.getElementById('login-error');

// Check karein ki user pehle se logged in hai ya nahi
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = 'main.html';
    } else {
        console.log("User logged out");
    }
});

loginBtn.addEventListener('click', () => {
    const email = emailEl.value;
    const password = passwordEl.value;
    
    if (!email || !password) {
        errorEl.textContent = "Please enter email and password.";
        return;
    }
    
    console.log('Logging in...');
    errorEl.textContent = "";
    loginBtn.textContent = "Logging in...";
    loginBtn.disabled = true;

    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        window.location.href = 'main.html';
      })
      .catch((error) => {
        errorEl.textContent = error.message;
        loginBtn.textContent = "Login";
        loginBtn.disabled = false;
      });
});