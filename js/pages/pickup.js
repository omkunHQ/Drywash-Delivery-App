// js/pages/pickup.js (COMPLETE CODE - Timeline Style, Call/Map/Cancel, Modal)

import { db, auth } from '../firebase-config.js';
import {
    collection, query, where, getDocs, doc, getDoc, updateDoc, Timestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- Global Variables ---
let taskListContainer;
let tasks = []; // Stores tasks in their current order
let cancelTaskModalInstance = null; // For Bootstrap Modal
let isDragging = false; // Flag to prevent clicks during drag

// --- Helper Functions ---

// Helper function to format Firestore Timestamp
function formatFirestoreTimestamp(timestamp) {
    if (!timestamp || !timestamp.toDate) {
        if (typeof timestamp === 'string') return timestamp; // Handle 'ASAP', 'Pending'
        return "Time not specified";
    }
    try {
        const date = timestamp.toDate();
        // Format: "Oct 30, 10:30 AM"
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
               date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (e) {
        console.error("Error formatting timestamp:", timestamp, e);
        return "Invalid Date";
    }
}

// Helper: Get Map URL
function getMapUrl(address, location) {
    let mapUrl = `http://maps.google.com/maps?q=${encodeURIComponent(address || '')}`; // Use correct domain
    if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
        mapUrl = `http://maps.google.com/maps?q=${location.latitude},${location.longitude}`; // Use correct domain
    }
    return mapUrl;
}

// --- Rendering Logic ---

// Renders tasks in the timeline format
function renderTasks(taskArray) {
    if (!taskListContainer) {
        console.error("renderTasks: taskListContainer not found!");
        return;
    }
    taskListContainer.innerHTML = ''; // Clear loader or previous list

    if (taskArray.length === 0) {
        taskListContainer.innerHTML = `<p class="text-muted text-center p-4">No pending tasks found.</p>`;
        return;
    }

    taskArray.forEach((task, index) => {
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item'; // Class styled by timeline CSS
        taskElement.setAttribute('draggable', true);
        taskElement.dataset.id = task.id;

        const taskType = task.type || 'Unknown';
        const scheduledTime = formatFirestoreTimestamp(task.scheduledAt || task.timeSlot || task.createdAt);
        const typeClass = taskType === 'Pickup' ? 'task-type-pickup' : 'task-type-delivery';
        const typeText = taskType.toUpperCase();

        let displayName = 'N/A';
        let displayAddress = 'N/A';
        let displayPhone = '';
        let displayLocation = null;

        if (taskType === 'Pickup') {
            displayName = task.pickupName || task.storeName || 'Pickup Location';
            displayAddress = task.pickupAddress || task.customerAddress || 'N/A';
            displayPhone = task.pickupPhone || task.storePhone || '';
            displayLocation = task.pickupLocation || task.customerLocation || null;
        } else { // Delivery or Unknown
            displayName = task.customerName || 'Customer';
            displayAddress = task.customerAddress || 'N/A';
            displayPhone = task.customerPhone || '';
            displayLocation = task.customerLocation || null;
        }

        taskElement.innerHTML = `
            <div class="task-item-top">
                <div class="task-item-number">${index + 1}</div>
                <div class="task-item-timeline-info">
                    <h6>
                        <span class="task-type-badge ${typeClass}">${typeText}</span>
                        <span>${displayName}</span>
                        <small class="text-muted fw-normal ms-1"> (#${task.id.substring(0,4)})</small>
                    </h6>
                    <p class="mb-1">
                        <i class="bi bi-geo-alt-fill me-1"></i> ${displayAddress.substring(0, 40)}${displayAddress.length > 40 ? '...' : ''}
                    </p>
                    <p class="mb-0">
                        <i class="bi bi-clock-fill me-1"></i> ${scheduledTime}
                    </p>
                </div>
            </div>

            <div class="task-item-actions">
                <div class="btn-group btn-group-sm">
                    <a href="${displayPhone ? `tel:${displayPhone}` : '#'}" class="btn btn-outline-primary call-btn ${!displayPhone ? 'disabled' : ''}" title="Call ${displayName}">
                        <i class="bi bi-telephone-fill"></i> Call
                    </a>
                    <a href="${getMapUrl(displayAddress, displayLocation)}" target="_blank" class="btn btn-outline-secondary map-btn" title="Open Map">
                        <i class="bi bi-geo-alt-fill"></i> Map
                    </a>
                    <button class="btn btn-outline-danger cancel-btn" data-id="${task.id}" data-bs-toggle="modal" data-bs-target="#cancelTaskModal" title="Cancel Task">
                         <i class="bi bi-x-circle-fill"></i> Cancel
                    </button>
                </div>
                <button class="btn btn-success btn-sm start-task-btn" data-id="${task.id}" style="line-height: 1; height: 38px; width: 80px;" title="Start this Task">
                     <i class="bi bi-play-fill"></i> Start
                </button>
            </div>
        `;
        taskListContainer.appendChild(taskElement);
    });
}

// --- Drag-and-Drop Logic ---
function initDragAndDrop() {
    if (!taskListContainer) return;
    let draggedItem = null;

    taskListContainer.addEventListener('dragstart', (e) => {
        const target = e.target.closest('.task-item');
        if (target) {
            isDragging = true; // Set drag flag
            draggedItem = target;
            setTimeout(() => { if(draggedItem) draggedItem.classList.add('dragging'); }, 0);
        }
    });

    taskListContainer.addEventListener('dragend', (e) => {
        isDragging = false; // Reset drag flag
        const target = e.target.closest('.task-item');
        if (target && draggedItem) {
            target.classList.remove('dragging');
            draggedItem = null;
            updateTaskOrder(); // Update order and re-render
        } else if (draggedItem) {
             draggedItem.classList.remove('dragging');
             draggedItem = null;
        }
    });

    taskListContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(taskListContainer, e.clientY);
        const currentItem = document.querySelector('.dragging');
        if (currentItem) {
            if (afterElement == null) { taskListContainer.appendChild(currentItem); }
            else { taskListContainer.insertBefore(currentItem, afterElement); }
        }
    });
}

