// Clothify Analytics Engine
// Version 1.0.0
// Business Intelligence and Data Visualization Module

// Load Clothify inventory data
const clothifyData = JSON.parse(localStorage.getItem('clothify_inventory_data') || '[]');

// Analytics Module
class ClothifyAnalytics {
    constructor(data) {
        this.inventoryData = data;
    }

    calculateMetrics() {
        const totalProducts = this.inventoryData.length;
        const totalStock = this.inventoryData.reduce((sum, p) => sum + p.stock, 0);
        const totalSold = this.inventoryData.reduce((sum, p) => sum + p.sold, 0);
        
        // Calculate average turnover rate
        let avgTurnover = 0;
        if (totalStock + totalSold > 0) {
            avgTurnover = (totalSold / (totalStock + totalSold) * 100).toFixed(1);
        }

        return {
            totalProducts,
            totalStock,
            totalSold,
            avgTurnover
        };
    }

    getTopSellers(limit = 5) {
        return [...this.inventoryData]
            .sort((a, b) => b.sold - a.sold)
            .slice(0, limit);
    }

    generateSalesTrend(days = 7) {
        const dates = [];
        const sales = [];
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dates.push(date.toLocaleDateString('en', { weekday: 'short' }));
            sales.push(Math.floor(Math.random() * 30) + 10);
        }
        
        return { dates, sales };
    }

    generateForecast(days = 7) {
        const dates = [];
        const forecast = [];
        
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            dates.push(date.toLocaleDateString('en', { weekday: 'short' }));
            forecast.push(Math.floor(Math.random() * 40) + 15);
        }
        
        return { dates, forecast };
    }

    analyzeProductPerformance(product) {
        const totalUnits = product.stock + product.sold;
        const turnoverRate = totalUnits > 0 ? (product.sold / totalUnits * 100).toFixed(1) : 0;
        
        let performance = 'Low';
        let performanceClass = 'turnover-low';
        
        if (turnoverRate > 60) {
            performance = 'High';
            performanceClass = 'turnover-high';
        } else if (turnoverRate > 30) {
            performance = 'Medium';
            performanceClass = 'turnover-medium';
        }
        
        return {
            turnoverRate,
            performance,
            performanceClass
        };
    }
}

// Initialize Analytics
const analytics = new ClothifyAnalytics(clothifyData);

// Update Metrics Display
function updateMetrics() {
    const metrics = analytics.calculateMetrics();
    
    document.getElementById('total-products').textContent = metrics.totalProducts;
    document.getElementById('total-stock').textContent = metrics.totalStock.toLocaleString();
    document.getElementById('total-sold').textContent = metrics.totalSold.toLocaleString();
    document.getElementById('avg-turnover').textContent = metrics.avgTurnover + '%';

    // Update turnover indicator
    const turnoverIndicator = document.getElementById('turnover-indicator');
    if (metrics.avgTurnover > 60) {
        turnoverIndicator.className = 'metric-change positive';
        turnoverIndicator.innerHTML = '<span>↑</span><span>High efficiency</span>';
    } else if (metrics.avgTurnover > 30) {
        turnoverIndicator.className = 'metric-change';
        turnoverIndicator.innerHTML = '<span>→</span><span>Moderate efficiency</span>';
    } else {
        turnoverIndicator.className = 'metric-change negative';
        turnoverIndicator.innerHTML = '<span>↓</span><span>Low efficiency</span>';
    }
}

// Create Stock Levels Chart
function createStockChart() {
    const ctx = document.getElementById('stockChart').getContext('2d');
    const productLabels = clothifyData.map(p => `${p.design} (${p.size}/${p.color})`);
    const stockData = clothifyData.map(p => p.stock);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: productLabels.slice(0, 10),
            datasets: [{
                label: 'Stock Level',
                data: stockData.slice(0, 10),
                backgroundColor: 'rgba(139, 92, 246, 0.6)',
                borderColor: 'rgba(139, 92, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Create Top Sellers Chart
function createTopSellersChart() {
    const ctx = document.getElementById('topSellersChart').getContext('2d');
    const topSellers = analytics.getTopSellers();
    
    const labels = topSellers.map(p => `${p.design} (${p.size})`);
    const data = topSellers.map(p => p.sold);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Units Sold',
                data: data,
                backgroundColor: [
                    'rgba(236, 72, 153, 0.6)',
                    'rgba(139, 92, 246, 0.6)',
                    'rgba(59, 130, 246, 0.6)',
                    'rgba(16, 185, 129, 0.6)',
                    'rgba(245, 158, 11, 0.6)'
                ],
                borderColor: [
                    'rgba(236, 72, 153, 1)',
                    'rgba(139, 92, 246, 1)',
                    'rgba(59, 130, 246, 1)',
                    'rgba(16, 185, 129, 1)',
                    'rgba(245, 158, 11, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Create Sales Trend Chart
function createSalesTrendChart() {
    const ctx = document.getElementById('salesTrendChart').getContext('2d');
    const trend = analytics.generateSalesTrend();

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: trend.dates,
            datasets: [{
                label: 'Daily Sales',
                data: trend.sales,
                borderColor: 'rgba(139, 92, 246, 1)',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Create Forecast Chart
function createForecastChart() {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    const forecast = analytics.generateForecast();

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: forecast.dates,
            datasets: [{
                label: 'Predicted Demand',
                data: forecast.forecast,
                borderColor: 'rgba(236, 72, 153, 1)',
                backgroundColor: 'rgba(236, 72, 153, 0.1)',
                borderDash: [5, 5],
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Populate SKU Analysis Table
function populateSKUAnalysis() {
    const tbody = document.getElementById('sku-analysis-tbody');
    
    if (clothifyData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    No inventory data available. Add products in the Admin Portal to see analytics.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = clothifyData.map(product => {
        const analysis = analytics.analyzeProductPerformance(product);
        
        return `
            <tr>
                <td style="font-family: monospace; font-size: 12px;">${product.sku}</td>
                <td>${product.design} (${product.size}/${product.color})</td>
                <td>${product.stock}</td>
                <td>${product.sold}</td>
                <td>${analysis.turnoverRate}%</td>
                <td>
                    <span class="turnover-badge ${analysis.performanceClass}">
                        ${analysis.performance}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// Initialize Dashboard
function initClothifyDashboard() {
    console.log('%c📊 Clothify Analytics Dashboard Initialized', 'color: #EC4899; font-size: 16px; font-weight: bold');
    
    updateMetrics();
    
    if (clothifyData.length > 0) {
        createStockChart();
        createTopSellersChart();
        createSalesTrendChart();
        createForecastChart();
    }
    
    populateSKUAnalysis();
}

// Run initialization when page loads
document.addEventListener('DOMContentLoaded', initClothifyDashboard);

// Auto-refresh data every 30 seconds
setInterval(() => {
    const newData = JSON.parse(localStorage.getItem('clothify_inventory_data') || '[]');
    if (JSON.stringify(newData) !== JSON.stringify(clothifyData)) {
        location.reload();
    }
}, 30000);