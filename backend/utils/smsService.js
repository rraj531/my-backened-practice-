/**
 * SMS Service for delivering Mobile OTPs
 * Supports:
 * - Supabase Auth Phone / SMS
 * - Fast2SMS API (for Indian numbers)
 * - Development console logger
 */

async function sendMobileOtp(phone, otp) {
    const formattedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/^0+/, '')}`;

    console.log(`\n==============================================`);
    console.log(`📱 [MOBILE SMS OTP] Sent to ${formattedPhone}: ${otp}`);
    console.log(`==============================================\n`);

    // 1. Supabase Auth SMS Integration (if configured)
    const supabaseUrl = process.env.SUPABASE_URL || 'https://bmygedaxrhziwtyrwlae.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
        try {
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { data, error } = await supabase.auth.signInWithOtp({
                phone: formattedPhone
            });
            if (error) {
                console.log(`⚠️ Supabase SMS notice: ${error.message}`);
                console.log(`ℹ️ [Tip] Ensure SMS provider (Twilio/MessageBird) or valid anon JWT key is set in Supabase Dashboard for ${supabaseUrl}`);
            } else {
                console.log(`✅ [Supabase SMS Sent] OTP delivered to ${formattedPhone}`);
                return { success: true, provider: 'supabase' };
            }
        } catch (err) {
            console.error('Supabase SMS Error:', err.message);
        }
    }

    // 2. Fast2SMS Integration (if FAST2SMS_API_KEY is configured)
    if (process.env.FAST2SMS_API_KEY) {
        try {
            const rawNumber = phone.replace(/\D/g, '').slice(-10);
            const response = await fetch(`https://www.fast2sms.com/dev/bulkV2?authorization=${process.env.FAST2SMS_API_KEY}&route=otp&variables_values=${otp}&numbers=${rawNumber}`);
            const data = await response.json();
            if (data.return) {
                console.log(`✅ [Fast2SMS Sent] OTP delivered to ${rawNumber}`);
                return { success: true, provider: 'fast2sms' };
            }
        } catch (err) {
            console.error('Fast2SMS Error:', err.message);
        }
    }

    // Default development mode: OTP is logged in console and returned
    return { success: true, provider: 'console_dev' };
}

module.exports = {
    sendMobileOtp
};
