(function () {
    const overlay = document.getElementById('appNotification');
    if (!overlay) return;

    const modal = overlay.querySelector('.app-notification-modal');
    const icon = overlay.querySelector('.app-notification-icon');
    const title = overlay.querySelector('.app-notification-title');
    const message = overlay.querySelector('.app-notification-message');
    const closeButton = overlay.querySelector('.app-notification-close');

    function closeNotification() {
        overlay.classList.remove('is-visible');
        document.body.classList.remove('app-modal-open');
    }

    window.showAppModal = function (text, type) {
        const isError = type === 'error';
        modal.classList.toggle('is-error', isError);
        icon.textContent = isError ? '!' : 'OK';
        title.textContent = isError ? 'Something went wrong' : 'Success';
        message.textContent = text || (isError ? 'Please try again.' : 'Your request was completed.');
        overlay.classList.add('is-visible');
        document.body.classList.add('app-modal-open');
        closeButton.focus();
    };

    closeButton.addEventListener('click', closeNotification);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeNotification();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && overlay.classList.contains('is-visible')) closeNotification();
    });
})();