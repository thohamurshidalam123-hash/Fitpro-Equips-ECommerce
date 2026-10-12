(function () {
    const badges = document.querySelectorAll('[data-cart-count]');
    if (!badges.length) return;

    let hasLocalUpdate = false;
    const renderCartBadgeCount = count => {
        const quantity = Math.max(0, Number(count) || 0);
        badges.forEach(badge => { badge.textContent = String(quantity); });
    };

    window.updateCartBadgeCount = count => {
        hasLocalUpdate = true;
        renderCartBadgeCount(count);
    };

    fetch('/cart/count', { headers: { Accept: 'application/json' }, cache: 'no-store' })
        .then(response => response.ok ? response.json() : null)
        .then(result => {
            if (result && result.success && !hasLocalUpdate) renderCartBadgeCount(result.count);
        })
        .catch(() => {});
}());