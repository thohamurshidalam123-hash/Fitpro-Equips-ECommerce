(function () {
    const badges = document.querySelectorAll('[data-wishlist-badge]');
    if (!badges.length) return;

    let hasLocalUpdate = false;
    const renderWishlistBadgeCount = count => {
        const quantity = Math.max(0, Number(count) || 0);
        badges.forEach(badge => { badge.textContent = String(quantity); });
    };

    window.updateWishlistBadgeCount = count => {
        hasLocalUpdate = true;
        renderWishlistBadgeCount(count);
    };

    fetch('/wishlist/count', { headers: { Accept: 'application/json' }, cache: 'no-store' })
        .then(response => response.ok ? response.json() : null)
        .then(result => {
            if (result && result.success && !hasLocalUpdate) renderWishlistBadgeCount(result.count);
        })
        .catch(() => {});
}());