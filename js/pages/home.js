/* js/pages/home.js (COMPLETE CODE - v24 - Immediate UI Update Fix)
 * - v23 की गलती को सुधारा गया।
 * - 'handleActionClick' को वापस 'renderTaskUI' कॉल करने की अनुमति दी गई है।
 * - यह डेटाबेस अपडेट के बाद UI को तुरंत री-रेंडर करेगा,
 * जिससे स्पिनर के फंसे रहने की समस्या 100% हल हो जाएगी।
 * - यह कोड मानता है कि HTML में सभी बटनों पर '.action-label' मौजूद है।
 */

import { db, auth } from '../firebase-config.js';
import {
    doc, onSnapshot, getDoc, updateDoc, Timestamp, increment,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- DOM Elements Cache ---
let noTaskCard, taskCard, orderIdEl, taskStatusBadgeEl,
    taskTypeIconEl, taskTypeTextEl,
    locationNameEl, locationAddressEl, callBtn, callLabelEl, mapBtn, locationPhoneDisplayEl,
    paymentInfoEl, paymentDetailsDisplayEl, paymentStatusEl, paymentAmountEl,
    actionButtonsContainer;
// Specific Action Buttons
let btnReached, btnConfirmPickup, btnDeliveredPaid, btnDeliveredCod;

let currentTaskRef = null;
let unSubRider = null;
let unSubTask = null;
let currentTaskData = null;
let taskCompleteModalInstance = null;

// Helper: Cache all selectors
function cacheSelectors() {
    console.log("HOME: Caching selectors (v24)...");
    noTaskCard = document.getElementById('no-task-card');
    taskCard = document.getElementById('task-card');
    orderIdEl = document.getElementById('order-id');
    taskStatusBadgeEl = document.getElementById('task-status-badge');
    taskTypeIconEl = document.getElementById('task-type-icon');
    taskTypeTextEl = document.getElementById('task-type-text');
    locationNameEl = document.getElementById('location-name');
    locationAddressEl = document.getElementById('location-address');
    callBtn = document.getElementById('call-btn');
    callLabelEl = document.getElementById('call-label');
    mapBtn = document.getElementById('map-btn');
    locationPhoneDisplayEl = document.getElementById('location-phone-display');
    paymentInfoEl = document.getElementById('payment-info');
    paymentDetailsDisplayEl = document.getElementById('payment-details-display');
    paymentStatusEl = document.getElementById('payment-status');
    paymentAmountEl = document.getElementById('payment-amount');
    actionButtonsContainer = document.getElementById('action-buttons-container');
    btnReached = document.getElementById('btn-reached');
    btnConfirmPickup = document.getElementById('btn-confirm-pickup');
    btnDeliveredPaid = document.getElementById('btn-delivered-paid');
    btnDeliveredCod = document.getElementById('btn-delivered-cod');

    const essentialElements = [
        noTaskCard, taskCard, orderIdEl, taskStatusBadgeEl, taskTypeIconEl, taskTypeTextEl,
        locationNameEl, locationAddressEl, callBtn, callLabelEl, mapBtn, paymentInfoEl,
        paymentDetailsDisplayEl, paymentStatusEl, paymentAmountEl, actionButtonsContainer,
        btnReached, btnConfirmPickup, btnDeliveredPaid, btnDeliveredCod
    ];
    
    const missingElement = essentialElements.find(el => !el);
    if (missingElement) {
         const elNames = [
            'no-task-card', 'task-card', 'order-id', 'task-status-badge', 'task-type-icon', 'task-type-text',
            'location-name', 'location-address', 'call-btn', 'call-label', 'map-btn', 'payment-info',
            'payment-details-display', 'payment-status', 'payment-amount', 'action-buttons-container',
            'btn-reached', 'btn-confirm-pickup', 'btn-delivered-paid', 'btn-delivered-cod'
         ];
         const missingId = elNames.find(id => !document.getElementById(id));
         console.error(`HOME: FATAL - Essential element missing! ID: '${missingId || 'Unknown'}'`);
         throw new Error(`Essential HTML element missing (ID: ${missingId}). Check your HTML.`);
    }
    console.log("HOME: Selectors cached successfully.");
}


// Helper: Get status badge class
function getStatusClass(status) {
     switch (status) {
          case 'assigned': case 'in_progress': return 'text-bg-warning';
          case 'verified': return 'text-bg-info';
          case 'arrived_pickup': return 'text-bg-info';
          case 'picked_up': return 'text-bg-primary';
          case 'arrived_drop': return 'text-bg-success';
          case 'completed': return 'text-bg-secondary';
          case 'cancelled': return 'text-bg-danger';
          default: return 'text-bg-dark';
     }
}

// Helper: Get Map URL
function getMapUrl(address, location) {
    let mapUrl = `http://googleusercontent.com/maps/google.com/0{encodeURIComponent(address || '')}`;
    if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
        mapUrl = `http://googleusercontent.com/maps/google.com/0{location.latitude},${location.longitude}`;
    }
    return mapUrl;
}

