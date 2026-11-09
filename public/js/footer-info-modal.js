(function () {
    const modal = document.querySelector('[data-footer-info-modal]');
    if (!modal) return;

    const title = modal.querySelector('#footer-info-title');
    const subtitle = modal.querySelector('#footer-info-subtitle');
    const content = modal.querySelector('[data-footer-info-content]');
    const closeButton = modal.querySelector('[data-close-footer-info]');
    let lastTrigger = null;

    const closeModal = () => {
        modal.hidden = true;
        document.body.classList.remove('contact-modal-open');
        lastTrigger?.focus();
    };

    document.addEventListener('click', event => {
        const trigger = event.target.closest('[data-open-footer-info]');
        if (trigger) {
            const template = document.querySelector(`template[data-footer-info-template="${trigger.dataset.openFooterInfo}"]`);
            if (!template) return;

            event.preventDefault();
            lastTrigger = trigger;
            title.textContent = trigger.dataset.footerInfoTitle;
            subtitle.textContent = trigger.dataset.footerInfoSubtitle;
            content.replaceChildren(template.content.cloneNode(true));
            modal.hidden = false;
            document.body.classList.add('contact-modal-open');
            closeButton.focus();
            return;
        }

        if (event.target.closest('[data-close-footer-info]') || event.target === modal) closeModal();
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !modal.hidden) closeModal();
    });
})();
