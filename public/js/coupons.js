(() => {
    const modal = document.getElementById('couponModal');
    const form = document.getElementById('couponForm');
    const title = document.getElementById('couponModalTitle');
    const submitLabel = document.getElementById('couponSubmitLabel');
    const filterForm = document.getElementById('couponFilters');
    const search = document.getElementById('couponSearch');
    const typeFilter = document.getElementById('couponTypeFilter');
    const statusFilter = document.getElementById('couponStatusFilter');
    const tableBody = document.getElementById('couponTableBody');
    const countLabel = document.getElementById('couponCount');
    const emptyRow = tableBody.querySelector('.coupon-empty');

    document.querySelectorAll('[data-usage-percent]').forEach(fill => {
        const usagePercent = Math.max(0, Math.min(100, Number(fill.dataset.usagePercent) || 0));
        fill.style.width = `${usagePercent}%`;
    });
    
    const fields = {
        id: document.getElementById('couponId'),
        code: document.getElementById('couponCode'),
        name: document.getElementById('couponName'),
        type: document.getElementById('discountType'),
        value: document.getElementById('discountValue'),
        minimum: document.getElementById('minimumPurchase'),
        limit: document.getElementById('usageLimit'),
        expiry: document.getElementById('expiryDate'),
        description: document.getElementById('couponDescription'),
        active: document.getElementById('couponActive'),
        maximum: document.getElementById('maximumDiscount')
    };

    const clearCouponErrors = () => {
        window.clearInlineFieldErrors(form);
        form.querySelectorAll('[data-error-for]').forEach(error => {
            error.textContent = '';
            error.hidden = true;
        });
    };

    const showCouponErrors = errors => {
        clearCouponErrors();
        window.showInlineFieldErrors(form, errors);
    };

    const validateCouponForm = () => {
        const errors = {};
        const discountValue = Number(fields.value.value);
        const minimumPurchase = Number(fields.minimum.value);
        const usageLimit = Number(fields.limit.value);
        const maximumDiscount = fields.maximum.value === '' ? null : Number(fields.maximum.value);
        const expiryDate = fields.expiry.value;

        if (!fields.code.value.trim()) errors.couponCode = 'Coupon code is required';
        if (!fields.name.value.trim()) errors.couponName = 'Coupon name is required';
        if (!['percentage', 'fixed'].includes(fields.type.value)) errors.discountType = 'Select a valid discount type';
        if (fields.value.value === '' || !Number.isFinite(discountValue) || discountValue < 0) errors.discountValue = 'Enter a valid discount value';
        else if (fields.type.value === 'percentage' && discountValue > 100) errors.discountValue = 'Percentage discount cannot exceed 100%';
        if (fields.minimum.value === '' || !Number.isFinite(minimumPurchase) || minimumPurchase < 0) errors.minPurchaseAmount = 'Enter a valid minimum purchase amount';
        if (fields.limit.value === '' || !Number.isInteger(usageLimit) || usageLimit < 1) errors.usageLimitPerUser = 'Usage limit must be a whole number greater than 0';
        if (!expiryDate) errors.expiryDate = 'Expiry date is required';
        else {
            const parsedExpiry = new Date(`${expiryDate}T00:00:00`);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (Number.isNaN(parsedExpiry.getTime())) errors.expiryDate = 'Enter a valid expiry date';
            else if (parsedExpiry <= today) errors.expiryDate = 'Expiry date must be in the future';
        }
        if (maximumDiscount !== null && (!Number.isFinite(maximumDiscount) || maximumDiscount < 0)) errors.maxDiscountAmount = 'Maximum discount cannot be negative';
        if (!fields.description.value.trim()) errors.description = 'Description is required';
        if (fields.type.value === 'fixed' && !errors.discountValue && !errors.minPurchaseAmount && discountValue >= minimumPurchase) {
            errors.discountValue = 'Fixed discount must be less than minimum purchase amount';
        }
        return errors;
    };

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    };

    const openCreateModal = () => {
        form.reset();
        clearCouponErrors();
        fields.id.value = '';
        fields.active.checked = true;
        fields.type.value = 'percentage';
        title.textContent = 'Create Coupon';
        submitLabel.textContent = 'Create Coupon';
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        fields.code.focus();
    };

    document.querySelectorAll('[data-open-coupon="create"]').forEach(button => button.addEventListener('click', openCreateModal));
    document.querySelectorAll('[data-close-coupon]').forEach(button => button.addEventListener('click', closeModal));
    
    modal.addEventListener('click', event => {
        if (event.target === modal) closeModal();
    });
    
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });

    document.querySelectorAll('.edit-coupon').forEach(button => {
        button.addEventListener('click', () => {
            clearCouponErrors();
            fields.id.value = button.dataset.id || '';
            fields.code.value = button.dataset.code || '';
            fields.name.value = button.dataset.name || '';
            fields.type.value = button.dataset.type || 'percentage';
            fields.value.value = button.dataset.value || '';
            fields.minimum.value = button.dataset.minimum || '0';
            fields.limit.value = button.dataset.limit || '1';
            fields.expiry.value = button.dataset.expiry || '';
            fields.description.value = button.dataset.description || '';
            fields.active.checked = button.dataset.active === 'true';
            fields.maximum.value = button.dataset.maximum || '';
            
            title.textContent = 'Edit Coupon';
            submitLabel.textContent = 'Save Changes';
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
            fields.code.focus();
        });
    });

    // Form Submission & Validation
    form.addEventListener('submit', async event => {
        event.preventDefault();
        clearCouponErrors();
        const discountType = fields.type.value;
        const discountValue = parseFloat(fields.value.value);
        const minPurchase = parseFloat(fields.minimum.value);
        const maxDiscount = fields.maximum.value ? parseFloat(fields.maximum.value) : null;
        const validationErrors = validateCouponForm();
        if (Object.keys(validationErrors).length) return showCouponErrors(validationErrors);

        const payload = {
            couponCode: fields.code.value,
            couponName: fields.name.value,
            discountType: discountType,
            discountValue: discountValue,
            minPurchaseAmount: minPurchase,
            usageLimitPerUser: parseInt(fields.limit.value, 10),
            expiryDate: fields.expiry.value,
            maxDiscountAmount: maxDiscount,
            description: fields.description.value,
            isActive: fields.active.checked
        };

        const couponId = fields.id.value;
        const url = couponId ? `/admin/coupons/${couponId}` : '/admin/coupons';
        const method = couponId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                window.showAppModal(data.message || 'Coupon saved successfully', 'success', {
                    onClose: () => window.location.href = '/admin/coupons'
                });
            } else {
                if (data.errors) showCouponErrors(data.errors);
                else window.showAppModal(data.message || 'Failed to save coupon', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            window.showAppModal('An unexpected error occurred', 'error');
        }
    });

    // Delete Coupon Logic
    document.querySelectorAll('.delete-coupon').forEach(button => {
        button.addEventListener('click', () => {
            const couponId = button.dataset.id;

            window.showConfirmationModal("You won't be able to revert this. Delete this coupon?", async () => {
                try {
                    const response = await fetch(`/admin/coupons/${couponId}`, {
                        method: 'DELETE'
                    });

                    const data = await response.json();

                    if (response.ok) {
                        window.showAppModal(data.message || 'Coupon has been deleted.', 'success', {
                            onClose: () => window.location.reload()
                        });
                    } else {
                        window.showAppModal(data.message || 'Failed to delete coupon', 'error');
                    }
                } catch (error) {
                    window.showAppModal('An unexpected error occurred', 'error');
                }
            });
        });
    });

    const filterCoupons = () => {
        const query = search.value.trim().toLowerCase();
        const rows = [...tableBody.querySelectorAll('tr[data-code]')];
        let visibleCount = 0;
        rows.forEach(row => {
            const matchesText = `\({row.dataset.code}\){row.dataset.name}`.toLowerCase().includes(query);
            const matchesType = typeFilter.value === 'all' || row.dataset.type === typeFilter.value;
            const matchesStatus = statusFilter.value === 'all' || row.dataset.status === statusFilter.value;
            const visible = matchesText && matchesType && matchesStatus;
            row.hidden = !visible;
            if (visible) visibleCount += 1;
        });
        emptyRow.classList.toggle('hidden', visibleCount > 0);
        countLabel.textContent = `Showing \({visibleCount ? 1 : 0} to\){visibleCount} of ${rows.length} entries`;
    };

    typeFilter.addEventListener('change', () => filterForm.requestSubmit());
    statusFilter.addEventListener('change', () => filterForm.requestSubmit());
    
    document.getElementById('clearCouponFilters').addEventListener('click', () => {
        window.location.href = '/admin/coupons';
    });
})();