// Helper function: Task Complete Modal ko dikhayein
function showTaskCompleteModal(isCod, amount) {
    if (!taskCompleteModalInstance) {
        const modalEl = document.getElementById('taskCompleteModal');
        if (modalEl) {
             taskCompleteModalInstance = new bootstrap.Modal(modalEl);
        } else {
             alert(isCod ? `Task Completed! (COD ₹${amount} added)` : 'Task Completed!');
             return;
        }
    }
    
    // 0 KM और 0 MIN को छिपाएँ
    const kmDisplay = document.querySelector('#taskCompleteModal .summary-distance'); 
    const minDisplay = document.querySelector('#taskCompleteModal .summary-time');
    
    if (kmDisplay && kmDisplay.parentElement) {
        kmDisplay.parentElement.style.display = 'none'; 
    }
    if (minDisplay && minDisplay.parentElement && minDisplay.parentElement !== kmDisplay?.parentElement) {
        minDisplay.parentElement.style.display = 'none';
    }
    
    const summaryDiv = document.getElementById('taskSummary');
    const codDiv = document.getElementById('codSummary');
    const paidDiv = document.getElementById('paidSummary');
    const codAmountSpan = document.getElementById('codCollectedAmount');
    
    if (!summaryDiv || !codDiv || !paidDiv || !codAmountSpan) {
        console.error("HOME: Task Complete Modal elements not found!");
        alert(isCod ? `Task Completed! (COD ₹${amount} added)` : 'Task Completed!');
        return;
    }
    
    summaryDiv.classList.add('d-none');
    codDiv.classList.add('d-none');
    paidDiv.classList.add('d-none');
    
    if (isCod && amount > 0) {
        codAmountSpan.textContent = amount.toFixed(2);
        codDiv.classList.remove('d-none');
        summaryDiv.classList.remove('d-none');
    } else if (!isCod) {
        paidDiv.classList.remove('d-none');
        summaryDiv.classList.remove('d-none');
    }
    
    taskCompleteModalInstance.show();
}


