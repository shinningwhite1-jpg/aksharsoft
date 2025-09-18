// Clothify Inventory Management Engine
// Version 1.3.0
// Smart inventory system with QR code tracking, bulk printing, and QR viewer modal. Removed bulk button from main view.

// QR Code Generation Library (Minimal QR Code Generator)
const QRCodeGenerator = {
    generateDataURL: function(text, size = 300) {
        return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
    }
};

// InventoryManager Class
class ClothifyInventoryManager {
    constructor() {
        this.storageKey = 'clothify_inventory_data';
        this.inventory = this.loadInventory();
    }

    loadInventory() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
    }

    saveInventory() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.inventory));
    }

    generateSKU(design, size, color) {
        const designCode = design.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
        const sizeCode = size.substring(0, 3).toUpperCase();
        const colorCode = color.substring(0, 3).toUpperCase();
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        return `${designCode}-${sizeCode}-${colorCode}-${random}`;
    }

    addProduct(design, size, color, stock, price) {
        const existingProduct = this.inventory.find(p =>
            p.design.toLowerCase() === design.toLowerCase() &&
            p.size === size &&
            p.color.toLowerCase() === color.toLowerCase()
        );

        if (existingProduct) {
            existingProduct.stock += parseInt(stock);
            this.saveInventory();
            return { type: 'restock', product: existingProduct };
        } else {
            const newProduct = {
                sku: this.generateSKU(design, size, color),
                design: design,
                size: size,
                color: color,
                stock: parseInt(stock),
                price: parseFloat(price),
                sold: 0,
                dateAdded: new Date().toISOString()
            };
            this.inventory.push(newProduct);
            this.saveInventory();
            return { type: 'new', product: newProduct };
        }
    }

    sellProduct(sku) {
        const product = this.inventory.find(p => p.sku === sku);
        if (product && product.stock > 0) {
            product.stock--;
            product.sold++;
            this.saveInventory();
            return { success: true, product: product };
        }
        return { success: false, product: product };
    }

    searchProducts(query) {
        const lowerQuery = query.toLowerCase();
        return this.inventory.filter(p =>
            p.design.toLowerCase().includes(lowerQuery) ||
            p.sku.toLowerCase().includes(lowerQuery)
        );
    }

    sortProducts(criteria) {
        const sorted = [...this.inventory];
        switch(criteria) {
            case 'design':
                return sorted.sort((a, b) => a.design.localeCompare(b.design));
            case 'stock':
                return sorted.sort((a, b) => b.stock - a.stock);
            case 'sku':
                return sorted.sort((a, b) => a.sku.localeCompare(b.sku));
            case 'sold':
                return sorted.sort((a, b) => b.sold - a.sold);
            default:
                return sorted;
        }
    }

    getAllProducts() {
        return this.inventory;
    }
}

// Sound Manager for audio feedback
class ClothifySoundManager {
    constructor() {
        this.audioContext = null;
    }

    initAudioContext() {
        if (!this.audioContext && (window.AudioContext || window.webkitAudioContext)) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playBeep(frequency, duration, volume = 0.3) {
        this.initAudioContext();
        if (!this.audioContext) return;

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration / 1000);
    }

    playSuccess() {
        this.playBeep(800, 100);
        setTimeout(() => this.playBeep(1000, 100), 150);
    }

    playError() {
        this.playBeep(400, 300);
    }
}


// QR Code Scanner Manager
class ClothifyQRScanner {
    constructor(inventoryManager, soundManager) {
        this.inventoryManager = inventoryManager;
        this.soundManager = soundManager;
        this.scanner = null;
        this.isScanning = false;
        this.scanCooldown = false;
    }

    start() {
        if (this.isScanning) return;

        this.scanner = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        this.scanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => this.onScanSuccess(decodedText),
            (errorMessage) => {} // Ignore errors silently
        ).then(() => {
            this.isScanning = true;
            document.getElementById('stop-scanner').style.display = 'block';
            this.updateStatus('Ready to scan...', 'ready');
        }).catch(err => {
            console.error(`Unable to start scanning: ${err}`);
            this.updateStatus('❌ Camera permission denied', 'error');
        });
    }

    stop() {
        if (this.scanner && this.isScanning) {
            this.scanner.stop().then(() => {
                this.isScanning = false;
                document.getElementById('stop-scanner').style.display = 'none';
                this.updateStatus('Scanner stopped', 'ready');
            }).catch(console.error);
        }
    }

    onScanSuccess(sku) {
        if (this.scanCooldown) return;

        const result = this.inventoryManager.sellProduct(sku);

        if (result.success) {
            this.soundManager.playSuccess();
            this.updateStatus(
                `✅ Sold 1 unit of ${result.product.design} (${result.product.stock} left)`,
                'success'
            );
            this.startCooldown(2000);

            if (document.getElementById('inventory-section').classList.contains('active')) {
                updateInventoryDisplay();
            }
        } else {
            this.soundManager.playError();
            if (result.product) {
                this.updateStatus(`❌ Out of stock: ${result.product.design}`, 'error');
            } else {
                this.updateStatus(`❌ SKU not found: ${sku}`, 'error');
            }
            this.startCooldown(1000);
        }
    }

    startCooldown(duration) {
        this.scanCooldown = true;
        let timeLeft = duration / 1000;
        this.updateStatus(`Cooldown... Next scan in ${timeLeft}s...`, 'ready');

        const countdownInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                 this.updateStatus(`Cooldown... Next scan in ${timeLeft}s...`, 'ready');
            } else {
                clearInterval(countdownInterval);
                this.scanCooldown = false;
                this.updateStatus('Ready to scan...', 'ready');
            }
        }, 1000);
    }

    updateStatus(message, type) {
        const statusElement = document.getElementById('scanner-status');
        statusElement.textContent = message;
        statusElement.className = `scanner-status ${type}`;
    }
}

