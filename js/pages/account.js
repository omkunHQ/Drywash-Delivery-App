// js/pages/account.js (Complete Code - Handles Deposit & Logout)

import { db, auth } from '../firebase-config.js';
import {
    doc,
    getDoc,
    updateDoc,
    collection,
    addDoc,
    serverTimestamp,
    writeBatch,
    increment // Increment import (in case you need it later, though not used in deposit)
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Global Variables ---
let logoutModalInstance = null;
let currentCodBalance = 0; // Store current balance

// --- DOM Element Variables ---
let riderNameEl, riderEmailEl, codBalanceEl, adminPayoutEl, logoutBtn, confirmLogoutBtn;
let depositBtn, depositMsgEl;

// --- Helper: Cache Selectors ---
// This function finds all elements. If any are missing, it throws an error.
function cacheAccountSelectors() {
    riderNameEl = document.getElementById('rider-name');
    riderEmailEl = document.getElementById('rider-email');
    codBalanceEl = document.getElementById('cod-balance');
    adminPayoutEl = document.getElementById('admin-payout');
    logoutBtn = document.getElementById('logout-btn');
    confirmLogoutBtn = document.getElementById('confirm-logout-btn');
    depositBtn = document.getElementById('deposit-cod-btn');
    depositMsgEl = document.getElementById('deposit-message');

    // Check if all elements were found
    if (!riderNameEl || !riderEmailEl || !codBalanceEl || !adminPayoutEl || !logoutBtn || !confirmLogoutBtn || !depositBtn || !depositMsgEl) {
         console.error("ACCOUNT: One or more required HTML elements were not found!");
         // This error stops initAccountPage from continuing
         throw new Error("Account page HTML elements are missing.");
    }
    console.log("ACCOUNT: All selectors cached.");
}


// --- Helper: Handle COD Deposit ---
async function handleDepositCod() {
    if (currentCodBalance <= 0) {
        depositMsgEl.textContent = "No COD balance to deposit.";
        depositMsgEl.className = 'mt-2 small text-center text-warning';
        return;
    }

    const riderId = auth.currentUser.uid;
    const riderDocRef = doc(db, "riders", riderId);
    const depositAmount = currentCodBalance; // Store the amount to be deposited

    // Confirmation
    if (!confirm(`Are you sure you want to mark ₹${depositAmount.toFixed(2)} as deposited with Admin? This cannot be undone.`)) {
        return;
    }

    // --- UI Update: Show Loading ---
    depositBtn.disabled = true;
    const spinner = depositBtn.querySelector('.spinner-border');
    spinner?.classList.remove('d-none');
    depositMsgEl.textContent = "Processing deposit...";
    depositMsgEl.className = 'mt-2 small text-center text-muted';

    try {
        // Use a Batch Write for atomic operation (safer)
        const batch = writeBatch(db);

        // 1. Update Rider's balance to 0
        batch.update(riderDocRef, {
            "account.cod_balance": 0 // Set balance to zero
        });

        // 2. Add a record to 'cod_deposits' collection
        const depositsColRef = collection(db, "cod_deposits");
        batch.set(doc(depositsColRef), { // Automatically generate ID
            riderId: riderId,
            riderName: riderNameEl.textContent || 'N/A', // Store name for easier admin view
            amountDeposited: depositAmount,
            depositTimestamp: serverTimestamp(), // Use server time
            status: "DEPOSITED_BY_RIDER" // Initial status
        });

        // Commit the batch
        await batch.commit();

        // --- UI Update: Success ---
        currentCodBalance = 0; // Update local balance
        codBalanceEl.textContent = '0.00';
        depositBtn.disabled = true; // Disable button as balance is now 0
        depositMsgEl.textContent = `Successfully marked ₹${depositAmount.toFixed(2)} as deposited!`;
        depositMsgEl.className = 'mt-2 small text-center text-success';
        console.log("ACCOUNT: COD Deposit successful.");

    } catch (err) {
        console.error("ACCOUNT: Error processing COD deposit:", err);
        // --- UI Update: Error ---
        depositMsgEl.textContent = "Error processing deposit: " + err.message;
        depositMsgEl.className = 'mt-2 small text-center text-danger';
        depositBtn.disabled = false; // Re-enable button on error
    } finally {
        spinner?.classList.add('d-none'); // Hide spinner
    }
}

// --- Helper: Show Logout Modal ---
function showLogoutModal(){
     if(logoutModalInstance) {
        logoutModalInstance.show();
     } else {
        console.warn("ACCOUNT: Logout modal instance not found. Using fallback alert.");
        if(confirm("Are you sure you want to logout?")) {
            confirmLogoutAction();
        }
     }
}

// --- Helper: Confirm Logout Action ---
function confirmLogoutAction(){
     const btn = document.getElementById('confirm-logout-btn'); // Re-select button
     if(!btn) {
         // If modal isn't present, just sign out
         signOut(auth).catch((error) => console.error("Sign out error", error));
         return;
     }

     btn.disabled = true;
     btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Logging out...';

     signOut(auth).catch((error) => {
         console.error("Sign out error", error);
         alert("Logout failed: " + error.message);
         // Reset button on error
         btn.disabled = false;
         btn.innerHTML = 'Logout';
         if(logoutModalInstance) logoutModalInstance.hide();
     });
     // onAuthStateChanged in app.js will handle redirect
}
// --- End Helper Functions ---


// --- Page Initialization (Main Function) ---
export async function initAccountPage() {
    console.log("Account Page Initialized (v15 - Complete)");

    // Check if user is logged in (handled by app.js, but good practice)
    if (!auth.currentUser) {
        console.error("ACCOUNT: User not logged in, aborting init.");
        return;
    }

    try {
        // 1. Find all HTML elements first
        cacheAccountSelectors();

        // 2. Initialize Logout Modal (safe check)
        const logoutModalEl = document.getElementById('logoutConfirmModal');
        if (logoutModalEl && !logoutModalInstance) {
            try {
                logoutModalInstance = new bootstrap.Modal(logoutModalEl);
                 console.log("ACCOUNT: Logout modal initialized.");
            } catch (modalError) {
                console.error("ACCOUNT: Error initializing logout modal", modalError);
                logoutModalInstance = null; // Ensure it's null if init fails
            }
        } else if (!logoutModalEl) {
             console.warn("ACCOUNT: logoutConfirmModal HTML not found. Logout will use fallback alert.");
        }

        // 3. Setup Event Listeners (Remove old ones first to prevent duplicates)
        logoutBtn.removeEventListener('click', showLogoutModal);
        logoutBtn.addEventListener('click', showLogoutModal);

        confirmLogoutBtn.removeEventListener('click', confirmLogoutAction);
        confirmLogoutBtn.addEventListener('click', confirmLogoutAction);

        depositBtn.removeEventListener('click', handleDepositCod);
        depositBtn.addEventListener('click', handleDepositCod);
        console.log("ACCOUNT: Event listeners attached.");

        // 4. Fetch Rider Data
        // Reset UI state before fetching
        currentCodBalance = 0;
        depositBtn.disabled = true;
        depositMsgEl.textContent = '';
        codBalanceEl.textContent = '0.00';
        adminPayoutEl.textContent = '0.00';
        riderNameEl.textContent = 'Loading...';
        riderEmailEl.textContent = 'Loading...';

        const riderId = auth.currentUser.uid;
        const riderDocRef = doc(db, "riders", riderId);
        const riderSnap = await getDoc(riderDocRef);

        if (riderSnap.exists()) {
            const data = riderSnap.data();

            riderNameEl.textContent = data.name || "Rider Name";
            riderEmailEl.textContent = data.email || auth.currentUser.email;

            if (data.account) {
                currentCodBalance = data.account.cod_balance || 0;
                codBalanceEl.textContent = currentCodBalance.toFixed(2);
                adminPayoutEl.textContent = (data.account.admin_payout || 0).toFixed(2);
                depositBtn.disabled = (currentCodBalance <= 0);
            } else {
                 console.warn("ACCOUNT: No 'account' object found in rider doc.");
                 // UI is already reset to 0.00 and button disabled
            }
        } else {
            console.error("ACCOUNT: Rider document not found!");
            riderNameEl.textContent = "Error: User data not found";
            riderEmailEl.textContent = auth.currentUser.email;
        }

    } catch (err) {
        // This catch block will run if cacheAccountSelectors() fails
        console.error("ACCOUNT: Initialization failed:", err.message);
        const contentArea = document.getElementById('content-area');
        if(contentArea) {
             contentArea.innerHTML = `<div class="alert alert-danger m-3">Error loading account page: ${err.message}</div>`;
        }
    }
}
// --- End Initialization ---