(function () {
	const cards = () => Array.from(document.querySelectorAll('[data-wishlist-card]:not(.is-removed)'));
	const countElement = document.querySelector('[data-wishlist-count]');
	const emptyMessage = document.querySelector('.wishlist-empty');
	const showMessage = (message, type) => {
		if (typeof window.showAppModal === 'function') window.showAppModal(message, type);
	};

	function updateWishlistState() {
		const count = cards().length;
		if (countElement) countElement.textContent = `${count} Item${count === 1 ? '' : 's'}`;
		if (emptyMessage) emptyMessage.hidden = count !== 0;
	}

	async function removeFromWishlist(button) {
		const card = button.closest('[data-wishlist-card]');
		const productId = card?.dataset.productId;
		if (!productId) return;
		button.disabled = true;

		try {
			const response = await fetch('/wishlist/remove', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ productId })
			});
			const result = await response.json();
			if (!response.ok || !result.success) {
				showMessage(result.message || 'Unable to remove product from wishlist.', 'error');
				return;
			}
			card.classList.add('is-removed');
			updateWishlistState();
			showMessage(result.message, 'success');
		} catch (error) {
			showMessage('Unable to remove product from wishlist right now.', 'error');
		} finally {
			button.disabled = false;
		}
	}

	async function addToCart(button) {
		const card = button.closest('[data-wishlist-card]');
		const productId = button.dataset.productId;
		if (!productId || button.disabled) return false;
		button.disabled = true;

		try {
			const response = await fetch('/cart/add', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ productId, variantId: button.dataset.variantId, quantity: 1 })
			});
			const result = await response.json();
			if (!response.ok || !result.success) {
				showMessage(result.message || 'Unable to add product to cart.', 'error');
				return false;
			}
			card.classList.add('is-removed');
			updateWishlistState();
			return true;
		} catch (error) {
			showMessage('Unable to add product to cart right now.', 'error');
			return false;
		} finally {
			button.disabled = false;
		}
	}

	document.addEventListener('click', async (event) => {
		const removeButton = event.target.closest('[data-remove-wishlist]');
		if (removeButton) {
			await removeFromWishlist(removeButton);
			return;
		}

		const clearButton = event.target.closest('[data-clear-wishlist]');
		if (clearButton) {
			clearButton.disabled = true;
			try {
				const response = await fetch('/wishlist/clear', { method: 'POST' });
				const result = await response.json();
				if (!response.ok || !result.success) {
					showMessage(result.message || 'Unable to clear wishlist.', 'error');
					return;
				}
				cards().forEach(card => card.classList.add('is-removed'));
				updateWishlistState();
			} catch (error) {
				showMessage('Unable to clear wishlist right now.', 'error');
			} finally {
				clearButton.disabled = false;
			}
			return;
		}

		const addButton = event.target.closest('[data-add-cart]');
		if (addButton) {
			await addToCart(addButton);
			return;
		}

		const addAllButton = event.target.closest('[data-add-all]');
		if (addAllButton) {
			addAllButton.disabled = true;
			for (const button of cards().map(card => card.querySelector('[data-add-cart]'))) {
				if (button) await addToCart(button);
			}
			addAllButton.disabled = false;
		}
	});

	updateWishlistState();
}());