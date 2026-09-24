(function () {
    const overlay = document.getElementById('appNotification');
    if (!overlay) return;

    const modal = overlay.querySelector('.app-notification-modal');
    const icon = overlay.querySelector('.app-notification-icon');
    const title = overlay.querySelector('.app-notification-title');
    const message = overlay.querySelector('.app-notification-message');
    const closeButton = overlay.querySelector('.app-notification-close');
    const cancelButton = overlay.querySelector('.app-notification-cancel');
    let confirmAction = null;
    let cancelAction = null;
    let closeAction = null;

    function closeNotification() {
        overlay.classList.remove('is-visible');
        document.body.classList.remove('app-modal-open');
        if (cancelButton) cancelButton.style.display = 'none';
        confirmAction = null;
        cancelAction = null;
        closeAction = null;
    }

    window.showAppModal = function (text, type, options = {}) {
        const isError = type === 'error';
        const isConfirm = Boolean(options.confirm);
        const showCancel = isConfirm || Boolean(options.showCancel);
        modal.classList.toggle('is-error', isError);
        icon.textContent = isError ? '!' : 'OK';
        title.textContent = isConfirm ? 'Confirm' : (isError ? '' : 'Success');
        message.textContent = text || (isError ? 'Please try again.' : 'Your request was completed.');
        if (cancelButton) {
            cancelButton.style.display = showCancel ? 'inline-flex' : 'none';
            cancelButton.textContent = options.cancelText || 'Cancel';
        }
        confirmAction = isConfirm && typeof options.onConfirm === 'function' ? options.onConfirm : null;
        cancelAction = isConfirm && typeof options.onCancel === 'function' ? options.onCancel : null;
        closeAction = !isConfirm && typeof options.onClose === 'function' ? options.onClose : null;
        overlay.classList.add('is-visible');
        document.body.classList.add('app-modal-open');
        closeButton.focus();
    };

    window.showConfirmationModal = function (text, onConfirm, onCancel) {
        window.showAppModal(text, 'warning', { confirm: true, onConfirm, onCancel });
    };

    closeButton.addEventListener('click', () => {
        const action = confirmAction || closeAction;
        closeNotification();
        if (action) action();
    });
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            const action = cancelAction;
            closeNotification();
            if (action) action();
        });
    }
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeNotification();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && overlay.classList.contains('is-visible')) closeNotification();
    });

    document.addEventListener('DOMContentLoaded', () => {
        const sessionMessage = document.querySelector('[data-session-message]');
        if (sessionMessage) {
            window.showAppModal(sessionMessage.dataset.sessionMessage, sessionMessage.dataset.type || 'error');
        }
    });
})();