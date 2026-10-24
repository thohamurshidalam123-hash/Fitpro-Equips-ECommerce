(function () {
    const modal = document.querySelector('[data-contact-modal]');
    if (!modal) return;

    const closeButton = modal.querySelector('[data-close-contact-modal]');
    const copyStatus = modal.querySelector('[data-contact-copy-status]');
    let lastTrigger = null;

    const closeModal = () => {
        modal.hidden = true;
        document.body.classList.remove('contact-modal-open');
        lastTrigger?.focus();
    };

    document.addEventListener('click', event => {
        const trigger = event.target.closest('[data-open-contact-modal]');
        if (trigger) {
            event.preventDefault();
            lastTrigger = trigger;
            modal.hidden = false;
            document.body.classList.add('contact-modal-open');
            closeButton.focus();
            return;
        }

        if (event.target.closest('[data-close-contact-modal]') || event.target === modal) {
            closeModal();
            return;
        }

        const copyButton = event.target.closest('[data-copy-contact]');
        if (!copyButton) return;

        const value = copyButton.dataset.copyContact;
        const name = copyButton.dataset.copyName;
        const copy = async () => {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
                return;
            }
            const temporaryInput = document.createElement('textarea');
            temporaryInput.value = value;
            temporaryInput.style.position = 'fixed';
            temporaryInput.style.opacity = '0';
            document.body.append(temporaryInput);
            temporaryInput.select();
            const succeeded = document.execCommand('copy');
            temporaryInput.remove();
            if (!succeeded) throw new Error('Copy command failed');
        };

        copy().then(() => {
            copyStatus.textContent = `${name} copied.`;
        }).catch(() => {
            copyStatus.textContent = `Unable to copy ${name.toLowerCase()}.`;
        });
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !modal.hidden) closeModal();
    });
})();