document.addEventListener('DOMContentLoaded', () => {
    // 1. Select the elements
    const blockModal = document.getElementById('blockModal');
    const blockButtons = document.querySelectorAll('.btn-block');
    const cancelBtn = document.getElementById('cancelBlockBtn');
    const confirmBtn = document.getElementById('confirmBlockBtn');

    // Variable to track which user ID we are blocking
    let currentCustomerId = null;

    // 2. Open Modal when any 'Block' button is clicked
    blockButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Optional: you can grab a data attribute to know WHICH user to block
            // e.g., <button class="btn-block" data-userid="123">
            // currentCustomerId = button.getAttribute('data-userid'); 
            
            blockModal.classList.remove('hidden');
        });
    });

    // 3. Close Modal on Cancel
    cancelBtn.addEventListener('click', () => {
        blockModal.classList.add('hidden');
        currentCustomerId = null; // Reset
    });

    // 4. Handle the "Yes, Block" action
    confirmBtn.addEventListener('click', () => {
        // Here you would typically make a fetch() call to your Node/Express backend
        /*
        fetch(`/api/customers/block/${currentCustomerId}`, { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                // Handle success, maybe reload page or update DOM
            });
        */
        
        alert('Customer Blocked Successfully! (Mock action)');
        blockModal.classList.add('hidden');
    });

    // Optional: Close modal if clicking outside the modal content
    blockModal.addEventListener('click', (e) => {
        if (e.target === blockModal) {
            blockModal.classList.add('hidden');
        }
    });
});