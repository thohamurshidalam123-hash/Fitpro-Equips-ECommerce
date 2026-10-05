(function () {
	const errorSelector = '[data-inline-error-for], [data-error-for], [data-field-error], [data-variant-field-error]';

	function getErrorNode(form, control, fieldName) {
		const existing = [...form.querySelectorAll(errorSelector)].find(node =>
			node.getAttribute('data-inline-error-for') === fieldName ||
			node.getAttribute('data-error-for') === fieldName ||
			node.getAttribute('data-field-error') === fieldName ||
			node.getAttribute('data-variant-field-error') === fieldName
		);
		if (existing) return existing;

		const node = document.createElement('p');
		node.className = 'inline-validation-message';
		node.dataset.inlineErrorFor = fieldName;
		const fieldContainer = control.closest('.form-group, .field, .field-group, .profile-field, .form-field, .variant-form-group') || control.parentElement;
		fieldContainer.append(node);
		return node;
	}

	function clearControlError(control) {
		const form = control.form;
		if (!form) return;
		const fieldName = control.name || control.dataset.validationName || control.id;
		if (!fieldName) return;
		form.querySelectorAll(errorSelector).forEach(node => {
			if ([node.dataset.inlineErrorFor, node.dataset.errorFor, node.dataset.fieldError, node.dataset.variantFieldError].includes(fieldName)) {
				node.textContent = '';
				node.hidden = true;
			}
		});
		control.classList.remove('inline-validation-invalid');
		control.removeAttribute('aria-invalid');
	}

	function messageFor(control) {
		if (control.validity.valueMissing) return 'This field is required.';
		if (control.validity.typeMismatch) return control.type === 'email' ? 'Enter a valid email address.' : 'Enter a valid value.';
		if (control.validity.patternMismatch) return 'Enter a value in the required format.';
		if (control.validity.tooShort) return `Enter at least ${control.minLength} characters.`;
		if (control.validity.tooLong) return `Use no more than ${control.maxLength} characters.`;
		if (control.validity.rangeUnderflow) return `Enter a value of at least ${control.min}.`;
		if (control.validity.rangeOverflow) return `Enter a value no greater than ${control.max}.`;
		if (control.validity.stepMismatch) return 'Enter a valid value.';
		return 'Enter a valid value.';
	}

	function showErrors(form, errors) {
		Object.entries(errors || {}).forEach(([fieldName, message]) => {
			const control = [...form.elements].find(element => element.name === fieldName || element.dataset.validationName === fieldName || element.id === fieldName);
			if (!control) {
				const formError = form.querySelector('[data-form-error], .form-error, .brand-form-error');
				if (formError) formError.textContent = message;
				return;
			}
			const node = getErrorNode(form, control, fieldName);
			node.textContent = message;
			node.hidden = false;
			node.classList.add('inline-validation-message');
			control.classList.add('inline-validation-invalid');
			control.setAttribute('aria-invalid', 'true');
		});
	}

	document.addEventListener('invalid', event => {
		const control = event.target;
		if (!control.form) return;
		event.preventDefault();
		const fieldName = control.name || control.dataset.validationName || control.id || 'field';
		showErrors(control.form, { [fieldName]: messageFor(control) });
	}, true);

	document.addEventListener('input', event => clearControlError(event.target));
	document.addEventListener('change', event => clearControlError(event.target));

	window.showInlineFieldErrors = showErrors;
	window.clearInlineFieldErrors = form => {
		form.querySelectorAll('input, select, textarea').forEach(clearControlError);
	};
})();