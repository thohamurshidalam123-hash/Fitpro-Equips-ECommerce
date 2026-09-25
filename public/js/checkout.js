

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
                const name = selectedOption.querySelector('.saved-address-name')?.textContent || '';
                const phone = selectedOption.querySelector('.saved-address-text:nth-of-type(1)')?.textContent || '';
                const fullAddressLine = selectedOption.querySelector('.saved-address-text:nth-of-type(2)')?.textContent || '';
                const type = selectedOption.querySelector('.saved-address-badge')?.textContent || 'Home';
                
                // Grab the MongoDB _id from the hidden radio button
                const addressId = selectedOption.querySelector('input[type="radio"]').value;

                // Update the visible card UI
                const elName = document.querySelector('.address-recipient-name');
                const elPhone = document.querySelector('.address-recipient-phone');
                const elLine1 = document.querySelector('.address-line-1');
                const elPill = document.querySelector('.address-type-pill');
                const addressContainer = document.querySelector('.address-details');

                if (elName) elName.textContent = name;
                if (elPhone) elPhone.textContent = phone;
                if (elLine1) elLine1.textContent = fullAddressLine; 
                
                // Clear out line 2 if it exists to avoid duplication
                const elLine2 = document.querySelector('.address-line-last');
                if(elLine2) elLine2.textContent = '';

                if (elPill) elPill.textContent = type;
                
                // CRITICAL: Update the data ID so the place-order payload uses the new address
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
        addAddressForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const payload = {
                name: document.getElementById('newFullName').value.trim(),
                phone: document.getElementById('newPhone').value.trim(),
                street: document.getElementById('newStreet').value.trim(),
                landmark: document.getElementById('newLandmark').value.trim(),
                city: document.getElementById('newCity').value.trim(),
                state: document.getElementById('newState').value.trim(),
                pincode: document.getElementById('newPincode').value.trim(),
                type: document.getElementById('newAddressType').value
            };

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
                    // Reload the page to fetch the newly created MongoDB _id and re-render the card
                    window.location.reload();
                } else {
                    alert(data.message || 'Error saving address');
                    submitBtn.textContent = origText;
                    submitBtn.disabled = false;
                }
            } catch (error) {
                console.error('Error adding address:', error);
                alert('Failed to add address. Please try again.');
                submitBtn.textContent = origText;
                submitBtn.disabled = false;
            }
        });
    }

    // 6. Place Order Button (AJAX)
    const btnPlaceOrder = document.querySelector('.btn-place-order');
    if (btnPlaceOrder) {
        btnPlaceOrder.addEventListener('click', async () => {
            const addressContainer = document.querySelector('.address-details');
            const addressId = addressContainer ? addressContainer.dataset.activeAddressId : null;

            if (!addressId) {
                alert('Please add or select a delivery address.');
                return;
            }

            if (selectedPayment !== 'cod') {
                alert('Currently, only Cash on Delivery is supported for this milestone.');
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
                    // Redirect to the Order Success Page with the unique Order ID
                    window.location.href = `/order-success/${data.orderId}`;
                } else {
                    alert(data.message || 'Failed to place order.');
                    btnPlaceOrder.textContent = origText;
                    btnPlaceOrder.disabled = false;
                }
            } catch (error) {
                console.error('Error placing order:', error);
                alert('Server error occurred while placing the order.');
                btnPlaceOrder.textContent = origText;
                btnPlaceOrder.disabled = false;
            }
        });
    }
});