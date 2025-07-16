// Helper function to read file as Data URL
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Helper function to save files to disk
async function saveFile(file, folder, filename) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    formData.append('filename', filename);

    // For both PDFs and images, we'll store them as base64 data URLs
    const dataUrl = await readFileAsDataURL(file);
    localStorage.setItem(`uploads/${folder}/${filename}`, dataUrl);
}

// Helper function to get file URL from localStorage
function getFileUrl(path) {
    if (!path) return 'https://via.placeholder.com/300x400?text=No+Image';
    
    // Get the data URL from localStorage
    const storedData = localStorage.getItem(path);
    if (storedData) {
        return storedData;
    }
    
    return 'https://via.placeholder.com/300x400?text=No+Image';
}

// Book data (replace with your backend API)
let books = JSON.parse(localStorage.getItem('books') || '[]');

// Function to save books to localStorage
function saveBooks() {
    localStorage.setItem('books', JSON.stringify(books));
}

// Initialize admin panel
function initializeAdminPanel() {
    // Check if we're on the admin page
    const isAdminPage = document.querySelector('.navbar-text')?.textContent.trim() === 'Admin Panel';
    if (!isAdminPage) return;

    // Check if user is authenticated
    if (!sessionStorage.getItem('adminAuthenticated')) {
        // Redirect to login page if not authenticated
        window.location.href = 'login.html';
        return;
    }

    // Load books list if the table exists
    const booksTable = document.getElementById('books-list');
    if (booksTable) {
        loadBooksList();
    }

    // Setup form handlers if the form exists
    const bookForm = document.getElementById('book-form');
    if (bookForm) {
        setupFormHandlers();
    }

    // Add logout button to navigation
    const nav = document.querySelector('.navbar-text');
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn btn-outline-light ms-3';
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
    logoutBtn.addEventListener('click', function() {
        sessionStorage.removeItem('adminAuthenticated');
        window.location.href = 'login.html';
    });
    nav.appendChild(logoutBtn);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeAdminPanel);

