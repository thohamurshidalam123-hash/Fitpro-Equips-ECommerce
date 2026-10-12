const OTP_RESEND_DELAY_MS = 60 * 1000;

const getOtpResendSeconds = availableAt => Math.max(0, Math.ceil((Number(availableAt || 0) - Date.now()) / 1000));

const setOtpResendAvailableAt = (session, key) => {
    session[key] = Date.now() + OTP_RESEND_DELAY_MS;
    return session[key];
};

module.exports = { getOtpResendSeconds, setOtpResendAvailableAt };