// Helper for Drag and Drop
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; }
        else { return closest; }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Updates 'tasks' array order based on DOM and re-renders
function updateTaskOrder() {
    const orderedIds = [...taskListContainer.querySelectorAll('.task-item')].map(el => el.dataset.id);
    tasks.sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id));
    console.log("PICKUP: New task order (array updated):", tasks.map(t => t.id));
    renderTasks(tasks); // Re-render to update numbers and ensure consistency
}
// --- End Drag-and-Drop Logic ---


// --- Task Start Logic ---
async function startTask(taskId) {
    console.log(`PICKUP: Attempting to start task: ${taskId}`);
    const startButton = taskListContainer.querySelector(`.start-task-btn[data-id="${taskId}"]`);
    const riderId = auth.currentUser.uid;
    const riderDocRef = doc(db, "riders", riderId);

    try {
        const riderSnap = await getDoc(riderDocRef);
        if (!riderSnap.exists()) throw new Error("Rider document not found.");
        if (riderSnap.data().current_task) {
            alert("Error: You are already working on a task. Please complete it first.");
            if(startButton) { startButton.disabled = false; startButton.innerHTML = '<i class="bi bi-play-fill"></i> Start'; }
            return;
        }

        const taskDocRef = doc(db, "tasks", taskId);
        const taskSnap = await getDoc(taskDocRef);
        if (!taskSnap.exists() || taskSnap.data().riderId !== riderId || taskSnap.data().status !== 'assigned') {
            alert("Error: Task is no longer valid or assigned to you. Refreshing list...");
             initPickupPage(); // Reload the list automatically
            return;
        }

        // Assign task and update status
        await updateDoc(riderDocRef, { current_task: taskDocRef });
        await updateDoc(taskDocRef, { status: "in_progress" });

        window.location.hash = '#home'; // Navigate

    } catch (err) {
        console.error("PICKUP: Error starting task:", err);
        alert("Error: Could not start task. " + err.message);
         if(startButton) { startButton.disabled = false; startButton.innerHTML = '<i class="bi bi-play-fill"></i> Start'; }
    }
}
// --- End Task Start Logic ---


