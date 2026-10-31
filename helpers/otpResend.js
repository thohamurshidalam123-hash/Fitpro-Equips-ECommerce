const OTP_LIFETIME_MS = 3 * 60 * 1000;
const OTP_RESEND_DELAY_MS = OTP_LIFETIME_MS;

const getOtpResendSeconds = availableAt => Math.max(0, Math.ceil((Number(availableAt || 0) - Date.now()) / 1000));
const getOtpExpiryTimestamp = () => Date.now() + OTP_LIFETIME_MS;
const isOtpExpired = expiresAt => !Number.isFinite(Number(expiresAt)) || Date.now() >= Number(expiresAt);

const setOtpResendAvailableAt = (session, key) => {
    session[key] = Date.now() + OTP_RESEND_DELAY_MS;
    return session[key];
};

module.exports = { getOtpExpiryTimestamp, getOtpResendSeconds, isOtpExpired, setOtpResendAvailableAt };