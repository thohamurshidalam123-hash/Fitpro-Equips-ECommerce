document.addEventListener('DOMContentLoaded', () => {
	// ============ SEARCH FUNCTIONALITY ============
	const searchInput = document.getElementById('searchInput');
	const searchForm = document.getElementById('searchForm');
	const clearSearchBtn = document.getElementById('clearSearchBtn');
	
	if (searchInput) {
		// Allow Enter key to submit search
		searchInput.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				searchForm.submit();
			}
		});
	}
	
	// Clear search functionality
	if (clearSearchBtn) {
		clearSearchBtn.addEventListener('click', (e) => {
			e.preventDefault();
			// Redirect to customers page without search parameter
			window.location.href = '/admin/customers';
		});
	}

	// ============ EDIT STATUS MODAL ============
	const editStatusModal = document.getElementById('editStatusModal');
	const editStatusBtns = document.querySelectorAll('.edit-status-btn');
	const closeEditStatusModalBtn = document.getElementById('closeEditStatusModal');
	const cancelEditStatusBtn = document.getElementById('cancelEditStatus');
	const confirmEditStatusBtn = document.getElementById('confirmEditStatus');
	
	let currentEditStatusUserId = null;

	// Open Edit Status Modal
	editStatusBtns.forEach(btn => {
		btn.addEventListener('click', (e) => {
			e.preventDefault();
			currentEditStatusUserId = btn.getAttribute('data-userid');
			const currentStatus = btn.getAttribute('data-currentstatus');
			
			// Set radio selection based on current status
			const statusRadios = editStatusModal.querySelectorAll('input[name="status"]');
			statusRadios.forEach(radio => {
				if (radio.value === currentStatus) {
					radio.checked = true;
				}
			});
			
			editStatusModal.classList.remove('hidden');
			document.body.style.overflow = 'hidden';
		});
	});

	// Close Edit Status Modal
	function closeEditStatusModal() {
		editStatusModal.classList.add('hidden');
		document.body.style.overflow = 'auto';
		currentEditStatusUserId = null;
	}

	closeEditStatusModalBtn.addEventListener('click', closeEditStatusModal);
	cancelEditStatusBtn.addEventListener('click', closeEditStatusModal);

	// Confirm Edit Status
	confirmEditStatusBtn.addEventListener('click', () => {
		const selectedStatus = editStatusModal.querySelector('input[name="status"]:checked')?.value;
		
		if (selectedStatus && currentEditStatusUserId) {
			// TODO: Implement fetch request here
			console.log(`Update user ${currentEditStatusUserId} status to ${selectedStatus}`);
			closeEditStatusModal();
			// Actual fetch call will be implemented later
		}
	});

	// Close modal on overlay click
	editStatusModal.addEventListener('click', (e) => {
		if (e.target === editStatusModal) {
			closeEditStatusModal();
		}
	});

	// ============ BLOCK/UNBLOCK MODAL ============
	const blockUnblockModal = document.getElementById('blockUnblockModal');
	const blockBtns = document.querySelectorAll('.block-btn');
	const closeBlockModalBtn = document.getElementById('closeBlockModal');
	const cancelBlockBtn = document.getElementById('cancelBlock');
	const confirmBlockBtn = document.getElementById('confirmBlock');
	const blockModalTitle = document.getElementById('blockModalTitle');
	const blockModalMessage = document.getElementById('blockModalMessage');
	
	let currentBlockUserId = null;
	let isCurrentlyBlocked = false;

	// Open Block/Unblock Modal
	blockBtns.forEach(btn => {
		btn.addEventListener('click', (e) => {
			e.preventDefault();
			currentBlockUserId = btn.getAttribute('data-userid');
			isCurrentlyBlocked = btn.getAttribute('data-isblocked') === 'true';
			
			// Update modal content based on current status
			if (isCurrentlyBlocked) {
				blockModalTitle.textContent = 'Unblock Customer';
				blockModalMessage.textContent = 'Are you sure you want to unblock this customer? They will regain access to their account.';
				confirmBlockBtn.textContent = 'Yes, Unblock';
				confirmBlockBtn.classList.remove('btn-danger');
				confirmBlockBtn.classList.add('btn-primary');
			} else {
				blockModalTitle.textContent = 'Block Customer';
				blockModalMessage.textContent = 'Are you sure you want to block this customer? They will lose access to their account.';
				confirmBlockBtn.textContent = 'Yes, Block';
				confirmBlockBtn.classList.remove('btn-primary');
				confirmBlockBtn.classList.add('btn-danger');
			}
			
			blockUnblockModal.classList.remove('hidden');
			document.body.style.overflow = 'hidden';
		});
	});

	// Close Block/Unblock Modal
	function closeBlockModal() {
		blockUnblockModal.classList.add('hidden');
		document.body.style.overflow = 'auto';
		currentBlockUserId = null;
		isCurrentlyBlocked = false;
	}

	closeBlockModalBtn.addEventListener('click', closeBlockModal);
	cancelBlockBtn.addEventListener('click', closeBlockModal);

	// Confirm Block/Unblock
	confirmBlockBtn.addEventListener('click', () => {
		if (currentBlockUserId) {
			const action = isCurrentlyBlocked ? 'unblock' : 'block';
			// TODO: Implement fetch request here
			console.log(`${action.charAt(0).toUpperCase() + action.slice(1)} user ${currentBlockUserId}`);
			closeBlockModal();
			// Actual fetch call will be implemented later
		}
	});

	// Close modal on overlay click
	blockUnblockModal.addEventListener('click', (e) => {
		if (e.target === blockUnblockModal) {
			closeBlockModal();
		}
	});

	// ============ CLOSE MODALS ON ESC KEY ============
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			if (!editStatusModal.classList.contains('hidden')) {
				closeEditStatusModal();
			}
			if (!blockUnblockModal.classList.contains('hidden')) {
				closeBlockModal();
			}
		}
	});
});