// --- Main UI Update Function (v24 - Null-Safe) ---
function renderTaskUI(taskData) {
    currentTaskData = taskData;
    
    const primaryActionContainer = actionButtonsContainer; // Cached version

    if (!taskData) {
        taskCard?.classList.add('d-none');
        primaryActionContainer?.classList.add('d-none');
        noTaskCard?.classList.remove('d-none');
        return;
    }

    noTaskCard?.classList.add('d-none');
    taskCard?.classList.remove('d-none');
    primaryActionContainer?.classList.remove('d-none');

    const type = taskData.type || 'Delivery';
    const status = taskData.status || 'assigned';
    const orderIdShort = taskData.orderId?.substring(0, 5) || taskData.id?.substring(0, 5) || 'N/A';
    
    orderIdEl.textContent = `#${orderIdShort}`;
    taskStatusBadgeEl.textContent = status.replace('_', ' ').toUpperCase();
    taskStatusBadgeEl.className = `badge ${getStatusClass(status)}`;

    let locationName = 'N/A';
    let locationAddress = 'N/A';
    let locationPhone = '';
    let locationGeoPoint = null;
    let callLabel = 'Contact';
    let taskTypeText = 'Task';
    let taskTypeIconClass = 'bi bi-geo-alt-fill text-primary';

    if (status === 'assigned' || status === 'in_progress' || status === 'verified' || status === 'arrived_pickup') {
        locationName = taskData.pickupName || 'Pickup Location';
        locationAddress = taskData.pickupAddress || 'N/A';
        locationPhone = taskData.pickupPhone || '';
        locationGeoPoint = taskData.pickupLocation || null;
        callLabel = (type === 'Delivery') ? 'Call Store' : 'Call Customer';
        taskTypeText = 'Pickup';
        taskTypeIconClass = (type === 'Delivery') ? 'bi bi-shop text-primary' : 'bi bi-house-door-fill text-success';
    
    } else { 
        locationName = taskData.customerName || 'Dropoff Location';
        locationAddress = taskData.customerAddress || 'N/A';
        locationPhone = taskData.customerPhone || '';
        locationGeoPoint = taskData.customerLocation || null;
        callLabel = (type === 'Pickup') ? 'Call Store' : 'Call Customer';
        taskTypeText = 'Drop';
        taskTypeIconClass = (type === 'Pickup') ? 'bi bi-shop text-primary' : 'bi bi-house-door-fill text-success';
    }

    locationNameEl.textContent = locationName;
    locationAddressEl.textContent = locationAddress;
    callBtn.href = locationPhone ? `tel:${locationPhone}` : '#';
    callBtn.classList.toggle('disabled', !locationPhone);
    callLabelEl.textContent = callLabel;
    mapBtn.href = getMapUrl(locationAddress, locationGeoPoint);
    locationPhoneDisplayEl.textContent = '';
    taskTypeTextEl.textContent = taskTypeText;
    taskTypeIconEl.innerHTML = `<i class="${taskTypeIconClass}"></i>`;


    if (status === 'arrived_drop' && type === 'Delivery') {
        paymentInfoEl.classList.remove('d-none');
        if (taskData.isPaid) {
            paymentStatusEl.textContent = 'Paid Online';
            paymentAmountEl.textContent = `₹${taskData.total || 0}`;
            paymentDetailsDisplayEl.className = 'alert alert-success py-2';
        } else {
            paymentStatusEl.textContent = 'Cash on Delivery';
            paymentAmountEl.textContent = `₹${taskData.total || 0}`;
            paymentDetailsDisplayEl.className = 'alert alert-danger py-2';
        }
    } else {
        paymentInfoEl.classList.add('d-none');
    }

    [btnReached, btnConfirmPickup, btnDeliveredPaid, btnDeliveredCod].forEach(btn => btn.classList.add('d-none'));
    
    const setActionLabel = (button, text) => {
        if (!button) return;
        const label = button.querySelector('.action-label');
        if (label) {
            label.textContent = text;
        } else {
            console.warn(`Cannot find '.action-label' for button: #${button.id}. HTML fix needed.`);
        }
    };

    if (status === 'assigned' || status === 'in_progress' || status === 'verified') {
        btnReached.classList.remove('d-none');
        setActionLabel(btnReached, 'Reached Pickup');
        btnReached.dataset.action = 'reached_pickup';
    } else if (status === 'picked_up') {
        btnReached.classList.remove('d-none');
        setActionLabel(btnReached, 'Reached Drop');
        btnReached.dataset.action = 'reached_drop';
    } else if (status === 'arrived_pickup') {
        btnConfirmPickup.classList.remove('d-none');
    } else if (status === 'arrived_drop') {
        if (type === 'Delivery') {
            if (taskData.isPaid) {
                btnDeliveredPaid.classList.remove('d-none');
                setActionLabel(btnDeliveredPaid, 'Mark Delivered (Paid)');
            } else {
                btnDeliveredCod.classList.remove('d-none');
            }
        } else { 
             btnDeliveredPaid.classList.remove('d-none');
             setActionLabel(btnDeliveredPaid, 'Confirm Dropoff (Store)');
        }
    }
}


