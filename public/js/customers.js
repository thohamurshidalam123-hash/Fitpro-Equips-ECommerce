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
                confirmBlockBtn.classList.add('btn-primary'); // Assumes you have a .btn-primary class for green/blue
                confirmBlockBtn.style.backgroundColor = '#22c55e'; // Fallback to green
            } else {
                blockModalTitle.textContent = 'Block Customer';
                blockModalMessage.textContent = 'Are you sure you want to block this customer? They will lose access to their account.';
                confirmBlockBtn.textContent = 'Yes, Block';
                confirmBlockBtn.classList.remove('btn-primary');
                confirmBlockBtn.classList.add('btn-danger');
                confirmBlockBtn.style.backgroundColor = '#dc2626'; // Fallback to red
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

    // Confirm Block/Unblock via Fetch
    confirmBlockBtn.addEventListener('click', async () => {
        if (!currentBlockUserId) return;

        const originalText = confirmBlockBtn.textContent;
        confirmBlockBtn.textContent = 'Processing...';
        confirmBlockBtn.disabled = true;

        try {
            const response = await fetch(`/admin/toggle-block/${currentBlockUserId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.success) {
                window.location.reload(); // Reload to show the updated status badge
            } else {
                window.showAppModal(data.message || 'Something went wrong', 'error');
            }
        } catch (error) {
            console.error('Error toggling block status:', error);
            window.showAppModal('Failed to connect to the server.', 'error');
        } finally {
            confirmBlockBtn.textContent = originalText;
            confirmBlockBtn.disabled = false;
            closeBlockModal();
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