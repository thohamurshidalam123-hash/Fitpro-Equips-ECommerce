document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('brandModal');
    const form = document.getElementById('brandForm');
    const logoInput = document.getElementById('brandLogo');
    const featuredInput = document.getElementById('brandFeatured');
    const formError = document.getElementById('brandFormError');
    let logoProcessed = false;
    const clearErrors = () => { formError.textContent = ''; form.querySelectorAll('[data-error-for]').forEach(element => { element.textContent = ''; }); form.querySelectorAll('.has-error').forEach(element => element.classList.remove('has-error')); };
    const showErrors = errors => { clearErrors(); Object.entries(errors || {}).forEach(([field, message]) => { const element = form.querySelector(`[data-error-for="${field}"]`); const input = form.querySelector(`[name="${field}"]`); if (element) element.textContent = message; else formError.textContent = message; if (input) input.classList.add('has-error'); }); };
    const showBrandSuccessModal = (message, callback) => {
        if (typeof window.showAppModal === 'function') {
            window.showAppModal(message, 'success', { onClose: callback || (() => window.location.reload()) });
            return;
        }
        if (typeof callback === 'function') callback();
    };
    const validateBrandForm = () => {
        const errors = {};
        const nameInput = document.getElementById('brandName');
        const descriptionInput = document.getElementById('brandDescription');
        const categoryInput = document.getElementById('brandCategory');
        const name = nameInput.value.trim();
        const description = descriptionInput.value.trim();
        const categoryId = categoryInput.value.trim();
        if (!name) errors.name = 'Brand name is required';
        else if (!/^[A-Za-z0-9][A-Za-z0-9 &'().-]*$/.test(name)) errors.name = 'Brand name contains unsupported characters';
        if (!description) errors.description = 'Brand description is required';
        else if (description.length > 250) errors.description = 'Brand description cannot exceed 250 characters';
        if (!categoryId) errors.categoryId = 'Category is required';
        if (logoInput.files.length) {
            const file = logoInput.files[0];
            if (!['image/png', 'image/jpeg'].includes(file.type)) errors.logo = 'File not supported';
            else if (file.size > 5 * 1024 * 1024) errors.logo = 'Image cannot exceed 5 MB';
        }
        return errors;
    };
    const validateLogo = () => !logoInput.files.length || ['image/png', 'image/jpeg'].includes(logoInput.files[0].type) ? null : 'File not supported';
    document.getElementById('openEditBrand').addEventListener('click', () => { clearErrors(); modal.classList.remove('hidden'); });
    document.getElementById('closeBrandModal').addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('cancelBrand').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', event => { if (event.target === modal) modal.classList.add('hidden'); });
    logoInput.addEventListener('change', () => { logoProcessed = false; if (window.processImageInput) window.processImageInput(logoInput); const error = validateLogo(); const element = form.querySelector('[data-error-for="logo"]'); element.textContent = error || ''; logoInput.classList.toggle('has-error', Boolean(error)); });
    logoInput.addEventListener('imageprocessed', () => { logoProcessed = true; });
    form.addEventListener('submit', async event => { event.preventDefault(); clearErrors(); const validationErrors = validateBrandForm(); if (Object.keys(validationErrors).length) { showErrors(validationErrors); return; } const logoError = validateLogo(); if (logoError) { showErrors({ logo: logoError }); return; } if (logoInput.files.length && (!logoProcessed || logoInput.dataset.processing === 'true')) { showErrors({ logo: 'Please finish editing the selected logo' }); return; } const submit = form.querySelector('[type="submit"]'); submit.disabled = true; const data = new FormData(form); data.set('featured', String(featuredInput.checked)); try { const response = await fetch('/admin/brands/edit', { method: 'POST', body: data }); const result = await response.json(); if (!response.ok || !result.success) { showErrors(result.errors || { form: result.message || 'Unable to update brand.' }); return; } showBrandSuccessModal(result.message || 'Brand updated successfully.', () => window.location.reload()); } catch (error) { showErrors({ form: 'Unable to update brand. Please try again.' }); } finally { submit.disabled = false; } });
});
