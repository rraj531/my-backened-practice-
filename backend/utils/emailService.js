const nodemailer = require('nodemailer');

// Create transporter
function getTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

// Send OTP Email
async function sendOtpEmail(toEmail, otp) {
    const transporter = getTransporter();

    const mailOptions = {
        from: `"TaskMaster App" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `Your Registration OTP: ${otp}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #4f46e5; margin: 0;">✨ TaskMaster</h2>
                    <p style="color: #64748b; font-size: 14px;">Complete your registration</p>
                </div>
                <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0; color: #334155; font-size: 15px;">Your One-Time Password (OTP) is:</p>
                    <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #4f46e5; font-family: monospace;">${otp}</div>
                    <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 13px;">Valid for 10 minutes</p>
                </div>
                <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
                    If you did not request this OTP, please ignore this email. Do not share this code with anyone.
                </p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                    &copy; 2026 TaskMaster App. All rights reserved.
                </p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ [Real Email Sent] OTP ${otp} delivered to ${toEmail}. Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`❌ [Email Error] Could not send to ${toEmail}:`, error.message);
        // We log clearly for debugging
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendOtpEmail
};
