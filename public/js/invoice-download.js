(function () {
    const unpaidMessage = 'Invoice can be dowloaded only for paid orders';
    const paidStatuses = new Set(['paid', 'completed']);

    document.addEventListener('click', event => {
        const invoiceLink = event.target.closest('[data-invoice-payment-status]');
        if (!invoiceLink) return;

        const paymentStatus = String(invoiceLink.dataset.invoicePaymentStatus || '').trim().toLowerCase();
        if (paidStatuses.has(paymentStatus)) return;

        event.preventDefault();
        if (typeof window.showAppModal === 'function') {
            window.showAppModal(unpaidMessage, 'error');
        }
    });
}());