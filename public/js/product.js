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

document.querySelectorAll('input[name="productName"]').forEach(input => {
	input.addEventListener('input', () => {
		input.value = input.value.replace(/[^A-Za-z ]/g, '').replace(/ {2,}/g, ' ');
	});
});

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
		const status = editForm.querySelector(`input[name="status"][value="${button.dataset.status}"]`);
		if (status) status.checked = true;
		clearFieldErrors(editForm);
		showFormError(editForm, '');
		openModal(editModal);
	});
});

addForm.addEventListener('submit', async event => {
	event.preventDefault();
	const nameError = validateProductName(addForm);
	if (nameError) {
		showFieldErrors(addForm, { productName: nameError });
		return;
	}
	const submitButton = addForm.querySelector('[type="submit"]');
	submitButton.disabled = true;
	showFormError(addForm, '');

	try {
		const response = await fetch('/admin/products/add', { method: 'POST', body: new FormData(addForm) });
		const result = await response.json();
		if (!response.ok || !result.success) {
			showFieldErrors(addForm, result.errors);
			throw new Error(result.errors ? '' : result.message || 'Unable to add product');
		}
		window.location.reload();
	} catch (error) {
		if (error.message) showFormError(addForm, error.message);
		submitButton.disabled = false;
	}
});

editForm.addEventListener('submit', async event => {
	event.preventDefault();
	const nameError = validateProductName(editForm);
	if (nameError) {
		showFieldErrors(editForm, { productName: nameError });
		return;
	}
	const submitButton = editForm.querySelector('[type="submit"]');
	submitButton.disabled = true;
	showFormError(editForm, '');
	const productId = document.getElementById('editProductId').value;
	const body = Object.fromEntries(new FormData(editForm));
	delete body.productId;

	try {
		const response = await fetch(`/admin/products/edit/${productId}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		const result = await response.json();
		if (!response.ok || !result.success) {
			showFieldErrors(editForm, result.errors);
			throw new Error(result.errors ? '' : result.message || 'Unable to update product');
		}
		window.location.reload();
	} catch (error) {
		if (error.message) showFormError(editForm, error.message);
		submitButton.disabled = false;
	}
});
