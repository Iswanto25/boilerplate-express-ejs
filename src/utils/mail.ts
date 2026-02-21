interface EmailTemplateOptions {
	userName?: string;
	appName?: string;
	title: string;
	greeting?: string;
	mainMessage: string;
	additionalInfo?: string;
	actionContent?: string;
	warningMessage?: string;
	footerMessage?: string;
}

export function generateEmailTemplate(options: EmailTemplateOptions): string {
	const {
		userName = "User",
		appName = process.env.APP_NAME || "Our App",
		title,
		greeting,
		mainMessage,
		additionalInfo,
		actionContent,
		warningMessage,
		footerMessage,
	} = options;

	const greetingText = greeting || `Halo <strong>${userName}</strong>,`;
	const footer = footerMessage || `Email ini dikirim otomatis oleh sistem ${appName}.`;

	return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} - ${appName}</title>
</head>
<body style="font-family: sans-serif; background-color: #f6f9fc; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px;">
    <h2>${appName}</h2>
    <p>${greetingText}</p>
    <p>${mainMessage}</p>
    ${actionContent ? `<div style="background: #f0f4ff; padding: 10px; text-align: center; font-size: 24px; letter-spacing: 5px;">${actionContent}</div>` : ""}
    <p>Terima kasih,<br>Tim ${appName}</p>
    <div style="font-size: 12px; color: #888; margin-top: 20px;">${footer}</div>
  </div>
</body>
</html>
`;
}

export function generateOTPEmail(userName: string, otp: string): string {
	return generateEmailTemplate({
		userName,
		title: "Reset Password",
		mainMessage: "Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda.",
		additionalInfo: "Gunakan kode OTP berikut untuk melanjutkan proses reset password:",
		actionContent: otp,
	});
}
