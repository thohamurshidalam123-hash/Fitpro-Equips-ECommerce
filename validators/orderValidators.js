const reasonPattern = /^[A-Za-z0-9][A-Za-z0-9 .,!?'-]*$/;

const validateOrderReason = (reason, { required = false } = {}) => {
    const normalizedReason = String(reason || '').trim();
    if (required && !normalizedReason) return 'Please provide a reason for the return.';
    if (!normalizedReason) return null;
    if (normalizedReason.length > 500) return 'Reason must be 500 characters or fewer.';
    if (!reasonPattern.test(normalizedReason)) {
        return 'Reason contains unsupported characters. Use letters, numbers, spaces, and basic punctuation.';
    }
    return null;
};

module.exports = { validateOrderReason };