// 'listenToLiveTask' (v23 - Saral aur Bharosemand)
async function listenToLiveTask(riderDocRef) {
    console.log("HOME: Setting up Firestore listeners (v24)...");
    
    if (unSubTask) { unSubTask(); unSubTask = null; }
    if (unSubRider) { unSubRider(); unSubRider = null; }

    unSubRider = onSnapshot(riderDocRef, (riderSnap) => {
        console.log("HOME: Rider snapshot received.");
        const riderData = riderSnap.data();
        
        if (unSubTask) {
            console.log("HOME: Detaching old task listener.");
            unSubTask();
            unSubTask = null;
        }

        if (riderData && riderData.current_task) {
            currentTaskRef = riderData.current_task;
            console.log("HOME: Attaching new task listener for:", currentTaskRef.path);
            
            unSubTask = onSnapshot(currentTaskRef, (taskSnap) => {
                if (taskSnap.exists()) {
                    const taskData = { id: taskSnap.id, ...taskSnap.data() };
                    console.log("HOME: Task snapshot fired. New status:", taskData.status);
                    renderTaskUI(taskData);
                } else {
                    console.log("HOME: Task document does not exist.");
                    renderTaskUI(null);
                    currentTaskRef = null;
                }
            }, (error) => { 
                console.error("HOME: Error listening to task document:", error); 
                renderTaskUI(null);
                currentTaskRef = null;
            });
        } else {
            console.log("HOME: Rider has no current_task.");
            currentTaskRef = null;
            renderTaskUI(null);
        }
    }, (error) => { 
        console.error("HOME: Error listening to rider document:", error); 
        renderTaskUI(null);
        currentTaskRef = null;
    });
    console.log("HOME: Firestore listeners setup complete.");
}

// Button Clicks ko handle karein
function setupEventListeners() {
    const modalEl = document.getElementById('taskCompleteModal');
    if (modalEl && !taskCompleteModalInstance) {
        taskCompleteModalInstance = new bootstrap.Modal(modalEl);
    }
    actionButtonsContainer.removeEventListener('click', handleActionClick);
    actionButtonsContainer.addEventListener('click', handleActionClick);
    document.body.removeEventListener('click', handleSecondaryLinkClicks);
    document.body.addEventListener('click', handleSecondaryLinkClicks);
}

// Handler for Call/Map links
function handleSecondaryLinkClicks(e) {
    const callLink = e.target.closest('a[id="call-btn"]');
    if(callLink && !callLink.classList.contains('disabled')){
        if (currentTaskData && (currentTaskData.status === 'assigned' || currentTaskData.status === 'in_progress')) {
             setTimeout(async () => {
                 if (!currentTaskRef) return;
                 const taskDocRef = doc(db, "tasks", currentTaskRef.id);
                 try {
                     const riderSnap = await getDoc(doc(db, "riders", auth.currentUser.uid));
                     if (riderSnap.data().current_task && riderSnap.data().current_task.id === currentTaskRef.id) {
                          const currentTaskSnap = await getDoc(taskDocRef);
                          if(currentTaskSnap.exists() && (currentTaskSnap.data().status === 'assigned' || currentTaskSnap.data().status === 'in_progress')) {
                               await updateDoc(taskDocRef, { status: "verified" });
                          }
                     }
                 } catch(err) { console.error("Error updating status after call:", err); }
             }, 5000);
        }
    }
}