// QR Bulk Page Generator Class
class ClothifyQRGenerator {
    constructor() {
        this.qrPerPage = 20;
    }
    generatePrintablePages(product, quantity) {
        const loadingOverlay = document.getElementById('loading-overlay');
        const loadingProgress = document.getElementById('loading-progress');
        loadingOverlay.classList.add('show');
        loadingProgress.textContent = `Preparing ${quantity} QR code(s)...`;
        let printContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Print QR Codes - ${product.sku}</title>
                <style>
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .page-break { page-break-before: always; }
                        .no-print { display: none; }
                    }
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; }
                    .page { width: 210mm; height: 297mm; padding: 10mm; box-sizing: border-box; margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(5, 1fr); gap: 5mm; }
                    .qr-item { text-align: center; border: 1px dashed #ccc; padding: 2mm; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
                    .qr-item img { width: 30mm; height: 30mm; }
                    .qr-item .sku { font-family: monospace; font-weight: bold; font-size: 8pt; margin-top: 2mm; word-break: break-all; }
                    .qr-item .details { font-size: 7pt; color: #555; }
                    .print-header { padding: 20px; text-align: center; background-color: #f3f4f6; }
                </style>
            </head>
            <body>
                <div class="print-header no-print">
                    <h1>Printing QR Code Labels</h1>
                    <p><strong>Product:</strong> ${product.design} (${product.size}/${product.color}) - ${product.sku}</p>
                    <p><strong>Press Ctrl+P or Cmd+P to print.</strong> For best results, enable "Background graphics" and set margins to "Default" in your browser's print settings.</p>
                </div>
        `;
        let qrCount = 0;
        while(qrCount < quantity) {
            printContent += `<div class="page">`;
            const itemsOnThisPage = Math.min(this.qrPerPage, quantity - qrCount);
            for (let i = 0; i < itemsOnThisPage; i++) {
                const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(product.sku)}`;
                printContent += `
                    <div class="qr-item">
                        <img src="${qrImageUrl}" alt="QR Code">
                        <div class="sku">${product.sku}</div>
                        <div class="details">${product.design}</div>
                        <div class="details">${product.size} / ${product.color}</div>
                    </div>
                `;
            }
            printContent += `</div>`;
            if(qrCount + itemsOnThisPage < quantity) {
                 printContent += `<div class="page-break"></div>`;
            }
            qrCount += itemsOnThisPage;
        }
        printContent += `</body></html>`;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        loadingOverlay.classList.remove('show');
    }
}


// Initialize Clothify managers
const clothifyInventory = new ClothifyInventoryManager();
const clothifySound = new ClothifySoundManager();
const clothifyScanner = new ClothifyQRScanner(clothifyInventory, clothifySound);
const clothifyQRGenerator = new ClothifyQRGenerator();

// Global variables
let currentModalProduct = null;

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(`${section}-section`).classList.add('active');
        if (section === 'scan') {
            clothifyScanner.start();
        } else {
            clothifyScanner.stop();
        }
        if (section === 'inventory') {
            updateInventoryDisplay();
        }
    });
});

