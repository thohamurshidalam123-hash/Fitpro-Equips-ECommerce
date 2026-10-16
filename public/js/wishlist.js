(function () {
	const cards = () => Array.from(document.querySelectorAll('[data-wishlist-card]:not(.is-removed)'));
	const countElement = document.querySelector('[data-wishlist-count]');
	const emptyMessage = document.querySelector('.wishlist-empty');
	const variantPicker = document.querySelector('[data-variant-picker]');
	const variantOptions = document.querySelector('[data-variant-options]');
	const confirmVariantButton = document.querySelector('[data-confirm-variant-add]');
	const closeVariantButton = document.querySelector('[data-close-variant-picker]');
	let totalItemCount = Number(countElement?.dataset.totalItems ?? cards().length);
	let resolveVariantSelection = null;
	const showMessage = (message, type, options) => {
		if (typeof window.showAppModal === 'function') window.showAppModal(message, type, options);
	};

	function updateWishlistState() {
		if (countElement) countElement.textContent = `${totalItemCount} Item${totalItemCount === 1 ? '' : 's'}`;
		if (emptyMessage) emptyMessage.hidden = totalItemCount !== 0;
		if (typeof window.updateWishlistBadgeCount === 'function') window.updateWishlistBadgeCount(totalItemCount);
	}

	function chooseVariant(variants) {
		return new Promise(resolve => {
			resolveVariantSelection = resolve;
			confirmVariantButton.disabled = true;
			variantOptions.replaceChildren(...variants.map(variant => {
				const option = document.createElement('button');
				const available = Number(variant.stock) > 0 && variant.status !== 'Out of Stock';
				const name = document.createElement('strong');
				const details = document.createElement('span');
				option.type = 'button';
				option.className = 'wishlist-variant-option';
				option.dataset.variantId = variant._id;
				option.disabled = !available;
				option.setAttribute('aria-pressed', 'false');
				name.textContent = variant.name || `${variant.weight}${variant.weightUnit || 'kg'}`;
				details.textContent = [variant.color, `₹${Number(variant.price || 0).toFixed(2)}`, `${variant.stock} left`].filter(Boolean).join(' · ');
				option.append(name, details);
				return option;
			}));
			variantPicker.hidden = false;
			closeVariantButton.focus();
		});
	}

	function finishVariantSelection(variantId = null) {
		variantPicker.hidden = true;
		const resolve = resolveVariantSelection;
		resolveVariantSelection = null;
		resolve?.(variantId);
	}

	async function removeFromWishlist(button) {
		const card = button.closest('[data-wishlist-card]');
		const productId = button.dataset.productId || card?.dataset.productId;
		if (!productId) return;
		button.disabled = true;

		try {
			const response = await fetch('/wishlist/remove', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ productId, variantId: button.dataset.variantId || null })
			});
			const result = await response.json();
			if (!response.ok || !result.success) {
				showMessage(result.message || 'Unable to remove product from wishlist.', 'error');
				return;
			}
			cards().filter(item => item.dataset.productId === productId).forEach(item => item.classList.add('is-removed'));
			totalItemCount = Number(result.count ?? Math.max(0, totalItemCount - 1));
			updateWishlistState();
			showMessage(result.message, 'success', { onClose: () => window.location.reload() });
		} catch (error) {
			showMessage('Unable to remove product from wishlist right now.', 'error');
		} finally {
			button.disabled = false;
		}
	}

	async function addToCart(button, variantId, showSuccess = true) {
		const card = button.closest('[data-wishlist-card]');
		const productId = button.dataset.productId;
		if (!productId || button.disabled) return false;
		button.disabled = true;

		try {
			const response = await fetch('/cart/add', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ productId, variantId, quantity: 1 })
			});
			const result = await response.json();
			if (!response.ok || !result.success) {
				showMessage(result.message || 'Unable to add product to cart.', 'error');
				return false;
			}
			if (typeof window.updateCartBadgeCount === 'function') window.updateCartBadgeCount(result.count);
			cards().filter(item => item.dataset.productId === productId).forEach(item => item.classList.add('is-removed'));
			totalItemCount = Number(result.wishlistCount ?? Math.max(0, totalItemCount - 1));
			updateWishlistState();
			if (showSuccess) showMessage(result.message || 'Product added to cart.', 'success', { onClose: () => window.location.reload() });
			return true;
		} catch (error) {
			showMessage('Unable to add product to cart right now.', 'error');
			return false;
		} finally {
			button.disabled = false;
		}
	}

	async function addWishlistCardToCart(button, showSuccess = true) {
		const variants = JSON.parse(decodeURIComponent(button.dataset.variants || '%5B%5D'));
		if (!variants.length) return addToCart(button, undefined, showSuccess);
		const variantId = await chooseVariant(variants);
		if (!variantId) return null;
		return addToCart(button, variantId, showSuccess);
	}

	variantOptions?.addEventListener('click', event => {
		const option = event.target.closest('.wishlist-variant-option');
		if (!option || option.disabled) return;
		variantOptions.querySelectorAll('.wishlist-variant-option').forEach(item => {
			item.classList.remove('selected');
			item.setAttribute('aria-pressed', 'false');
		});
		option.classList.add('selected');
		option.setAttribute('aria-pressed', 'true');
		confirmVariantButton.disabled = false;
	});

	confirmVariantButton?.addEventListener('click', () => {
		const selected = variantOptions.querySelector('.wishlist-variant-option.selected');
		if (selected && !selected.disabled) finishVariantSelection(selected.dataset.variantId);
	});

	closeVariantButton?.addEventListener('click', () => finishVariantSelection());
	variantPicker?.addEventListener('click', event => {
		if (event.target === variantPicker) finishVariantSelection();
	});
	document.addEventListener('keydown', event => {
		if (event.key === 'Escape' && variantPicker && !variantPicker.hidden) finishVariantSelection();
	});

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
				if (typeof window.updateWishlistBadgeCount === 'function') window.updateWishlistBadgeCount(result.count);
				cards().forEach(card => card.classList.add('is-removed'));
				totalItemCount = 0;
				updateWishlistState();
				window.location.reload();
			} catch (error) {
				showMessage('Unable to clear wishlist right now.', 'error');
			} finally {
				clearButton.disabled = false;
			}
			return;
		}

		const addButton = event.target.closest('[data-add-cart]');
		if (addButton) {
			await addWishlistCardToCart(addButton);
			return;
		}

		const addAllButton = event.target.closest('[data-add-all]');
		if (addAllButton) {
			addAllButton.disabled = true;
			let addedCount = 0;
			for (const button of cards().map(card => card.querySelector('[data-add-cart]'))) {
				if (!button || button.disabled || button.closest('.wishlist-card.is-removed')) continue;
				const added = await addWishlistCardToCart(button, false);
				if (added === null) break;
				if (added) addedCount++;
			}
			if (addedCount) showMessage(`${addedCount} product${addedCount === 1 ? '' : 's'} added to cart.`, 'success', { onClose: () => window.location.reload() });
			addAllButton.disabled = false;
		}
	});

	updateWishlistState();
}());