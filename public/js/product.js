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
	window.clearInlineFieldErrors(form);
	form.querySelectorAll('[data-field-error]').forEach(error => { error.textContent = ''; });
	form.querySelectorAll('.has-error').forEach(field => {
		field.classList.remove('has-error');
		field.removeAttribute('aria-invalid');
	});
}

function showFieldErrors(form, errors) {
	clearFieldErrors(form);
	window.showInlineFieldErrors(form, errors);
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
	const description = form.querySelector('textarea[name="description"]').value.trim();
	if (!description) return 'Description is required';
	if (description.length < 10) return 'Description must be at least 10 characters long';
	if (description.length > 1000) return 'Description cannot exceed 1000 characters';
	if (description.includes('_')) return 'Description cannot contain underscores';
	return null;
}

function validateProductSelectionsAndPrice(form) {
	const errors = {};
	if (!form.querySelector('[name="categoryId"]').value) errors.categoryId = 'Please select a category';
	if (!form.querySelector('[name="brandId"]').value) errors.brandId = 'Please select a brand';
	const priceValue = form.querySelector('[name="regularPrice"]').value.trim();
	const price = Number(priceValue);
	if (!priceValue) errors.regularPrice = 'Price is required';
	else if (!Number.isFinite(price) || price <= 0) errors.regularPrice = 'Price must be greater than 0';
	return errors;
}

function validateProductImages(form) {
	const input = form.querySelector('input[name="images"]');
	if (!input) return null;
	if (input.dataset.invalidFile === 'true') return 'File not supported';
	const files = input.processedFiles?.length ? input.processedFiles : input.selectedFiles?.length ? input.selectedFiles : [...input.files];
	if (!files.length) return null;
	if (form === addForm && files.length < 3) return 'Please upload at least 3 images';
	return files.some(file => !['image/png', 'image/jpeg'].includes(file.type)) ? 'File not supported' : null;
}

function getProductImageFiles(input) {
	return input.processedFiles?.length ? input.processedFiles : input.selectedFiles?.length ? input.selectedFiles : [...input.files];
}

function resizeProductImage(file) {
	return new Promise((resolve, reject) => {
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
				if (!blob) return reject(new Error('Unable to resize product image.'));
				resolve(new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' }));
			}, 'image/jpeg', .9);
		};
		image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Unable to read product image.')); };
		image.src = objectUrl;
	});
}

async function prepareProductImages(input) {
	const files = getProductImageFiles(input);
	if (files.length < 3) return [];
	if (files.some(file => !['image/png', 'image/jpeg'].includes(file.type))) throw new Error('File not supported');
	return Promise.all(files.map(resizeProductImage));
}

function validateFormFields(form) {
	const errors = {};
	const nameError = validateProductName(form);
	if (nameError) errors.productName = nameError;
	Object.assign(errors, validateProductSelectionsAndPrice(form));
	Object.assign(errors, validateHighlightTitles(form));
	const descriptionError = validateDescription(form);
	if (descriptionError) errors.description = descriptionError;
	const imageError = validateProductImages(form);
	if (imageError) errors.images = imageError;
	return errors;
}

async function waitForImageProcessing(form) {
	const input = form?.querySelector('input[name="images"]');
	if (!input) return;
	if (input.imageProcessingPromise) await input.imageProcessingPromise;
	if (!input.processedFiles?.length && input.files.length) {
		input.imageProcessingPromise = window.processImageInput(input);
		await input.imageProcessingPromise;
	}
}

document.getElementById('openAddProduct')?.addEventListener('click', () => {
	addForm.reset();
	const imageInput = addForm.querySelector('input[name="images"]');
	delete imageInput.dataset.invalidFile;
	delete imageInput.dataset.processing;
	delete imageInput.imageProcessingPromise;
	imageInput.processedFiles = [];
	imageInput.selectedFiles = [];
	clearFieldErrors(addForm);
	showFormError(addForm, '');
	openModal(addModal);
});

document.getElementById('openAdvancedFilters')?.addEventListener('click', () => openModal(advancedFiltersModal));

