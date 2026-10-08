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

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    };

    const openCreateModal = () => {
        form.reset();
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

        // Validations
        const discountType = fields.type.value;
        const discountValue = parseFloat(fields.value.value);
        const minPurchase = parseFloat(fields.minimum.value);
        const maxDiscount = fields.maximum.value ? parseFloat(fields.maximum.value) : null;
        const expiryDate = new Date(fields.expiry.value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (expiryDate <= today) {
            return window.showAppModal('Expiry date must be in the future', 'error');
        }

        if (discountType === 'percentage' && discountValue > 100) {
            return window.showAppModal('Percentage discount cannot exceed 100%', 'error');
        }

        if (discountType === 'fixed' && discountValue >= minPurchase) {
            return window.showAppModal('Fixed discount must be less than minimum purchase amount', 'error');
        }

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
                window.showAppModal(data.message || 'Failed to save coupon', 'error');
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