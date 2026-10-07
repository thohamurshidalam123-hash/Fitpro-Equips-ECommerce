document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('brandModal');
    const form = document.getElementById('brandForm');
    const idInput = document.getElementById('brandId');
    const nameInput = document.getElementById('brandName');
    const descriptionInput = document.getElementById('brandDescription');
    const categoryInput = document.getElementById('brandCategory');
    const offerInput = document.getElementById('brandOffer');
    const featuredInput = document.getElementById('brandFeatured');
    const logoInput = document.getElementById('brandLogo');
    const title = document.getElementById('brandModalTitle');
    const formError = document.getElementById('brandFormError');
    const clearErrors = () => { window.clearInlineFieldErrors(form); formError.textContent = ''; form.querySelectorAll('[data-error-for]').forEach(element => { element.textContent = ''; }); form.querySelectorAll('.has-error').forEach(element => element.classList.remove('has-error')); };
    const showErrors = errors => { clearErrors(); window.showInlineFieldErrors(form, errors); };
    const showBrandSuccessModal = (message, callback) => {
        if (typeof window.showAppModal === 'function') {
            window.showAppModal(message, 'success', { onClose: callback || (() => window.location.reload()) });
            return;
        }
        if (typeof callback === 'function') callback();
    };
    const validateBrandForm = () => {
        const errors = {};
        const name = nameInput.value.trim();
        const description = descriptionInput.value.trim();
        const categoryId = categoryInput.value.trim();
        if (!name) errors.name = 'Brand name is required';
        else if (!/^[A-Za-z0-9][A-Za-z0-9 &'().-]*$/.test(name)) errors.name = 'Brand name contains unsupported characters';
        if (!description) errors.description = 'Brand description is required';
        else if (description.length > 250) errors.description = 'Brand description cannot exceed 250 characters';
        if (!categoryId) errors.categoryId = 'Category is required';
        const selectedLogo = getSelectedLogoFile();
        if (!idInput.value && !selectedLogo) errors.logo = 'Brand image is required';
        if (selectedLogo) {
            if (!['image/png', 'image/jpeg'].includes(selectedLogo.type)) errors.logo = 'File not supported';
            else if (selectedLogo.size > 5 * 1024 * 1024) errors.logo = 'Image cannot exceed 5 MB';
        }
        return errors;
    };
    let logoProcessed = false;
    let logoProcessing = Promise.resolve();
    let selectedLogoFile = null;
    let originalLogoFile = null;
    const getSelectedLogoFile = () => selectedLogoFile || logoInput.files[0] || originalLogoFile || null;
    const resizeBrandImage = file => new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);
        image.onload = () => {
            const size = 800;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const scale = Math.max(size / image.width, size / image.height);
            const width = image.width * scale;
            const height = image.height * scale;
            canvas.getContext('2d').drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
            canvas.toBlob(blob => {
                URL.revokeObjectURL(objectUrl);
                if (!blob) return reject(new Error('Image resize failed'));
                resolve(new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.9);
        };
        image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Invalid image')); };
        image.src = objectUrl;
    });
    const validateLogo = () => {
        const file = getSelectedLogoFile();
        if (!file) return null;
        return ['image/png', 'image/jpeg'].includes(file.type) ? null : 'File not supported';
    };
    const openModal = brand => { title.textContent = brand ? 'Edit Brand' : 'Add New Brand'; idInput.value = brand?.id || ''; nameInput.value = brand?.name || ''; descriptionInput.value = brand?.description || ''; categoryInput.value = brand?.category || ''; offerInput.value = brand?.offerPercentage || ''; featuredInput.checked = brand?.featured === 'true'; form.action = brand ? '/admin/brands/edit' : '/admin/brands/add'; logoInput.required = !brand; logoInput.value = ''; logoProcessed = false; selectedLogoFile = null; originalLogoFile = null; logoProcessing = Promise.resolve(); clearErrors(); modal.classList.remove('hidden'); nameInput.focus(); };
    document.getElementById('openAddBrand').addEventListener('click', () => openModal());
    document.getElementById('closeBrandModal').addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('cancelBrand').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', event => { if (event.target === modal) modal.classList.add('hidden'); });
    logoInput.addEventListener('change', () => {
        logoProcessed = false;
        originalLogoFile = logoInput.files[0] || null;
        selectedLogoFile = originalLogoFile;
        logoProcessing = originalLogoFile ? resizeBrandImage(originalLogoFile).then(file => { selectedLogoFile = file; return file; }).catch(() => { selectedLogoFile = originalLogoFile; return originalLogoFile; }) : Promise.resolve(null);
        const error = selectedLogoFile && validateLogo();
        const errorElement = form.querySelector('[data-error-for="logo"]');
        if (error) {
            errorElement.textContent = error;
            logoInput.classList.add('has-error');
        } else {
            errorElement.textContent = '';
            logoInput.classList.remove('has-error');
        }
    });
    logoInput.addEventListener('imageprocessed', () => { logoProcessed = true; });
    document.querySelectorAll('.brand-edit').forEach(button => button.addEventListener('click', () => openModal({ id: button.dataset.id, name: button.dataset.name, description: button.dataset.description, category: button.dataset.category, featured: button.dataset.featured, offerPercentage: button.dataset.offer })));
    document.querySelectorAll('.brand-toggle').forEach(button => button.addEventListener('click', async () => { const response = await fetch(`/admin/brands/status/${button.dataset.id}`, { method: 'PATCH' }); if (response.ok) window.location.reload(); }));
    const successMessage = new URLSearchParams(window.location.search).get('success') || window.sessionStorage.getItem('brandSuccessMessage');
    if (successMessage) {
        window.sessionStorage.removeItem('brandSuccessMessage');
        showBrandSuccessModal(successMessage, () => window.location.reload());
    }
    form.addEventListener('submit', event => {
        event.preventDefault();
        clearErrors();
        const validationErrors = validateBrandForm();
        if (Object.keys(validationErrors).length) {
            showErrors(validationErrors);
            return;
        }

        const formData = new FormData(form);
        formData.set('featured', String(featuredInput.checked));
        formData.set('offerPercentage', offerInput.value || '0');
        const selectedLogo = getSelectedLogoFile();
        if (selectedLogo) {
            formData.set('logo', selectedLogo, selectedLogo.name);
        }
        const submitButton = form.querySelector('[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = idInput.value ? 'Saving...' : 'Saving...';

        fetch(`/admin/brands/${idInput.value ? 'edit' : 'add'}`, {
            method: 'POST',
            body: formData
        }).then(async response => {
            const result = await response.json();
            if (!response.ok || !result.success) {
                showErrors(result.errors || { form: result.message || 'Unable to save brand.' });
                return;
            }
            const successText = result.message || (idInput.value ? 'Brand updated successfully.' : 'Brand added successfully.');
            showBrandSuccessModal(successText, () => window.location.reload());
        }).catch(() => {
            showErrors({ form: 'Something went wrong. Please try again.' });
        }).finally(() => {
            submitButton.disabled = false;
            submitButton.textContent = 'Save Brand';
        });
    });
    document.getElementById('brandStatusSelect').addEventListener('change', event => { document.getElementById('brandStatusFilter').value = event.target.value; document.getElementById('brandFilters').submit(); });
    document.getElementById('brandCategorySelect').addEventListener('change', event => { document.getElementById('brandCategoryFilter').value = event.target.value; document.getElementById('brandFilters').submit(); });
});
