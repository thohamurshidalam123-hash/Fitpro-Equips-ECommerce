(function () {
    function showMessage(message, type) {
        if (typeof window.showAppModal === 'function') {
            window.showAppModal(message, type);
        }
    }

    document.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-wishlist-toggle]');
        if (!button || button.disabled) return;

        const productId = button.dataset.productId;
        if (!productId) return;
        button.disabled = true;

        try {
            const response = await fetch('/wishlist/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ productId })
            });
            const result = await response.json();

            if (response.status === 401) {
                showMessage(result.message || 'Please log in to use the wishlist.', 'error');
                return;
            }
            if (!response.ok || !result.success) {
                showMessage(result.message || 'Unable to update wishlist.', 'error');
                return;
            }

            const isAdded = result.action === 'added';
            if (typeof window.updateWishlistBadgeCount === 'function') window.updateWishlistBadgeCount(result.count);
            button.classList.toggle('is-wishlisted', isAdded);
            const heart = button.querySelector('[data-wishlist-heart]');
            if (heart) heart.textContent = isAdded ? '♥' : '♡';
            const label = button.querySelector('[data-wishlist-label]');
            if (label) label.textContent = isAdded ? ' Added to Wishlist' : ' Add to Wishlist';
            button.setAttribute('aria-pressed', String(isAdded));
            button.setAttribute('aria-label', `${isAdded ? 'Remove' : 'Add'} product ${isAdded ? 'from' : 'to'} wishlist`);
            showMessage(result.message, 'success');
        } catch (error) {
            showMessage('Unable to update wishlist right now.', 'error');
        } finally {
            button.disabled = false;
        }
    });
}());
