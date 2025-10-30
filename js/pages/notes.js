// js/pages/notes.js (Updated for Modern UI)

import { db, auth } from '../firebase-config.js';
import { 
    collection, query, where, getDocs, doc, updateDoc, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let notesListContainer;
let noteModal, saveNoteBtn, noteTextarea, noteTaskId, noteModalTitle;
let modalInstance = null; // Bootstrap modal instance

// History ko render karein (Modern Card Design)
function renderHistory(tasks) {
    notesListContainer.innerHTML = ''; // Clear loader or previous list
    if (tasks.length === 0) {
        notesListContainer.innerHTML = `<div class="card shadow-sm border-0"><div class="card-body text-center text-muted p-5">No completed tasks found.</div></div>`;
        return;
    }

    tasks.forEach(task => {
        const item = document.createElement('div');
        item.className = 'card mb-3 shadow-sm border-0'; // Use card for each item
        
        const completedDate = task.completedAt?.toDate ? new Date(task.completedAt.toDate()).toLocaleString() : 'N/A';
        const noteExists = task.note && task.note.trim() !== '';

        item.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <h5 class="card-title mb-1">
                            ${task.customerName || 'N/A'} 
                            <small class="text-muted fw-normal">(#${task.id.substring(0,5)})</small>
                        </h5>
                        <small class="card-subtitle text-muted">Completed: ${completedDate}</small>
                    </div>
                    <button class="btn ${noteExists ? 'btn-outline-secondary' : 'btn-outline-primary'} btn-sm edit-note-btn flex-shrink-0 ms-2" 
                            data-id="${task.id}" 
                            data-note="${task.note || ''}"
                            style="line-height: 1;">
                        <i class="bi bi-pencil-fill me-1"></i> ${noteExists ? 'Edit Note' : 'Add Note'}
                    </button>
                </div>
                ${noteExists 
                    ? `<p class="card-text bg-light border rounded p-2 mb-0"><small><strong>Note:</strong> ${task.note}</small></p>` 
                    : '<p class="card-text text-muted mb-0"><small>No note added yet.</small></p>'
                }
            </div>
        `;
        notesListContainer.appendChild(item);
    });
}

// Modal ko kholein
function openNoteModal(taskId, currentNote) {
    noteTaskId.value = taskId;
    noteTextarea.value = currentNote;
    noteModalTitle.textContent = `Note for Order #${taskId.substring(0,5)}`;
    if(modalInstance) modalInstance.show(); 
}

// Note save karein (Added Spinner Logic)
async function saveNote() {
    const taskId = noteTaskId.value;
    const noteText = noteTextarea.value;
    if (!taskId) return;

    const spinner = saveNoteBtn.querySelector('.spinner-border');
    saveNoteBtn.disabled = true;
    spinner?.classList.remove('d-none');
    saveNoteBtn.childNodes[saveNoteBtn.childNodes.length - 1].textContent = ' Saving...'; // Update text

    try {
        const taskDocRef = doc(db, "tasks", taskId);
        await updateDoc(taskDocRef, { note: noteText });
        
        if(modalInstance) modalInstance.hide(); 
        initNotesPage(); // List ko refresh karein
        
    } catch (err) {
        console.error("Error saving note:", err);
        alert("Error: Could not save note.");
    } finally {
        saveNoteBtn.disabled = false;
        spinner?.classList.add('d-none');
         saveNoteBtn.childNodes[saveNoteBtn.childNodes.length - 1].textContent = ' Save Note'; // Restore text
    }
}

// Is page ka main function
export async function initNotesPage() {
    console.log("Notes Page Initialized (Modern)");
    
    // Elements ko cache karein
    notesListContainer = document.getElementById('notes-list-container');
    noteModal = document.getElementById('note-modal');
    saveNoteBtn = document.getElementById('save-note-btn');
    noteTextarea = document.getElementById('note-textarea');
    noteTaskId = document.getElementById('note-task-id');
    noteModalTitle = document.getElementById('note-modal-title');
    
    // Bootstrap Modal ko initialize karein
    if (noteModal && !modalInstance) {
        modalInstance = new bootstrap.Modal(noteModal);
    }

    // Event listeners
    saveNoteBtn.onclick = saveNote;
    notesListContainer.onclick = (e) => {
        const editButton = e.target.closest('.edit-note-btn');
        if (editButton) {
            const taskId = editButton.dataset.id;
            const currentNote = editButton.dataset.note;
            openNoteModal(taskId, currentNote);
        }
    };

    // --- Fetch History Data ---
    notesListContainer.innerHTML = `
        <div id="notes-loader" class="text-center p-5">
            <div class="spinner-border text-primary" role="status"></div>
            <p class="mt-2 text-muted">Loading history...</p>
        </div>`;
        
    try {
        const q = query(
            collection(db, "tasks"),
            where("riderId", "==", auth.currentUser.uid),
            where("status", "==", "completed"),
            orderBy("completedAt", "desc") // Sabse naya upar
        );
        
        const querySnapshot = await getDocs(q);
        const tasks = [];
        querySnapshot.forEach((doc) => {
            tasks.push({ id: doc.id, ...doc.data() });
        });
        
        renderHistory(tasks); // Render data

    } catch (err) {
        console.error("Error fetching history:", err);
        notesListContainer.innerHTML = `<div class="alert alert-danger">Error loading history.</div>`;
    }
}