document.getElementById('clearAdvancedFilters')?.addEventListener('click', () => {
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

document.querySelectorAll('.view-product').forEach(button => {
	button.addEventListener('click', () => {
		const productId = button.closest('.actions')?.querySelector('.edit-product')?.dataset.id;
		if (productId) window.location.href = `/admin/products/${productId}`;
	});
});

document.querySelectorAll('.edit-product').forEach(button => {
	button.addEventListener('click', () => {
		document.getElementById('editProductId').value = button.dataset.id;
		document.getElementById('editProductName').value = button.dataset.name;
		document.getElementById('editCategory').value = button.dataset.category;
		document.getElementById('editBrand').value = button.dataset.brand || '';
		document.getElementById('editProductOffer').value = button.dataset.offer || '';
		document.getElementById('editPrice').value = button.dataset.price;
		document.getElementById('editDescription').value = button.dataset.description;
		for (let index = 1; index <= 4; index++) {
			document.getElementById(`editHighlightTitle${index}`).value = button.dataset[`highlightTitle${index}`] || '';
		}
		const status = editForm.querySelector(`input[name="status"][value="${button.dataset.status}"]`);
		if (status) status.checked = true;
		clearFieldErrors(editForm);
		const imageInput = editForm.querySelector('input[name="images"]');
		delete imageInput.dataset.invalidFile;
		delete imageInput.dataset.processing;
		delete imageInput.imageProcessingPromise;
		imageInput.processedFiles = [];
		imageInput.selectedFiles = [];
		showFormError(editForm, '');
		openModal(editModal);
	});
});

document.getElementById('openEditProduct')?.addEventListener('click', () => {
	const sourceButton = document.querySelector('.details-edit-source');
	if (sourceButton) sourceButton.click();
});


addForm?.addEventListener('submit', async event => {
	event.preventDefault();
	const errors = validateFormFields(addForm);
	const imageInput = addForm.querySelector('input[name="images"]');
	const selectedImages = imageInput ? getProductImageFiles(imageInput) : [];
	if (!selectedImages.length) errors.images = 'Please upload at least 3 JPEG or PNG images';
	else if (selectedImages.length < 3) errors.images = 'Please upload at least 3 JPEG or PNG images';
	if (Object.keys(errors).length) {
		showFieldErrors(addForm, errors);
		return;
	}

	const submitButton = addForm.querySelector('[type="submit"]');
	submitButton.disabled = true;
	showFormError(addForm, '');
	const formData = new FormData(addForm);
	formData.delete('images');
	selectedImages.forEach(file => formData.append('images', file, file.name));
	try {
		const response = await fetch(addForm.action, { method: 'POST', body: formData });
		const result = await response.json();
		if (!response.ok || !result.success) {
			if (result.errors) {
				showFieldErrors(addForm, result.errors);
			} else {
				showResultModal(result.message || 'Unable to add product.', 'error');
			}
			return;
		}
		showResultModal(result.message || 'Product added successfully.', 'success', () => window.location.reload());
	} catch (error) {
		const message = error.message || 'Unable to add product. Please try again.';
		showFormError(addForm, message);
		showResultModal(message, 'error');
	} finally {
		submitButton.disabled = false;
	}
});

editForm?.addEventListener('submit', async event => {
	event.preventDefault();
	await waitForImageProcessing(editForm);
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

const addVariantModal = document.getElementById('addVariantModal');
const editVariantModal = document.getElementById('editVariantModal');
const addVariantForm = document.getElementById('addVariantForm');
const editVariantForm = document.getElementById('editVariantForm');
const productDetailsId = window.location.pathname.split('/').pop();

function setVariantError(form, message) {
	const error = form?.querySelector('[data-variant-form-error]');
	if (error) error.textContent = message || '';
}

function clearVariantFieldErrors(form) {
	form?.querySelectorAll('[data-variant-field-error]').forEach(error => {
		error.textContent = '';
	});
	form?.querySelectorAll('.has-error').forEach(field => {
		field.classList.remove('has-error');
		field.removeAttribute('aria-invalid');
	});
	form?.querySelectorAll('.variant-upload-zone').forEach(zone => {
		zone.classList.remove('has-error');
	});
}

function setVariantFieldError(form, fieldName, message) {
	const field = form?.querySelector(`[name="${fieldName}"]`);
	const error = form?.querySelector(`[data-variant-field-error="${fieldName}"]`);
	const uploadZone = form?.querySelector('.variant-upload-zone');
	if (field) {
		field.classList.toggle('has-error', Boolean(message));
		field.setAttribute('aria-invalid', Boolean(message) ? 'true' : 'false');
	}
	if (uploadZone && fieldName === 'images') {
		uploadZone.classList.toggle('has-error', Boolean(message));
	}
	if (error) error.textContent = message || '';
}

function validateVariantForm(form) {
	const errors = {};
	const colorField = form?.querySelector('[name="variantColor"]');
	if (!colorField || !colorField.value.trim()) {
		errors.variantColor = 'Please select a color.';
	}

	const weightField = form?.querySelector('[name="variantWeight"]');
	const weightValue = Number(weightField?.value);
	if (!weightField || !weightField.value || Number.isNaN(weightValue) || weightValue <= 0) {
		errors.variantWeight = 'Weight must be greater than 0.';
	}

	const priceField = form?.querySelector('[name="variantPrice"]');
	const priceValue = Number(priceField?.value);
	if (!priceField || !priceField.value || Number.isNaN(priceValue) || priceValue <= 0) {
		errors.variantPrice = 'Price must be greater than 0.';
	}

	const stockField = form?.querySelector('[name="variantStock"]');
	const stockValue = Number(stockField?.value);
	if (!stockField || stockField.value === '' || Number.isNaN(stockValue) || !Number.isInteger(stockValue) || stockValue < 0) {
		errors.variantStock = 'Stock must be a whole number greater than or equal to 0.';
	}

	const imageInput = form?.querySelector('input[name="images"]');
	const imageFiles = imageInput?.files ? [...imageInput.files] : [];
	if (form === addVariantForm && imageFiles.length < 3) {
		errors.images = 'Please upload at least 3 images.';
	}
	if (form === editVariantForm && imageFiles.length > 0 && imageFiles.length < 3) {
		errors.images = 'Please upload at least 3 replacement images.';
	}

	return errors;
}

function renderVariantPreviews(input, images = []) {
	const preview = document.querySelector(`[data-previews-for="${input.id}"]`);
	if (!preview) return;
	preview.innerHTML = images.map(image => `<img src="${image}" alt="Variant image">`).join('');
}

function processVariantImages(input) {
	return window.processImageInput(input).then(() => {
		if (input.files.length) renderVariantPreviews(input, [...input.files].map(file => URL.createObjectURL(file)));
	});
}

document.getElementById('openAddVariant')?.addEventListener('click', () => {
	addVariantForm.reset();
	setVariantError(addVariantForm, '');
	clearVariantFieldErrors(addVariantForm);
	renderVariantPreviews(document.getElementById('addVariantImages'));
	openModal(addVariantModal);
});

document.querySelectorAll('[data-close-variant-modal]').forEach(button => {
	button.addEventListener('click', () => closeModal(button.closest('.variant-modal')));
});

document.querySelectorAll('.variant-modal').forEach(modal => {
	modal.addEventListener('click', event => {
		if (event.target === modal) closeModal(modal);
	});
});

document.querySelectorAll('#addVariantImages, #editVariantImages').forEach(input => {
	input.addEventListener('change', () => processVariantImages(input));
});

document.querySelectorAll('.edit-variant-button').forEach(button => {
	button.addEventListener('click', () => {
		document.getElementById('editVariantId').value = button.dataset.variantId;
		document.getElementById('editVariantColor').value = button.dataset.variantColor || '';
		document.getElementById('editVariantWeight').value = button.dataset.variantWeight || '';
		document.getElementById('editVariantPrice').value = button.dataset.variantPrice || '';
		document.getElementById('editVariantStock').value = button.dataset.variantStock || 0;
		const imageInput = document.getElementById('editVariantImages');
		imageInput.value = '';
		const currentImages = button.dataset.variantImages ? button.dataset.variantImages.split('|') : [];
		renderVariantPreviews(imageInput, currentImages);
		setVariantError(editVariantForm, '');
		clearVariantFieldErrors(editVariantForm);
		openModal(editVariantModal);
	});
});

async function submitVariantForm(form, url, method, successMessage) {
	const validationErrors = validateVariantForm(form);
	clearVariantFieldErrors(form);
	if (Object.keys(validationErrors).length) {
		Object.entries(validationErrors).forEach(([field, message]) => setVariantFieldError(form, field, message));
		setVariantError(form, 'Please fix the highlighted fields before continuing.');
		return;
	}

	const imageInput = form.querySelector('input[name="images"]');
	const replacementImagesRequired = form === addVariantForm || imageInput.files.length > 0;
	if (replacementImagesRequired && imageInput.files.length < 3) {
		form.querySelector('[data-variant-error="images"]').textContent = 'Please upload at least 3 images';
		return;
	}
	const submitButton = form.querySelector('[type="submit"]');
	submitButton.disabled = true;
	setVariantError(form, '');
	const formData = new FormData(form);
	formData.append('variantName', `${form.variantColor.value} / ${form.variantWeight.value} ${form.variantWeightUnit?.value || 'kg'}`);
	try {
		const response = await fetch(url, { method, body: formData });
		const result = await response.json();
		if (!response.ok || !result.success) throw new Error(result.message || 'Unable to save variant.');
		showResultModal(result.message || successMessage, 'success', () => window.location.reload());
	} catch (error) {
		setVariantError(form, error.message);
		submitButton.disabled = false;
	}
}

addVariantForm?.addEventListener('submit', event => {
	event.preventDefault();
	submitVariantForm(addVariantForm, `/admin/products/${productDetailsId}/variants/add`, 'POST', 'Variant added successfully.');
});

editVariantForm?.addEventListener('submit', event => {
	event.preventDefault();
	const variantId = document.getElementById('editVariantId').value;
	submitVariantForm(editVariantForm, `/admin/products/${productDetailsId}/variants/edit/${variantId}`, 'PUT', 'Variant updated successfully.');
});
