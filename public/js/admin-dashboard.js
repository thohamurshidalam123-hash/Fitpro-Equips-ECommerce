// Admin Dashboard JavaScript

// Initialize Charts when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
	initRevenueChart();
	initCategoryChart();
});

// ============ REVENUE CHART ============
function initRevenueChart() {
	const ctx = document.getElementById('revenueChart');
	if (!ctx) return;

	const revenueChart = new Chart(ctx, {
		type: 'bar',
		data: {
			labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
			datasets: [{
				label: 'Revenue',
				data: [45000, 52000, 48000, 61000, 75000, 68000],
				backgroundColor: function(context) {
					const value = context.raw;
					const maxValue = 75000;
					// Highlight the highest value (May) in bright blue
					if (value === maxValue) {
						return '#1a73e8';
					}
					return '#e8ecf1';
				},
				borderRadius: 6,
				borderSkipped: false,
				barThickness: 32
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: false
				},
				tooltip: {
					backgroundColor: 'rgba(0, 0, 0, 0.8)',
					padding: 12,
					borderRadius: 6,
					titleFont: {
						size: 12,
						weight: 'bold'
					},
					bodyFont: {
						size: 12
					},
					callbacks: {
						label: function(context) {
							return '₹' + context.raw.toLocaleString('en-IN');
						}
					}
				}
			},
			scales: {
				y: {
					beginAtZero: true,
					max: 80000,
					ticks: {
						stepSize: 20000,
						callback: function(value) {
							if (value === 0) return '₹0';
							return '₹' + (value / 1000) + 'k';
						},
						font: {
							size: 11,
							color: '#999'
						}
					},
					grid: {
						color: '#f0f0f0',
						drawBorder: false
					}
				},
				x: {
					grid: {
						display: false,
						drawBorder: false
					},
					ticks: {
						font: {
							size: 11,
							color: '#999'
						}
					}
				}
			}
		}
	});

	return revenueChart;
}

// ============ CATEGORY CHART ============
function initCategoryChart() {
	const ctx = document.getElementById('categoryChart');
	if (!ctx) return;

	const categoryChart = new Chart(ctx, {
		type: 'doughnut',
		data: {
			labels: ['Strength', 'Nutrition', 'Accessories'],
			datasets: [{
				data: [45, 38, 18],
				backgroundColor: [
					'#1a73e8',
					'#34a853',
					'#fbbc04'
				],
				borderColor: 'white',
				borderWidth: 3,
				hoverOffset: 8
			}]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: false
				},
				tooltip: {
					backgroundColor: 'rgba(0, 0, 0, 0.8)',
					padding: 12,
					borderRadius: 6,
					callbacks: {
						label: function(context) {
							return context.label + ': ' + context.raw + '%';
						}
					}
				}
			}
		}
	});

	return categoryChart;
}

// ============ SIDEBAR NAVIGATION ============
document.querySelectorAll('.nav-item').forEach(item => {
	item.addEventListener('click', function(e) {
		// Remove active class from all items
		document.querySelectorAll('.nav-item').forEach(nav => {
			nav.classList.remove('active');
		});
		// Add active class to clicked item
		this.classList.add('active');
	});
});

// ============ ACTION BUTTONS ============
document.querySelectorAll('.action-btn').forEach(btn => {
	btn.addEventListener('click', function(e) {
		e.preventDefault();
		const orderId = this.closest('tr').querySelector('.order-id').textContent;
		console.log('Viewing order:', orderId);
		// Implement actual order view functionality here
		// window.location.href = '/admin/orders/' + orderId;
	});
});

// ============ FILTER FUNCTIONALITY ============
document.querySelectorAll('.filter-select').forEach(select => {
	select.addEventListener('change', function(e) {
		const period = this.value;
		console.log('Filter changed to:', period);
		// Implement actual filtering here
		// This would typically make an AJAX request to update the table
	});
});

// ============ NOTIFICATION BUTTON ============
document.querySelector('.notification-btn')?.addEventListener('click', function() {
	console.log('Notifications clicked');
	// Implement notification popup here
});

// ============ PROFILE BUTTON ============
document.querySelector('.profile-btn')?.addEventListener('click', function() {
	console.log('Settings clicked');
	// Implement settings/profile menu here
});

// ============ SMOOTH SCROLLING ============
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
	anchor.addEventListener('click', function(e) {
		e.preventDefault();
		const target = document.querySelector(this.getAttribute('href'));
		if (target) {
			target.scrollIntoView({ behavior: 'smooth' });
		}
	});
});

// ============ RESPONSIVE SIDEBAR ============
function handleResponsiveSidebar() {
	const sidebar = document.querySelector('.sidebar');
	const isMobile = window.innerWidth <= 1200;

	if (isMobile) {
		// Make sidebar scrollable on mobile
		if (!sidebar.classList.contains('mobile-mode')) {
			sidebar.classList.add('mobile-mode');
		}
	} else {
		sidebar.classList.remove('mobile-mode');
	}
}

window.addEventListener('resize', handleResponsiveSidebar);
handleResponsiveSidebar();

// ============ LOGOUT CONFIRMATION MODAL ============
let logoutUrl = null;

document.querySelector('.logout-btn')?.addEventListener('click', function(e) {
	e.preventDefault();
	logoutUrl = this.getAttribute('href');
	openLogoutModal();
});

function openLogoutModal() {
	const modal = document.getElementById('logoutModal');
	modal.classList.add('active');
	// Prevent body scrolling when modal is open
	document.body.style.overflow = 'hidden';
}

