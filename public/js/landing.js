document.addEventListener('DOMContentLoaded', function () {
    const cartCount = document.querySelector('[data-cart-count]');
    const addButtons = document.querySelectorAll('[data-add-to-cart]');
    let count = Number(cartCount.textContent) || 0;

    addButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            count += 1;
            cartCount.textContent = count;
            button.textContent = '✓';
            window.setTimeout(function () { button.textContent = '+'; }, 900);
        });
    });
});