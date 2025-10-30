// js/app.js - Aapka Main Router (Module wala)

import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const contentArea = document.getElementById('content-area');
const navLinks = document.querySelectorAll('.nav-link');

// 1. Auth Check (Sabse Zaroori)
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Auth state changed: Logged in", user.uid);
        window.currentRider = user; 
        handleRouteChange(); // App shuru karein
    } else {
        console.log("Auth state changed: Logged out");
        window.location.href = 'index.html';
    }
});

// 2. Page Load Karne wala Function
async function loadPage(pageName) {
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.id === `nav-${pageName}`) {
            link.classList.add('active');
        }
    });

    try {
        const response = await fetch(`pages/${pageName}.html`);
        if (!response.ok) throw new Error('Page not found');
        contentArea.innerHTML = await response.text();
    } catch (error) {
        console.error('Failed to load page:', error);
        contentArea.innerHTML = '<h2>Page not found or error.</h2>';
    }
}

// 3. Mukhya Router Logic
async function handleRouteChange() {
    if (!window.currentRider) return;
    
    const pageName = window.location.hash.slice(1) || 'home';
    await loadPage(pageName);

    switch (pageName) {
        case 'home':
            const { initHomePage } = await import('./pages/home.js');
            initHomePage();
            break;
        case 'pickup':
            const { initPickupPage } = await import('./pages/pickup.js');
            initPickupPage();
            break;
        case 'notes':
            const { initNotesPage } = await import('./pages/notes.js');
            initNotesPage();
            break;
        case 'account':
            const { initAccountPage } = await import('./pages/account.js');
            initAccountPage();
            break;
    }
}

// 4. Event Listeners
window.addEventListener('hashchange', handleRouteChange);