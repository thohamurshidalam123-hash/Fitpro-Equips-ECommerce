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

document.getElementById('openAddProduct').addEventListener('click', () => {
	addForm.reset();
	addForm.querySelector('[data-form-error]').textContent = '';
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
		editForm.querySelector('[data-form-error]').textContent = '';
		openModal(editModal);
	});
});

addForm.addEventListener('submit', async event => {
	event.preventDefault();
	const submitButton = addForm.querySelector('[type="submit"]');
	submitButton.disabled = true;
	showFormError(addForm, '');

	try {
		const response = await fetch('/admin/products/add', { method: 'POST', body: new FormData(addForm) });
		const result = await response.json();
		if (!response.ok || !result.success) throw new Error(result.message || 'Unable to add product');
		window.location.reload();
	} catch (error) {
		showFormError(addForm, error.message);
		submitButton.disabled = false;
	}
});

editForm.addEventListener('submit', async event => {
	event.preventDefault();
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
		if (!response.ok || !result.success) throw new Error(result.message || 'Unable to update product');
		window.location.reload();
	} catch (error) {
		showFormError(editForm, error.message);
		submitButton.disabled = false;
	}
});