// --- Task Cancel Logic ---
async function handleCancelTask(taskId, reason, otherReason = '') {
    const confirmBtn = document.getElementById('confirm-cancel-btn');
    const spinner = confirmBtn?.querySelector('.spinner-border');

    // --- Validation ---
    if (!taskId || !reason) { /* ... Validation ... */ return; }
    if (reason === 'Other' && !otherReason.trim()) { /* ... Validation ... */ return; }
    // --- End Validation ---

    const finalReason = (reason === 'Other') ? otherReason.trim() : reason;
    console.log(`PICKUP: Attempting to cancel task: ${taskId}, Reason: ${finalReason}`);

    // --- Disable Button ---
    if(confirmBtn) confirmBtn.disabled = true;
    spinner?.classList.remove('d-none');

    const riderDocRef = doc(db, "riders", auth.currentUser.uid);
    const taskDocRef = doc(db, "tasks", taskId);

    try {
        // --- Firestore Operations ---
        const batch = writeBatch(db);
        batch.update(taskDocRef, { status: "CANCELLED_BY_RIDER", cancellationReason: finalReason, cancelledAt: Timestamp.now() });
        const riderSnap = await getDoc(riderDocRef);
        if (riderSnap.exists()) {
            const currentRoute = riderSnap.data()?.manual_route_order || [];
            const newRoute = currentRoute.filter(id => id !== taskId);
            batch.update(riderDocRef, { manual_route_order: newRoute });
        } else { console.warn("PICKUP: Rider document not found, cannot update route order."); }
        await batch.commit();
        console.log(`PICKUP: Task ${taskId} cancelled successfully in Firestore.`);

        // --- UI Updates (AFTER successful commit) ---

        // 1. Hide Modal (Try hiding first)
        if (cancelTaskModalInstance) {
             try { // Add try-catch around hide just in case
                 cancelTaskModalInstance.hide();
                 console.log("PICKUP: Cancel modal hide command sent.");

                 // === FORCE CLEANUP START ===
                 // Wait a short moment for Bootstrap's hide transition to start/finish
                 setTimeout(() => {
                     // Force remove backdrop
                     const backdrop = document.querySelector('.modal-backdrop');
                     if (backdrop) {
                         backdrop.remove();
                         console.log("PICKUP: Force removed modal backdrop.");
                     }
                     // Force remove body class
                     document.body.classList.remove('modal-open');
                     // Force remove body padding style if Bootstrap added it
                     document.body.style.paddingRight = '';
                     document.body.style.overflow = ''; // Restore scrolling
                     console.log("PICKUP: Force removed modal-open class from body.");
                 }, 500); // 500ms delay - adjust if needed
                 // === FORCE CLEANUP END ===

             } catch (hideError) {
                  console.error("PICKUP: Error during modal hide:", hideError);
                  // Attempt cleanup even if hide fails
                  const backdrop = document.querySelector('.modal-backdrop');
                  if (backdrop) backdrop.remove();
                  document.body.classList.remove('modal-open');
                  document.body.style.paddingRight = '';
                  document.body.style.overflow = '';
             }
        } else {
             console.warn("PICKUP: Modal instance not found, cannot hide modal.");
        }

        // 2. Remove task from local array
        tasks = tasks.filter(task => task.id !== taskId);
        console.log("PICKUP: Task removed from local 'tasks' array.");

        // 3. Re-render the task list
        renderTasks(tasks);
        console.log("PICKUP: Task list re-rendered.");

    } catch (err) {
        console.error("PICKUP: Error cancelling task:", err);
        alert("Error: Could not cancel task. " + err.message);
    } finally {
        // --- Re-enable Button ---
         if(confirmBtn) confirmBtn.disabled = false;
         spinner?.classList.add('d-none');
         console.log("PICKUP: Cancel button re-enabled.");
    }
}
// --- END Task Cancel Logic ---

