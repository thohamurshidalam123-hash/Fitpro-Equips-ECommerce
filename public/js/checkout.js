document.addEventListener('DOMContentLoaded', () => {
    // 1. Ensure cart badge in header reflects items
    const cartCountBadge = document.querySelector('[data-cart-count]');
    if (cartCountBadge && (!cartCountBadge.textContent || cartCountBadge.textContent.trim() === '0')) {
        cartCountBadge.textContent = '3'; 
    }

    // 2. Payment Method Selection
    let selectedPayment = 'razorpay'; // Default active method
    const paymentOptions = document.querySelectorAll('.payment-method-item');
    
    paymentOptions.forEach(option => {
        option.addEventListener('click', () => {
            paymentOptions.forEach(item => {
                item.classList.remove('active');
                item.setAttribute('aria-pressed', 'false');
            });
            option.classList.add('active');
            option.setAttribute('aria-pressed', 'true');
            
            // Track the selected method for the backend payload
            selectedPayment = option.getAttribute('data-payment-method');
        });
    });

    // 3. Modal Elements
    const changeAddressModal = document.getElementById('changeAddressModal');
    const addAddressModal = document.getElementById('addAddressModal');
    
    // Using querySelectorAll to catch the Add Address button even if the list is empty
    const btnChangeAddress = document.getElementById('btnChangeAddress');
    const btnsAddNewAddress = document.querySelectorAll('#btnAddNewAddress'); 
    
    const closeButtons = document.querySelectorAll('[data-close-modal]');

    // Open Change Address Modal
    if (btnChangeAddress && changeAddressModal) {
        btnChangeAddress.addEventListener('click', (e) => {
            e.preventDefault();
            changeAddressModal.classList.add('active');
            changeAddressModal.style.display = 'block'; 
            document.body.style.overflow = 'hidden';
        });
    }

    // Open Add New Address Modal
    if (btnsAddNewAddress.length > 0 && addAddressModal) {
        btnsAddNewAddress.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                addAddressModal.classList.add('active');
                addAddressModal.style.display = 'block'; 
                document.body.style.overflow = 'hidden';
            });
        });
    }

    // Close Modals
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (changeAddressModal) {
                changeAddressModal.classList.remove('active');
                changeAddressModal.style.display = 'none';
            }
            if (addAddressModal) {
                addAddressModal.classList.remove('active');
                addAddressModal.style.display = 'none';
            }
            document.body.style.overflow = '';
        });
    });

    // Close modal on backdrop click
    [changeAddressModal, addAddressModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    modal.style.display = 'none';
                    document.body.style.overflow = '';
                }
            });
        }
    });

    // 4. Change Address Selection Handling
    const savedAddressOptions = document.querySelectorAll('.saved-address-option');
    savedAddressOptions.forEach(card => {
        card.addEventListener('click', () => {
            savedAddressOptions.forEach(c => {
                c.classList.remove('selected');
                const radio = c.querySelector('input[type="radio"]');
                if (radio) radio.checked = false;
            });
            card.classList.add('selected');
            const radio = card.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        });
    });

    const btnApplySelectedAddress = document.getElementById('btnApplySelectedAddress');
    if (btnApplySelectedAddress) {
        btnApplySelectedAddress.addEventListener('click', () => {
            const selectedOption = document.querySelector('.saved-address-option.selected');
            
            if (selectedOption) {
                const addressId = selectedOption.querySelector('input[type="radio"]').value;

                const elName = document.querySelector('.address-recipient-name');
                const elPhone = document.querySelector('.address-recipient-phone');
                const elLine1 = document.querySelector('.address-line-1');
                const elLine2 = document.querySelector('.address-line-last');
                const elPill = document.querySelector('.address-type-pill');
                const addressContainer = document.querySelector('.address-details');

                if (elName) elName.textContent = selectedOption.dataset.name;
                if (elPhone) elPhone.textContent = selectedOption.dataset.phone;
                if (elLine1) elLine1.textContent = selectedOption.dataset.line1;
                if (elLine2) elLine2.textContent = selectedOption.dataset.line2;
                if (elPill) elPill.textContent = selectedOption.dataset.type;
                if (addressContainer) addressContainer.dataset.activeAddressId = addressId;
            }

            if (changeAddressModal) {
                changeAddressModal.classList.remove('active');
                changeAddressModal.style.display = 'none';
            }
            document.body.style.overflow = '';
        });
    }

    // 5. Add New Address Form Handling (AJAX)
    const addAddressForm = document.getElementById('addAddressForm');
    if (addAddressForm) {
        const addressFieldIds = {
            fullName: 'newFullName',
            phone: 'newPhone',
            houseName: 'newHouseName',
            street: 'newStreet',
            landmark: 'newLandmark',
            city: 'newCity',
            district: 'newDistrict',
            state: 'newState',
            pincode: 'newPincode',
            addressType: 'newAddressType'
        };

        const clearAddressFieldError = (fieldName) => {
            const input = document.getElementById(addressFieldIds[fieldName]);
            const error = addAddressForm.querySelector(`[data-field-error="${fieldName}"]`);
            if (input) input.removeAttribute('aria-invalid');
            if (error) {
                error.textContent = '';
                error.hidden = true;
            }
        };

        const clearAddressErrors = () => {
            Object.keys(addressFieldIds).forEach(clearAddressFieldError);
        };

        const showAddressErrors = (errors) => {
            clearAddressErrors();
            let firstInvalidInput = null;

            Object.entries(errors || {}).forEach(([fieldName, message]) => {
                const inputId = addressFieldIds[fieldName];
                const input = inputId && document.getElementById(inputId);
                const error = addAddressForm.querySelector(`[data-field-error="${fieldName}"]`);
                if (!input || !error) return;

                input.setAttribute('aria-invalid', 'true');
                error.textContent = message;
                error.hidden = false;
                if (!firstInvalidInput) firstInvalidInput = input;
            });

            if (firstInvalidInput) firstInvalidInput.focus();
            return Boolean(firstInvalidInput);
        };

        Object.entries(addressFieldIds).forEach(([fieldName, inputId]) => {
            const input = document.getElementById(inputId);
            input?.addEventListener('input', () => clearAddressFieldError(fieldName));
            input?.addEventListener('change', () => clearAddressFieldError(fieldName));
        });

        addAddressForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAddressErrors();
            
            const payload = {
                fullName: document.getElementById('newFullName').value.trim(),
                phone: document.getElementById('newPhone').value.trim(),
                houseName: document.getElementById('newHouseName').value.trim(),
                street: document.getElementById('newStreet').value.trim(),
                landmark: document.getElementById('newLandmark').value.trim(),
                city: document.getElementById('newCity').value.trim(),
                district: document.getElementById('newDistrict').value.trim(),
                state: document.getElementById('newState').value.trim(),
                pincode: document.getElementById('newPincode').value.trim(),
                addressType: document.getElementById('newAddressType').value
            };

            const requiredFields = ['fullName', 'phone', 'houseName', 'street', 'city', 'district', 'state', 'pincode'];
            const clientErrors = Object.fromEntries(
                requiredFields
                    .filter(fieldName => !payload[fieldName])
                    .map(fieldName => [fieldName, 'This field is required.'])
            );

            if (showAddressErrors(clientErrors)) {
                return;
            }

            const submitBtn = addAddressForm.querySelector('button[type="submit"]');
            const origText = submitBtn.textContent;
            submitBtn.textContent = 'Saving...';
            submitBtn.disabled = true;

            try {
                const res = await fetch('/checkout/address/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                
                if (data.success) {
                    window.showAppModal(data.message || 'Address added successfully.', 'success', {
                        onClose: () => {
                            window.location.href = `/checkout?addressId=${encodeURIComponent(data.addressId)}`;
                        }
                    });
                } else {
                    const hasFieldErrors = showAddressErrors(data.errors);
                    if (!hasFieldErrors) window.showAppModal(data.message || 'Error saving address.', 'error');
                    submitBtn.textContent = origText;
                    submitBtn.disabled = false;
                }
            } catch (error) {
                console.error('Error adding address:', error);
                window.showAppModal('Failed to add address. Please try again.', 'error');
                submitBtn.textContent = origText;
                submitBtn.disabled = false;
            }
        });
    }

    // 6. Place Order Button (AJAX) - UPDATED FOR RAZORPAY
    const btnPlaceOrder = document.querySelector('.btn-place-order');
    const btnRemoveCoupon = document.querySelector('.btn-remove-coupon');
    if (btnRemoveCoupon) {
        btnRemoveCoupon.addEventListener('click', async () => {
            btnRemoveCoupon.disabled = true;
            try {
                const response = await fetch('/remove-coupon', { method: 'POST' });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    window.showAppModal(data.message || 'Unable to remove the coupon.', 'error');
                    btnRemoveCoupon.disabled = false;
                    return;
                }
                window.showAppModal(data.message || 'Coupon removed successfully.', 'success', {
                    onClose: () => window.location.reload()
                });
            } catch (error) {
                console.error('Error removing coupon:', error);
                window.showAppModal('Unable to remove the coupon. Please try again.', 'error');
                btnRemoveCoupon.disabled = false;
            }
        });
    }

    if (btnPlaceOrder) {
        btnPlaceOrder.addEventListener('click', async () => {
            const addressContainer = document.querySelector('.address-details');
            const addressId = addressContainer ? addressContainer.dataset.activeAddressId : null;

            if (!addressId) {
                window.showAppModal('Please add or select a delivery address.', 'error');
                return;
            }

            const origText = btnPlaceOrder.textContent;
            btnPlaceOrder.textContent = 'Processing...';
            btnPlaceOrder.disabled = true;

            try {
                const res = await fetch('/checkout/place-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        addressId: addressId, 
                        paymentMethod: selectedPayment 
                    })
                });
                
                const data = await res.json();
                
                if (data.success) {
                    // RAZORPAY INTEGRATION BLOCK
                    if (data.paymentMethod === 'razorpay') {
                        const options = {
                            key: data.key,
                            amount: data.amount,
                            currency: "INR",
                            name: "Fitpro Equips",
                            description: "Order Payment",
                            order_id: data.razorpayOrderId,
                            handler: async function (response) {
                                // Payment succeeded, verifying on backend
                                const verifyRes = await fetch('/checkout/verify-payment', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        orderId: data.orderId,
                                        paymentData: response
                                    })
                                });
                                const verifyData = await verifyRes.json();
                                if (verifyData.success) {
                                    window.location.href = `/order-success/${data.orderId}`;
                                } else {
                                    window.location.href = `/order-failed/${data.orderId}`;
                                }
                            },
                            modal: {
                                ondismiss: async function () {
                                    // User closed the Razorpay popup without finishing payment
                                    await fetch('/checkout/payment-failed', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ orderId: data.orderId })
                                    });
                                    window.location.href = `/order-failed/${data.orderId}`;
                                }
                            }
                        };
                        
                        const rzp = new Razorpay(options);
                        rzp.on('payment.failed', async function (response) {
                            // Payment failed at the gateway level
                            await fetch('/checkout/payment-failed', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ orderId: data.orderId })
                            });
                            window.location.href = `/order-failed/${data.orderId}`;
                        });
                        rzp.open();
                    } else if (data.paymentMethod === 'wallet') {
                        const deductedAmount = Number(data.amount || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        });
                        window.showAppModal(`₹${deductedAmount} has been deducted from your wallet. Your order was placed successfully.`, 'success', {
                            onClose: () => window.location.href = `/order-success/${data.orderId}`
                        });
                    } else {
                        // COD successful redirect
                        window.location.href = `/order-success/${data.orderId}`;
                    }
                } else {
                    window.showAppModal(data.message || 'Failed to place order.', 'error');
                    btnPlaceOrder.textContent = origText;
                    btnPlaceOrder.disabled = false;
                }
            } catch (error) {
                console.error('Error placing order:', error);
                window.showAppModal('Server error occurred while placing the order.', 'error');
                btnPlaceOrder.textContent = origText;
                btnPlaceOrder.disabled = false;
            }
        });
    }
});