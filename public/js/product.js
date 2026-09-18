const addModal = document.getElementById('addProductModal');
const editModal = document.getElementById('editProductModal');
const addForm = document.getElementById('addProductForm');
const editForm = document.getElementById('editProductForm');
const advancedFiltersModal = document.getElementById('advancedFiltersModal');

function openModal(modal) {
	modal.classList.remove('hidden');
	document.body.classList.add('modal-open');
}

function closeModal(modal) {
	modal.classList.add('hidden');
	document.body.classList.remove('modal-open');
}

function showFormError(form, message) {
	form.querySelector('[data-form-error]').textContent = message;
}

function showResultModal(message, type, onClose) {
	const closeButton = document.querySelector('.app-notification-close');
	if (!window.showAppModal || !closeButton) return;
	window.showAppModal(message, type);
	if (onClose) closeButton.addEventListener('click', onClose, { once: true });
}

function clearFieldErrors(form) {
	form.querySelectorAll('[data-field-error]').forEach(error => { error.textContent = ''; });
	form.querySelectorAll('.has-error').forEach(field => {
		field.classList.remove('has-error');
		field.removeAttribute('aria-invalid');
	});
}

function showFieldErrors(form, errors) {
	clearFieldErrors(form);
	Object.entries(errors || {}).forEach(([field, message]) => {
		const messageElement = form.querySelector(`[data-field-error="${field}"]`);
		if (messageElement) messageElement.textContent = message;
		form.querySelectorAll(`[name="${field}"]`).forEach(input => {
			input.classList.add('has-error');
			input.setAttribute('aria-invalid', 'true');
		});
	});
}

function validateProductName(form) {
	const nameInput = form.querySelector('input[name="productName"]');
	const name = nameInput.value.trim();
	if (!name) return 'Product name is required';
	if (!/^[A-Za-z]+(?: +[A-Za-z]+)*$/.test(name)) return 'Product name can contain only letters and spaces';
	return null;
}

function validateHighlightTitles(form) {
	const errors = {};
	for (let index = 1; index <= 4; index++) {
		const input = form.querySelector(`[name="highlightTitle${index}"]`);
		const title = input.value.trim();
		if (!title) errors[`highlightTitle${index}`] = `Highlight ${index} title is required`;
		else if (title.length > 60) errors[`highlightTitle${index}`] = `Highlight ${index} title cannot exceed 60 characters`;
		else if (!/^[A-Za-z]+(?: +[A-Za-z]+)*$/.test(title)) errors[`highlightTitle${index}`] = `Highlight ${index} title can contain only letters and spaces`;
	}
	return errors;
}

function validateDescription(form) {
	const description = form.querySelector('textarea[name="description"]').value;
	return description.includes('_') ? 'Description cannot contain underscores' : null;
}

function validateFormFields(form) {
	const errors = {};
	const nameError = validateProductName(form);
	if (nameError) errors.productName = nameError;
	Object.assign(errors, validateHighlightTitles(form));
	const descriptionError = validateDescription(form);
	if (descriptionError) errors.description = descriptionError;
	return errors;
}

document.getElementById('openAddProduct').addEventListener('click', () => {
	addForm.reset();
	clearFieldErrors(addForm);
	showFormError(addForm, '');
	openModal(addModal);
});

document.getElementById('openAdvancedFilters').addEventListener('click', () => openModal(advancedFiltersModal));

document.getElementById('clearAdvancedFilters').addEventListener('click', () => {
	advancedFiltersModal.querySelectorAll('select[name="category"] option').forEach(option => {
		option.selected = false;
	});
	advancedFiltersModal.querySelector('#advancedStatus').value = '';
	advancedFiltersModal.querySelector('input[name="minPrice"]').value = '';
	advancedFiltersModal.querySelector('input[name="maxPrice"]').value = '';
	advancedFiltersModal.querySelector('#advancedFiltersForm').submit();
});

document.querySelectorAll('[data-close-modal]').forEach(button => {
	button.addEventListener('click', () => closeModal(button.closest('.product-modal')));
});

document.querySelectorAll('.product-modal').forEach(modal => {
	modal.addEventListener('click', event => {
		if (event.target === modal) closeModal(modal);
	});
});

document.querySelectorAll('.edit-product').forEach(button => {
	button.addEventListener('click', () => {
		document.getElementById('editProductId').value = button.dataset.id;
		document.getElementById('editProductName').value = button.dataset.name;
		document.getElementById('editCategory').value = button.dataset.category;
		document.getElementById('editPrice').value = button.dataset.price;
		document.getElementById('editStock').value = button.dataset.stock;
		document.getElementById('editDescription').value = button.dataset.description;
		for (let index = 1; index <= 4; index++) {
			document.getElementById(`editHighlightTitle${index}`).value = button.dataset[`highlightTitle${index}`] || '';
		}
		const status = editForm.querySelector(`input[name="status"][value="${button.dataset.status}"]`);
		if (status) status.checked = true;
		clearFieldErrors(editForm);
		showFormError(editForm, '');
		openModal(editModal);
	});
});

addForm.addEventListener('submit', async event => {
	event.preventDefault();
	const addFieldErrors = validateFormFields(addForm);
	if (Object.keys(addFieldErrors).length) {
		showFieldErrors(addForm, addFieldErrors);
		return;
	}
	const submitButton = addForm.querySelector('[type="submit"]');
	submitButton.disabled = true;
	showFormError(addForm, '');

	let notificationShown = false;
	try {
		const response = await fetch('/admin/products/add', { method: 'POST', body: new FormData(addForm) });
		const result = await response.json();
		if (!response.ok || !result.success) {
			showFieldErrors(addForm, result.errors);
			if (result.errors) {
				submitButton.disabled = false;
				return;
			}
			showResultModal(result.message || 'Unable to add product.', 'error');
			notificationShown = true;
			throw new Error(result.message || 'Unable to add product');
		}
		showResultModal(result.message || 'Product added successfully.', 'success', () => window.location.reload());
	} catch (error) {
		if (error.message) showFormError(addForm, error.message);
		if (!notificationShown) showResultModal(error.message || 'Unable to add product.', 'error');
		submitButton.disabled = false;
	}
});

editForm.addEventListener('submit', async event => {
	event.preventDefault();
	const editFieldErrors = validateFormFields(editForm);
	if (Object.keys(editFieldErrors).length) {
		showFieldErrors(editForm, editFieldErrors);
		return;
	}
	const submitButton = editForm.querySelector('[type="submit"]');
	submitButton.disabled = true;
	showFormError(editForm, '');
	const productId = document.getElementById('editProductId').value;
	const body = Object.fromEntries(new FormData(editForm));
	delete body.productId;

	let notificationShown = false;
	try {
		const response = await fetch(`/admin/products/edit/${productId}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		const result = await response.json();
		if (!response.ok || !result.success) {
			showFieldErrors(editForm, result.errors);
			if (result.errors) {
				submitButton.disabled = false;
				return;
			}
			showResultModal(result.message || 'Unable to update product.', 'error');
			notificationShown = true;
			throw new Error(result.message || 'Unable to update product');
		}
		showResultModal(result.message || 'Product updated successfully.', 'success', () => window.location.reload());
	} catch (error) {
		if (error.message) showFormError(editForm, error.message);
		if (!notificationShown) showResultModal(error.message || 'Unable to update product.', 'error');
		submitButton.disabled = false;
	}
});