// **MODIFIED** Inventory Display Functions
function updateInventoryDisplay(products = null) {
    const tbody = document.getElementById('inventory-tbody');
    const emptyState = document.getElementById('inventory-empty');
    const displayProducts = products || clothifyInventory.getAllProducts();

    if (displayProducts.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        document.querySelector('.table-wrapper').style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        document.querySelector('.table-wrapper').style.display = 'block';

        tbody.innerHTML = displayProducts.map(product => `
            <tr>
                <td style="font-family: monospace; font-size: 12px;">${product.sku}</td>
                <td><strong>${product.design}</strong></td>
                <td>${product.size}</td>
                <td>${product.color}</td>
                <td>
                    <span style="font-weight: bold; color: ${product.stock > 5 ? '#10B981' : product.stock > 0 ? '#F59E0B' : '#EF4444'};">
                        ${product.stock}
                    </span>
                </td>
                <td>${product.sold}</td>
                <td>
                    <div class="qr-actions">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${product.sku}"
                             class="qr-code-img"
                             alt="QR Code"
                             onclick="showQRModal('${product.sku}')"
                             title="Click to view QR code">
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

// QR Code Viewer Modal Functions
function showQRModal(sku) {
    const modal = document.getElementById('qr-viewer-modal');
    const img = document.getElementById('qr-viewer-img');
    const downloadBtn = document.getElementById('qr-viewer-download-btn');

    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(sku)}`;
    
    downloadBtn.onclick = () => downloadSingleQR(sku);

    modal.style.display = 'flex';
}

function hideQRModal() {
    const modal = document.getElementById('qr-viewer-modal');
    modal.style.display = 'none';
}

// Single QR download (called from modal)
function downloadSingleQR(sku) {
    const link = document.createElement('a');
    link.href = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(sku)}`;
    link.download = `Clothify_QR_${sku}.png`;
    link.click();
}

// QR Bulk Modal Functions
function openQRModal(sku) {
    const product = clothifyInventory.getAllProducts().find(p => p.sku === sku);
    if (!product) return;
    currentModalProduct = product;
    const modal = document.getElementById('qr-modal');
    const productInfo = document.getElementById('modal-product-info');
    const quantityInput = document.getElementById('qr-quantity');
    productInfo.textContent = `Product: ${product.design} (${product.size}/${product.color}) - SKU: ${product.sku}`;
    quantityInput.value = product.stock || 1;
    quantityInput.max = 500;
    updatePageCalculation();
    modal.classList.add('show');
}

function closeQRModal() {
    document.getElementById('qr-modal').classList.remove('show');
    currentModalProduct = null;
}

function updatePageCalculation() {
    const quantity = parseInt(document.getElementById('qr-quantity').value) || 0;
    const pages = Math.ceil(quantity / 20);
    const pageCalc = document.getElementById('page-calculation');
    if (quantity > 0) {
        pageCalc.textContent = `This will generate ${pages} page${pages > 1 ? 's' : ''} (${quantity} label${quantity > 1 ? 's' : ''})`;
    } else {
        pageCalc.textContent = 'Enter a quantity greater than 0.';
    }
}

// Main function to generate bulk QR labels
function generateBulkQR() {
    if (!currentModalProduct) return;
    const quantity = parseInt(document.getElementById('qr-quantity').value) || 0;
    if (quantity < 1) {
        alert('Please enter a valid quantity (minimum 1)');
        return;
    }
    if (quantity > 500) {
        alert('Maximum 500 QR codes at once for performance reasons. Please enter a smaller quantity.');
        return;
    }
    closeQRModal();
    clothifyQRGenerator.generatePrintablePages(currentModalProduct, quantity);
}

// Event Listeners
document.getElementById('search-input').addEventListener('input', (e) => {
    const filtered = clothifyInventory.searchProducts(e.target.value);
    updateInventoryDisplay(filtered);
});
document.getElementById('sort-select').addEventListener('change', (e) => {
    const sorted = clothifyInventory.sortProducts(e.target.value);
    updateInventoryDisplay(sorted);
});
document.getElementById('qr-quantity').addEventListener('input', updatePageCalculation);
document.getElementById('add-product-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const design = document.getElementById('design').value;
    const size = document.getElementById('size').value;
    const color = document.getElementById('color').value;
    const stock = document.getElementById('stock').value;
    const price = document.getElementById('price').value;
    const result = clothifyInventory.addProduct(design, size, color, stock, price);
    const successMessage = document.getElementById('add-success-message');
    const messageContent = result.type === 'new'
        ? `✅ New product added: ${result.product.design} (SKU: ${result.product.sku})`
        : `✅ Restocked: ${result.product.design} (+${stock} units, Total: ${result.product.stock})`;
    successMessage.innerHTML = `
        <div class="success-message-content">
            <div>
                <div>${messageContent}</div>
                <div style="margin-top: 10px;">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${result.product.sku}" style="background: white; padding: 5px; border-radius: 4px;" alt="QR Code">
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button class="btn-download-qr" onclick="downloadSingleQR('${result.product.sku}')">🖼️ Download QR</button>
                <button class="btn-download-qr" onclick="openQRModal('${result.product.sku}')">📄 Generate Labels</button>
            </div>
        </div>
    `;
    successMessage.classList.add('show');
    e.target.reset();
    setTimeout(() => successMessage.classList.remove('show'), 10000);
    updateInventoryDisplay();
});
document.getElementById('stop-scanner').addEventListener('click', () => {
    clothifyScanner.stop();
});
document.getElementById('qr-modal').addEventListener('click', (e) => {
    if (e.target.id === 'qr-modal') closeQRModal();
});
document.addEventListener('DOMContentLoaded', () => {
    updateInventoryDisplay();
    document.body.addEventListener('click', () => clothifySound.initAudioContext(), { once: true });
});
// Clothify System Info
console.log('%c🎽 Clothify Inventory System Loaded', 'color: #8B5CF6; font-size: 16px; font-weight: bold');
console.log('Version: 1.3.0 | Removed bulk button from inventory view.');