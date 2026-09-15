document.addEventListener('DOMContentLoaded', () => {
	const modal = document.getElementById('categoryModal');
	const form = document.getElementById('categoryForm');
	const idInput = document.getElementById('categoryId');
	const nameInput = document.getElementById('categoryName');
	const descriptionInput = document.getElementById('categoryDescription');
	const featuredInput = document.getElementById('categoryFeatured');
	const imageInput = document.getElementById('categoryImage');
	const selectedImage = document.getElementById('selectedImage');
	const title = document.getElementById('categoryModalTitle');
	const error = document.getElementById('categoryFormError');
	const submitButton = form.querySelector('button[type="submit"]');
	const fieldErrors = [...form.querySelectorAll('[data-error-for]')];
	const clearErrors = () => {
		error.textContent = '';
		fieldErrors.forEach(field => field.textContent = '');
		form.querySelectorAll('.has-error').forEach(field => field.classList.remove('has-error'));
	};
	const showErrors = errors => {
		clearErrors();
		Object.entries(errors || {}).forEach(([field, message]) => {
			const messageElement = form.querySelector(`[data-error-for="${field}"]`);
			const input = form.querySelector(`[name="${field}"]`);
			if (messageElement) messageElement.textContent = message;
			if (input) input.classList.add('has-error');
			if (field === 'form') error.textContent = message;
		});
	};
	const validateForm = () => {
		const errors = {};
		const name = nameInput.value.trim();
		const description = descriptionInput.value.trim();
		const image = imageInput.files[0];
		if (!name) errors.name = 'Category name is required';
		else if (name.length < 2) errors.name = 'Category name must be at least 2 characters long';
		else if (name.length > 80) errors.name = 'Category name cannot exceed 80 characters';
		else if (!/^[A-Za-z0-9][A-Za-z0-9 &'()-]*$/.test(name)) errors.name = 'Category name contains unsupported characters';
		if (!description) errors.description = 'Description is required';
		else if (description.length < 2) errors.description = 'Description must be at least 2 characters long';
		else if (description.length > 250) errors.description = 'Description cannot exceed 250 characters';
		if (!idInput.value && !image) errors.image = 'Category image is required';
		if (image && !['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml'].includes(image.type)) errors.image = 'Image must be a PNG, JPG, GIF, or SVG file';
		else if (image && image.size > 5 * 1024 * 1024) errors.image = 'Image cannot exceed 5 MB';
		return errors;
	};
	const closeModal = () => modal.classList.add('hidden');
	const openModal = (category) => {
		title.textContent = category ? 'Edit Category' : 'Add Category';
		idInput.value = category?.id || '';
		nameInput.value = category?.name || '';
		descriptionInput.value = category?.description || '';
		featuredInput.checked = category?.featured === 'true';
		imageInput.value = '';
		selectedImage.textContent = category?.image ? 'Current image will be kept unless a new image is selected.' : '';
		clearErrors();
		modal.classList.remove('hidden');
		nameInput.focus();
	};
	document.getElementById('openAddCategory').addEventListener('click', () => openModal());
	document.getElementById('closeCategoryModal').addEventListener('click', closeModal);
	document.getElementById('cancelCategory').addEventListener('click', closeModal);
	modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
	document.querySelectorAll('.edit-category').forEach(button => button.addEventListener('click', () => openModal({ id: button.dataset.id, name: button.dataset.name, description: button.dataset.description, featured: button.dataset.featured, image: button.dataset.image })));
	document.querySelectorAll('.toggle-category').forEach(button => button.addEventListener('click', async () => {
		const response = await fetch(`/admin/category/status/${button.dataset.id}`, { method: 'PATCH' });
		if (response.ok) window.location.reload();
	}));
	form.addEventListener('submit', async event => {
		event.preventDefault();
		const validationErrors = validateForm();
		if (Object.keys(validationErrors).length) { showErrors(validationErrors); return; }
		const id = idInput.value;
		const formData = new FormData(form);
		formData.set('id', id);
		formData.set('featured', String(featuredInput.checked));
		submitButton.disabled = true;
		submitButton.textContent = id ? 'Updating...' : 'Saving...';
		try {
			const response = await fetch(`/admin/category/${id ? 'edit' : 'add'}`, { method: 'POST', body: formData });
			const result = await response.json();
			if (!result.success) {
				showErrors(result.errors || { form: result.message || 'Unable to save category.' });
			} else {
				if (typeof window.showAppModal === 'function') {
					window.showAppModal(result.message, 'success');
					setTimeout(() => window.location.reload(), 1500);
				} else {
					window.alert(result.message);
					window.location.reload();
				}
			}
		} catch (requestError) {
			showErrors({ form: 'Something went wrong. Please try again.' });
		} finally {
			submitButton.disabled = false;
			submitButton.textContent = 'Save Category';
		}
	});
});
