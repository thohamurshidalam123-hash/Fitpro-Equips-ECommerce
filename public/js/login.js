document.addEventListener('DOMContentLoaded', function () {
    const toggle = document.querySelector('[data-password-toggle]');
    const password = document.getElementById('password');

    if (!toggle || !password) return;

    toggle.addEventListener('click', function () {
        const showingPassword = password.type === 'password';
        password.type = showingPassword ? 'text' : 'password';
        toggle.setAttribute('aria-label', showingPassword ? 'Hide password' : 'Show password');
    });
});