// --- Event Handlers ---

// Handles clicks inside the task list container (Start, Call, Map, Cancel)
function handleTaskItemClick(e) {
    // Prevent click actions if a drag operation just finished
    if (isDragging) {
        console.log("PICKUP: Click ignored due to drag flag.");
        return;
    }

    const startButton = e.target.closest('.start-task-btn');
    const callButton = e.target.closest('.call-btn');
    const mapButton = e.target.closest('.map-btn');
    const cancelButton = e.target.closest('.cancel-btn');

    if (startButton) {
        const taskId = startButton.dataset.id;
        startButton.disabled = true;
        startButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Starting...';
        startTask(taskId);
    } else if (callButton && !callButton.classList.contains('disabled')) {
        console.log("PICKUP: Call button clicked, allowing default.");
        // Allow default 'tel:' action
    } else if (mapButton) {
        console.log("PICKUP: Map button clicked, allowing default.");
        // Allow default link action
    } else if (cancelButton) {
        const taskId = cancelButton.dataset.id;
        console.log("PICKUP: Cancel button clicked for task:", taskId);
        // Prepare and show the modal (modal is shown via data-bs attributes in HTML)
        const taskIdDisplay = document.getElementById('cancel-task-id-display');
        const taskIdInput = document.getElementById('cancel-task-id-input');
        const reasonSelect = document.getElementById('cancel-reason');
        const otherReasonText = document.getElementById('cancel-reason-other');

        if (taskIdDisplay && taskIdInput && reasonSelect && otherReasonText) {
            taskIdDisplay.textContent = taskId.substring(0, 5);
            taskIdInput.value = taskId;
            reasonSelect.value = ''; // Reset
            otherReasonText.value = ''; // Reset
            otherReasonText.style.display = 'none'; // Hide
        } else { console.error("PICKUP: Could not find cancel modal elements to prepare!"); }
    }
}

// Handler for the Confirm button inside the Cancel Modal
function handleConfirmCancelClick() {
    const taskId = document.getElementById('cancel-task-id-input')?.value;
    const reason = document.getElementById('cancel-reason')?.value;
    const otherReason = document.getElementById('cancel-reason-other')?.value;
    if (taskId && reason) {
        handleCancelTask(taskId, reason, otherReason);
    } else {
        console.error("Cannot confirm cancel: Task ID or Reason missing.");
        alert("Please select a reason.");
    }
}

// Handler for the Save Route button
async function handleSaveRouteClick() {
    const saveRouteBtn = document.getElementById('save-route-btn');
    if(!saveRouteBtn || saveRouteBtn.disabled) return; // Prevent multiple clicks

    const spinner = saveRouteBtn.querySelector('.spinner-border');
    saveRouteBtn.disabled = true;
    spinner?.classList.remove('d-none');
    saveRouteBtn.childNodes[saveRouteBtn.childNodes.length - 1].textContent = ' Saving...'; // Update text

    // Get order from the current 'tasks' array (already updated by drag/drop)
    const newOrderIds = tasks.map(t => t.id);
    const riderDocRef = doc(db, "riders", auth.currentUser.uid);

    try {
        await updateDoc(riderDocRef, {
            manual_route_order: newOrderIds
        });
        alert("Route Saved!");
    } catch (err) {
        console.error("PICKUP: Error saving route:", err);
        alert("Error saving route.");
    } finally {
        saveRouteBtn.disabled = false;
        spinner?.classList.add('d-none');
        saveRouteBtn.childNodes[saveRouteBtn.childNodes.length - 1].textContent = ' Save Route'; // Restore text
    }
}
// --- End Event Handlers ---