// Load books list in admin panel
function loadBooksList() {
    debugStorage(); // Add this line at the start of the function

    const tbody = document.getElementById('books-list');
    tbody.innerHTML = '';

    books.forEach(book => {
        const tr = document.createElement('tr');
        const coverData = localStorage.getItem(book.cover);
        tr.innerHTML = `
            <td>
                <img src="${coverData || 'https://via.placeholder.com/300x400?text=No+Image'}" 
                     alt="${book.title}" 
                     style="width: 50px; height: 50px; object-fit: cover;">
            </td>
            <td>${book.title}</td>
            <td>${book.author}</td>
            <td>${book.category}</td>
            <td>
                <span class="badge bg-${getStatusBadgeColor(book.status)}">${book.status}</span>
            </td>
            <td>
                <button class="btn btn-sm btn-primary me-2" onclick="editBook(${book.id})" data-bs-toggle="tooltip" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="showDeleteConfirmation(${book.id})" data-bs-toggle="tooltip" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Initialize tooltips
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach(tooltip => new bootstrap.Tooltip(tooltip));
}

// Get status badge color
function getStatusBadgeColor(status) {
    switch(status) {
        case 'active': return 'success';
        case 'draft': return 'warning';
        case 'archived': return 'secondary';
        default: return 'primary';
    }
}

// Setup form handlers
function setupFormHandlers() {
    const bookForm = document.getElementById('book-form');
    const bookCover = document.getElementById('book-cover');
    const coverPreview = document.getElementById('cover-preview');
    const submitButton = document.querySelector('button[type="submit"][form="book-form"]');
    
    if (!bookForm || !bookCover || !coverPreview || !submitButton) {
        console.error('Required form elements not found:', {
            form: !!bookForm,
            cover: !!bookCover,
            preview: !!coverPreview,
            submit: !!submitButton
        });
        return;
    }
    
    bookForm.addEventListener('submit', handleBookSubmit);

    bookCover.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (file) {
            try {
                // Convert to data URL for preview
                const dataUrl = await readFileAsDataURL(file);
                if (coverPreview) {  // Double-check element still exists
                    coverPreview.innerHTML = `
                        <img src="${dataUrl}" alt="Cover preview" 
                             style="max-width: 200px; max-height: 200px;">
                    `;
                }
            } catch (error) {
                console.error('Error creating preview:', error);
                coverPreview.innerHTML = '<div class="alert alert-danger">Error loading preview</div>';
            }
        }
    });
}

// Handle book form submission
async function handleBookSubmit(e) {
    e.preventDefault();
    
    // Find the submit button - it might be outside the form
    const submitButton = document.querySelector('button[type="submit"][form="book-form"]') || 
                        e.target.querySelector('button[type="submit"]');
    
    if (!submitButton) {
        console.error('Submit button not found');
        return;
    }
    
    try {
        // Show loading state
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        submitButton.disabled = true;

        // Get form data
        const bookId = document.getElementById('book-id').value;
        const isEdit = bookId !== '';
        
        const formData = new FormData();
        const title = document.getElementById('book-title').value;
        const author = document.getElementById('book-author').value;
        const category = document.getElementById('book-category').value;
        const description = document.getElementById('book-description').value;
        const status = document.getElementById('book-status').value;

        formData.append('title', title);
        formData.append('author', author);
        formData.append('category', category);
        formData.append('description', description);
        formData.append('status', status);

        const coverFile = document.getElementById('book-cover').files[0];
        const pdfFile = document.getElementById('book-pdf').files[0];

        // Handle cover file
        let coverUrl = '';
        if (coverFile) {
            formData.append('cover', coverFile);
            const coverFileName = `cover_${Date.now()}_${coverFile.name}`;
            await saveFile(coverFile, 'covers', coverFileName);
            coverUrl = `uploads/covers/${coverFileName}`;
        }

        // Handle PDF file
        let pdfUrl = '';
        if (pdfFile) {
            formData.append('pdf', pdfFile);
            const pdfFileName = `pdf_${Date.now()}_${pdfFile.name}`;
            await saveFile(pdfFile, 'pdfs', pdfFileName);
            pdfUrl = `uploads/pdfs/${pdfFileName}`;
        }

        // Simulate API call
        await simulateApiCall(formData, isEdit, bookId);

        // Update local data
        const bookData = {
            id: isEdit ? parseInt(bookId) : (books.length > 0 ? Math.max(...books.map(b => b.id)) + 1 : 1),
            title: title,
            author: author,
            category: category,
            description: description,
            status: status,
            cover: coverUrl || (isEdit ? books.find(b => b.id === parseInt(bookId))?.cover : ''),
            pdfUrl: pdfUrl || (isEdit ? books.find(b => b.id === parseInt(bookId))?.pdfUrl : '')
        };

        if (isEdit) {
            const index = books.findIndex(b => b.id === parseInt(bookId));
            if (index !== -1) {
                books[index] = { ...books[index], ...bookData };
            }
        } else {
            books.push(bookData);
        }

        // Save changes to localStorage
        saveBooks();

        // Reset form and refresh list
        resetForm();
        loadBooksList();
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('bookModal'));
        modal.hide();

        showAlert(isEdit ? 'Book updated successfully!' : 'Book added successfully!', 'success');
    } catch (error) {
        showAlert('Error: ' + error.message, 'danger');
    } finally {
        // Restore button state
        submitButton.innerHTML = 'Save Book';
        submitButton.disabled = false;
    }
}

// Edit book
function editBook(bookId) {
    const book = books.find(b => b.id === bookId);
    if (book) {
        // Set form title
        const modalTitle = document.querySelector('#bookModal .modal-title');
        modalTitle.textContent = 'Edit Book';

        // Fill form with book data
        document.getElementById('book-id').value = book.id;
        document.getElementById('book-title').value = book.title;
        document.getElementById('book-author').value = book.author;
        document.getElementById('book-category').value = book.category;
        document.getElementById('book-description').value = book.description || '';
        document.getElementById('book-status').value = book.status;

        // Show current cover
        const coverPreview = document.getElementById('cover-preview');
        if (book.cover) {
            const coverData = localStorage.getItem(book.cover);
            if (coverData) {
                coverPreview.innerHTML = `
                    <img src="${coverData}" alt="Current cover" 
                         style="max-width: 200px; max-height: 200px;">
                `;
            }
        }

        // Show current PDF filename
        const currentPdf = document.getElementById('current-pdf');
        if (book.pdfUrl) {
            currentPdf.innerHTML = `
                <small class="text-muted">Current file: ${book.pdfUrl.split('/').pop()}</small>
            `;
        }

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('bookModal'));
        modal.show();
    }
}

// Show delete confirmation
function showDeleteConfirmation(bookId) {
    const book = books.find(b => b.id === bookId);
    if (book) {
        document.getElementById('delete-book-title').textContent = book.title;
        
        const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
        const confirmButton = document.getElementById('confirm-delete');
        
        // Remove existing event listeners
        const newConfirmButton = confirmButton.cloneNode(true);
        confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);
        
        // Add new event listener
        newConfirmButton.addEventListener('click', () => deleteBook(bookId));
        
        modal.show();
    }
}

// Delete book
async function deleteBook(bookId) {
    try {
        // Simulate API call
        await simulateApiCall({ id: bookId }, false, bookId, 'DELETE');

        // Remove from local array
        books = books.filter(b => b.id !== bookId);
        // Save changes to localStorage
        saveBooks();
        loadBooksList();

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
        modal.hide();

        showAlert('Book deleted successfully!', 'success');
    } catch (error) {
        showAlert('Error: ' + error.message, 'danger');
    }
}

// Reset form
function resetForm() {
    document.getElementById('book-form').reset();
    document.getElementById('book-id').value = '';
    document.getElementById('cover-preview').innerHTML = '';
    document.getElementById('current-pdf').innerHTML = '';
    document.querySelector('#bookModal .modal-title').textContent = 'Add New Book';
}

// Show alert
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Find the main content container in the admin panel
    const container = document.querySelector('#books')?.closest('.container') || 
                     document.querySelector('.tab-content')?.closest('.container') ||
                     document.querySelector('.container');
                     
    if (container) {
        container.insertAdjacentElement('afterbegin', alertDiv);
        // Auto dismiss after 3 seconds
        setTimeout(() => {
            alertDiv.remove();
        }, 3000);
    } else {
        // Fallback to console if no container is found
        console.log(message);
    }
}

// Debug function to check localStorage data
function debugStorage() {
    console.log('=== DEBUG: LocalStorage Contents ===');
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        console.log(`Key: ${key}`);
        if (key.includes('uploads/covers/')) {
            console.log('Cover data exists');
        }
    }
    console.log('=== End Debug ===');
}

// Simulate API call
function simulateApiCall(data, isEdit, bookId, method = 'POST') {
    return new Promise((resolve, reject) => {
        // Simulate network delay
        setTimeout(() => {
            // Simulate success
            resolve({ success: true });
            
            // Or simulate error
            // reject(new Error('Network error'));
        }, 1000);
    });
}