async function handleActionClick(e) {
    const actionButton = e.target.closest('.action-button');
    if (!actionButton || !currentTaskRef || actionButton.disabled) return;

    const action = actionButton.dataset.action;
    const taskDocRef = doc(db, "tasks", currentTaskRef.id);
    const riderDocRef = doc(db, "riders", auth.currentUser.uid);
    
    if (!currentTaskData || !currentTaskData.orderId) {
        console.error("HOME: Error! Task data 'orderId' nahi hai.");
        alert("Error: Task 'orderId' se link nahi hai. Admin se check karayein.");
        return;
    }
    const orderId = currentTaskData.orderId;
    const orderDocRef = doc(db, "orders", orderId);
    const taskType = currentTaskData.type || 'Delivery';

    const spinner = actionButton.querySelector('.spinner-border');
    actionButton.disabled = true;
    spinner?.classList.remove('d-none');

    console.log(`HOME: Action: ${action}, Task Type: ${taskType}`);

    try {
        let nextTaskStatus = null;
        let newOrderStatus = null;
        let orderUpdateData = {};

        // Status ko Map Karein
        if (action === 'reached_pickup') {
            nextTaskStatus = 'arrived_pickup';
            newOrderStatus = 'RIDER_AT_PICKUP';
        
        } else if (action === 'picked_up') {
            nextTaskStatus = 'picked_up';
            newOrderStatus = (taskType === 'Delivery') ? 'OUT_FOR_DELIVERY' : null; 
        
        } else if (action === 'reached_drop') {
            nextTaskStatus = 'arrived_drop';
            newOrderStatus = (taskType === 'Pickup') ? 'ARRIVED_AT_STORE' : 'ARRIVED_AT_CUSTOMER';
        
        } else if (action === 'delivered' || action === 'delivered_cod') {
            nextTaskStatus = 'completed';
            if (taskType === 'Pickup') {
                newOrderStatus = 'PICKUP_DONE';
                orderUpdateData.assignedRiderId = null;
                orderUpdateData.assignedRiderName = null;
            } else {
                newOrderStatus = 'DELIVERED';
                orderUpdateData.completedAt = Timestamp.now();
                orderUpdateData.assignedRiderId = null;
                orderUpdateData.assignedRiderName = null;
            }
        }

        // Batch Write ka istemal karein
        if (nextTaskStatus) {
            
            const batch = writeBatch(db);

            batch.update(taskDocRef, {
                status: nextTaskStatus,
                ...(nextTaskStatus === 'completed' && { completedAt: Timestamp.now() })
            });

            if (newOrderStatus) {
                batch.update(orderDocRef, {
                    status: newOrderStatus,
                    ...orderUpdateData
                });
                console.log(`HOME: Batch Update: Task -> ${nextTaskStatus}, Order -> ${newOrderStatus}`);
            } else {
                 console.log(`HOME: Batch Update: Task -> ${nextTaskStatus} (No Order Status Sync)`);
            }

            if (nextTaskStatus === 'completed') {
                
                batch.update(riderDocRef, { current_task: null });
                console.log("HOME: Cleared current_task for rider in batch.");

                let codAmountCollected = 0;
                if (action === 'delivered_cod' && taskType === 'Delivery' && !currentTaskData.isPaid) {
                    const amount = currentTaskData.total || 0;
                    if (amount > 0) {
                        batch.update(riderDocRef, { "account.cod_balance": increment(amount) });
                        codAmountCollected = amount;
                    }
                }
                
                await batch.commit();
                
                showTaskCompleteModal(action === 'delivered_cod', codAmountCollected);
                currentTaskRef = null;
                renderTaskUI(null); // 'No task' UI dikhayein

            } else {
                // Task complete nahi hua hai
                await batch.commit();
                
                // ✅✅✅ V25 FIX: UI UPDATE KARNE SE PEHLE BUTTON RESET KAREIN ✅✅✅
                console.log("HOME: Resetting button state before forcing UI update.");
                actionButton.disabled = false;
                spinner?.classList.add('d-none');
                
                console.log("HOME: Forcing local UI update.");
                currentTaskData.status = nextTaskStatus;
                renderTaskUI(currentTaskData); 
            }

        } else {
            console.warn("No status mapping for action:", action);
            actionButton.disabled = false;
            spinner?.classList.add('d-none');
        }

    } catch (err) {
        console.error(`HOME: Error performing action '${action}':`, err);
        alert("Error: Status update nahi ho paya. " + err.message);
        
        actionButton.disabled = false;
        spinner?.classList.add('d-none');
    }
}


// Is page ka main function
export function initHomePage() {
    console.log("HOME: Initializing Home Page (v24 - Immediate UI Update)");

    if (unSubRider) { console.log("HOME: Cleaning up old rider listener."); unSubRider(); unSubRider = null; }
    if (unSubTask) { console.log("HOME: Cleaning up old task listener."); unSubTask(); unSubTask = null; }

    try {
        cacheSelectors();
        setupEventListeners();
        const riderDocRef = doc(db, "riders", auth.currentUser.uid);
        console.log("HOME: Calling listenToLiveTask for rider:", auth.currentUser.uid);
        listenToLiveTask(riderDocRef);
    } catch (error) {
        console.error("HOME: Initialization failed:", error);
        const contentArea = document.getElementById('content-area');
        if(contentArea) {
             contentArea.innerHTML = `<div class="alert alert-danger m-3"><b>Error loading Home page:</b> ${error.message}</div>`;
        }
    }
}