// --- Page Initialization ---
export async function initPickupPage() {
    console.log("PICKUP: Initializing Pickup Page (Timeline V3)");
    taskListContainer = document.getElementById('task-list-container');
    const saveRouteBtn = document.getElementById('save-route-btn');
    const pickupLoader = document.getElementById('pickup-loader');

    // Initialize Cancel Modal & Listeners (only once)
    const cancelModalEl = document.getElementById('cancelTaskModal');
    if (cancelModalEl && !cancelTaskModalInstance) { // Check if not already initialized
        try {
            cancelTaskModalInstance = new bootstrap.Modal(cancelModalEl);
            console.log("PICKUP: Cancel modal instance created.");

            const reasonSelect = document.getElementById('cancel-reason');
            const otherReasonText = document.getElementById('cancel-reason-other');
            if(reasonSelect && otherReasonText) {
                reasonSelect.removeEventListener('change', handleReasonChange); // Remove if exists
                reasonSelect.addEventListener('change', handleReasonChange); // Add listener
            }
            const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
            if(confirmCancelBtn) {
                confirmCancelBtn.removeEventListener('click', handleConfirmCancelClick); // Remove if exists
                confirmCancelBtn.addEventListener('click', handleConfirmCancelClick); // Add listener
            }

        } catch (modalError) {
            console.error("PICKUP: Error initializing cancel modal:", modalError);
            cancelTaskModalInstance = null;
        }
    } else if(!cancelModalEl) {
         console.error("PICKUP: Cancel Modal HTML Element (#cancelTaskModal) not found!");
         cancelTaskModalInstance = null;
    }

    // Check essential elements
    if (!taskListContainer || !saveRouteBtn || !pickupLoader) {
        console.error("PICKUP: Essential elements missing!");
        if(document.getElementById('content-area')) {
             document.getElementById('content-area').innerHTML = "<p class='alert alert-danger m-3'>Error loading pickup page elements.</p>";
        }
        return;
    }

    // Setup main click listener for task items
    taskListContainer.removeEventListener('click', handleTaskItemClick);
    taskListContainer.addEventListener('click', handleTaskItemClick);

    // Setup Save Route listener
    saveRouteBtn.removeEventListener('click', handleSaveRouteClick);
    saveRouteBtn.addEventListener('click', handleSaveRouteClick);

    // Fetch and render tasks
    try {
        pickupLoader.style.display = 'block';
        taskListContainer.innerHTML = ''; // Clear content

        const riderDocRef = doc(db, "riders", auth.currentUser.uid);
        const riderSnap = await getDoc(riderDocRef);
        if (!riderSnap.exists()) throw new Error("Rider data not found.");
        const manualRouteOrder = riderSnap.data()?.manual_route_order || [];

        // Fetch 'assigned' tasks
        const q = query(
            collection(db, "tasks"),
            where("riderId", "==", auth.currentUser.uid),
            where("status", "==", "assigned")
            // Optional: orderBy('scheduledAt', 'asc')
        );
        const querySnapshot = await getDocs(q);
        tasks = []; // Reset global tasks array
        querySnapshot.forEach((doc) => {
            tasks.push({ id: doc.id, ...doc.data() });
        });

        // Sort tasks based on manual order
        if (manualRouteOrder.length > 0 && tasks.length > 0) {
            tasks.sort((a, b) => {
                let indexA = manualRouteOrder.indexOf(a.id);
                let indexB = manualRouteOrder.indexOf(b.id);
                if (indexA === -1) indexA = Infinity;
                if (indexB === -1) indexB = Infinity;
                return indexA - indexB;
            });
        }

        pickupLoader.style.display = 'none'; // Hide loader
        renderTasks(tasks); // Render sorted tasks
        initDragAndDrop(); // Initialize drag and drop

    } catch (err) {
        console.error("PICKUP: Error fetching tasks:", err);
        pickupLoader.style.display = 'none';
        taskListContainer.innerHTML = `<p class="text-danger text-center">Error loading tasks: ${err.message}</p>`;
    }
}

// NAYA: Helper function for reason dropdown change
function handleReasonChange(){
     const reasonSelect = document.getElementById('cancel-reason');
     const otherReasonText = document.getElementById('cancel-reason-other');
     if(reasonSelect && otherReasonText) {
          otherReasonText.style.display = (reasonSelect.value === 'Other') ? 'block' : 'none';
     }
}
// --- End Initialization ---