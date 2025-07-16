// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

// Book data from localStorage
let books = [];

// Load books from localStorage
function loadBooksFromStorage() {
    const storedBooks = localStorage.getItem('books');
    if (storedBooks) {
        books = JSON.parse(storedBooks);
        loadBooks();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', loadBooksFromStorage);

// Load books
function loadBooks() {
    const container = document.getElementById('books-container');
    container.innerHTML = '';

    books.forEach(book => {
        const bookCard = createBookCard(book);
        container.appendChild(bookCard);
    });
}

// Create book card
function createBookCard(book) {
    const div = document.createElement('div');
    div.className = 'col-md-4 col-sm-6';
    div.innerHTML = `
        <div class="card h-100 shadow-sm book-card mb-4">
            <img src="${book.cover || 'https://via.placeholder.com/300x400?text=No+Cover'}" 
                 alt="${book.title}" 
                 class="card-img-top" 
                 style="height: 300px; object-fit: cover;">
            <div class="card-body">
                <h5 class="card-title text-truncate">${book.title}</h5>
                <p class="card-text">By ${book.author}</p>
                <p class="card-text small text-muted">${book.description || 'No description available.'}</p>
                <div class="mt-auto">
                    <button class="btn btn-primary me-2" onclick="openBook('${book.pdfUrl}')" ${book.pdfUrl ? '' : 'disabled'}>
                        <i class="fas fa-book-open"></i> Read
                    </button>
                    <button class="btn btn-outline-primary" onclick="shareBook(${book.id})">
                        <i class="fas fa-share"></i> Share
                    </button>
                </div>
            </div>
        </div>
    `;
    return div;
}

// Global variables for PDF viewer
let currentPDF = null;
let currentPage = 1;
let currentScale = 1.5;

// Open PDF viewer
async function openBook(pdfPath) {
    if (!pdfPath) {
        alert('No PDF available for this book');
        return;
    }

    const modal = new bootstrap.Modal(document.getElementById('pdfViewerModal'));
    modal.show();

    try {
        // Get PDF data from localStorage
        const pdfData = localStorage.getItem(pdfPath);
        if (!pdfData) {
            throw new Error('PDF file not found');
        }

        // Show loading state
        const viewer = document.getElementById('pdf-viewer');
        viewer.innerHTML = `
            <div class="text-center my-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>`;

        // Get the base64 data from the data URL
        const base64Data = pdfData.split(',')[1];
        // Convert base64 to binary
        const binaryData = atob(base64Data);
        
        // Convert binary data to Uint8Array
        const uint8Array = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
            uint8Array[i] = binaryData.charCodeAt(i);
        }

        // Load the PDF
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        currentPDF = await loadingTask.promise;
        
        // Setup viewer container
        viewer.innerHTML = `
            <div class="pdf-controls bg-light p-2 sticky-top">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="prevPage()">
                            <i class="fas fa-chevron-left"></i> Previous
                        </button>
                        <button class="btn btn-primary" onclick="nextPage()">
                            Next <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                    <div class="d-flex align-items-center">
                        <span class="me-2">Page <span id="current-page">1</span> of ${currentPDF.numPages}</span>
                        <div class="btn-group ms-2">
                            <button class="btn btn-outline-primary" onclick="zoomOut()">
                                <i class="fas fa-search-minus"></i>
                            </button>
                            <button class="btn btn-outline-primary" onclick="zoomIn()">
                                <i class="fas fa-search-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div id="pdf-container" class="pdf-container mt-3"></div>`;

        // Render first page
        currentPage = 1;
        await renderPage(currentPage);

    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Error loading PDF file');
        // Clear the viewer in case of error
        const viewer = document.getElementById('pdf-viewer');
        viewer.innerHTML = '<div class="alert alert-danger">Failed to load PDF</div>';
    }
}

// Share book
function shareBook(bookId) {
    const book = books.find(b => b.id === bookId);
    if (book) {
        const shareUrl = `${window.location.origin}/book/${bookId}`;
        
        // Check if Web Share API is supported
        if (navigator.share) {
            navigator.share({
                title: book.title,
                text: `Check out "${book.title}" by ${book.author}`,
                url: shareUrl
            })
            .catch(error => console.log('Error sharing:', error));
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(shareUrl)
                .then(() => alert('Link copied to clipboard!'))
                .catch(error => console.log('Error copying:', error));
        }
    }
}

// Support form submission
document.getElementById('support-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    // Add your form submission logic here
    alert('Thank you for your message. We will get back to you soon!');
    this.reset();
});

// Helper function to get file URL
function getFileUrl(path) {
    const data = localStorage.getItem(path);
    return data || '';
}

// Helper function to get cover image URL with fallback
function getCoverUrl(book) {
    if (!book.cover) return 'https://via.placeholder.com/300x400?text=No+Cover';
    const coverData = getFileUrl(book.cover);
    return coverData || 'https://via.placeholder.com/300x400?text=No+Cover';
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    loadBooks();
});

// Function to render a specific page
async function renderPage(pageNum) {
    try {
        const page = await currentPDF.getPage(pageNum);
        const viewport = page.getViewport({ scale: currentScale });

        const container = document.getElementById('pdf-container');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Clear previous content
        container.innerHTML = '';
        container.appendChild(canvas);

        // Update current page display
        document.getElementById('current-page').textContent = pageNum;

        // Render PDF page
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        await page.render(renderContext);
    } catch (error) {
        console.error('Error rendering page:', error);
        document.getElementById('pdf-container').innerHTML = `
            <div class="alert alert-danger" role="alert">
                Error rendering page: ${error.message}
            </div>`;
    }
}

// Navigation functions
function nextPage() {
    if (currentPDF && currentPage < currentPDF.numPages) {
        currentPage++;
        renderPage(currentPage);
    }
}

function prevPage() {
    if (currentPDF && currentPage > 1) {
        currentPage--;
        renderPage(currentPage);
    }
}

// Zoom functions
function zoomIn() {
    currentScale = Math.min(currentScale * 1.2, 3.0); // Max zoom 3x
    renderPage(currentPage);
}

function zoomOut() {
    currentScale = Math.max(currentScale / 1.2, 0.5); // Min zoom 0.5x
    renderPage(currentPage);
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (!currentPDF) return;
    
    switch(e.key) {
        case 'ArrowRight':
        case ' ':
            nextPage();
            break;
        case 'ArrowLeft':
            prevPage();
            break;
        case '+':
            zoomIn();
            break;
        case '-':
            zoomOut();
            break;
    }
});