function closeLogoutModal() {
	const modal = document.getElementById('logoutModal');
	modal.classList.remove('active');
	// Restore body scrolling
	document.body.style.overflow = 'auto';
}

// Cancel button
document.getElementById('cancelLogout')?.addEventListener('click', function() {
	closeLogoutModal();
	logoutUrl = null;
});

// Close button (X)
document.querySelector('.modal-close')?.addEventListener('click', function() {
	closeLogoutModal();
	logoutUrl = null;
});

// Confirm button
document.getElementById('confirmLogout')?.addEventListener('click', function() {
	if (logoutUrl) {
		// Redirect to logout URL
		window.location.href = logoutUrl;
	} else {
		// Fallback to default logout route
		window.location.href = '/admin/logout';
	}
});

// Close modal on ESC key
document.addEventListener('keydown', function(e) {
	if (e.key === 'Escape') {
		const modal = document.getElementById('logoutModal');
		if (modal?.classList.contains('active')) {
			closeLogoutModal();
			logoutUrl = null;
		}
	}
});

// Close modal on overlay click
document.getElementById('logoutModal')?.addEventListener('click', function(e) {
	if (e.target === this) {
		closeLogoutModal();
		logoutUrl = null;
	}
});

// ============ TABLE ROW HOVER EFFECTS ============
document.querySelectorAll('.orders-table tbody tr').forEach(row => {
	row.addEventListener('mouseenter', function() {
		this.style.backgroundColor = '#fafafa';
	});
	row.addEventListener('mouseleave', function() {
		this.style.backgroundColor = '';
	});
});

// ============ STAT CARD ANIMATIONS ============
document.querySelectorAll('.stat-card').forEach((card, index) => {
	card.style.animationDelay = (index * 0.1) + 's';
});

// ============ AUTO-REFRESH DASHBOARD ============
// Uncomment to enable auto-refresh every 5 minutes
/*
setInterval(function() {
	location.reload();
}, 300000); // 5 minutes
*/

// ============ REAL-TIME UPDATES (WebSocket example) ============
// This is a placeholder for real-time updates using WebSocket
/*
const ws = new WebSocket('wss://your-server.com/admin/updates');

ws.onmessage = function(event) {
	const data = JSON.parse(event.data);
	
	// Update stat cards
	if (data.revenue) {
		updateStatCard('revenue', data.revenue);
	}
	if (data.orders) {
		updateStatCard('orders', data.orders);
	}
	
	// Update charts
	if (data.chartData) {
		updateRevenueChart(data.chartData);
	}
};

function updateStatCard(type, value) {
	// Implementation for updating stat cards
	console.log('Updated', type, 'to', value);
}
*/

// ============ PRINT FUNCTIONALITY ============
function printDashboard() {
	window.print();
}

// ============ EXPORT DATA ============
function exportData(format) {
	console.log('Exporting data as:', format);
	// Implement export functionality for CSV, PDF, etc.
	if (format === 'csv') {
		exportAsCSV();
	} else if (format === 'pdf') {
		exportAsPDF();
	}
}

function exportAsCSV() {
	// Implementation for CSV export
	console.log('Exporting as CSV...');
}

function exportAsPDF() {
	// Implementation for PDF export
	console.log('Exporting as PDF...');
}

// ============ SEARCH FUNCTIONALITY ============
function searchOrders(query) {
	const tableRows = document.querySelectorAll('.orders-table tbody tr');
	tableRows.forEach(row => {
		const text = row.textContent.toLowerCase();
		if (text.includes(query.toLowerCase())) {
			row.style.display = '';
		} else {
			row.style.display = 'none';
		}
	});
}

// ============ SORT TABLE FUNCTIONALITY ============
document.querySelectorAll('.orders-table th').forEach(header => {
	header.style.cursor = 'pointer';
	header.addEventListener('click', function() {
		const table = this.closest('.orders-table');
		const headerIndex = Array.from(this.parentNode.children).indexOf(this);
		const isAscending = this.classList.toggle('ascending');

		const rows = Array.from(table.querySelectorAll('tbody tr'));
		rows.sort((a, b) => {
			const aValue = a.children[headerIndex].textContent;
			const bValue = b.children[headerIndex].textContent;

			if (isAscending) {
				return aValue.localeCompare(bValue, undefined, { numeric: true });
			} else {
				return bValue.localeCompare(aValue, undefined, { numeric: true });
			}
		});

		rows.forEach(row => table.querySelector('tbody').appendChild(row));
	});
});

// ============ PAGE LOAD ANIMATION ============
window.addEventListener('load', function() {
	document.body.classList.add('loaded');
	// Animate stat cards on load
	document.querySelectorAll('.stat-card').forEach(card => {
		card.style.opacity = '0';
		card.style.transform = 'translateY(20px)';
		setTimeout(() => {
			card.style.transition = 'all 0.5s ease';
			card.style.opacity = '1';
			card.style.transform = 'translateY(0)';
		}, 100);
	});
});

// ============ KEYBOARD SHORTCUTS ============
document.addEventListener('keydown', function(e) {
	// Alt + D: Go to Dashboard
	if (e.altKey && e.key === 'd') {
		window.location.href = '/admin/dashboard';
	}
	// Alt + O: Go to Orders
	if (e.altKey && e.key === 'o') {
		window.location.href = '/admin/orders';
	}
	// Alt + P: Go to Products
	if (e.altKey && e.key === 'p') {
		window.location.href = '/admin/products';
	}
});

console.log('Dashboard initialized successfully');
