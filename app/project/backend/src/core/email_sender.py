import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from src.core.config import settings


def _send_sync(to: str, subject: str, html: str):
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"[EMAIL] SMTP not configured — would send to {to}: {subject}")
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = settings.SMTP_USER
    msg["To"]      = to
    msg.attach(MIMEText(html, "html"))
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as s:
        s.starttls()
        s.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        s.sendmail(settings.SMTP_USER, to, msg.as_string())


async def send_email(to: str, subject: str, html: str):
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _send_sync, to, subject, html)


async def send_reset_code_email(to: str, code: str):
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;background:#f8fafc;border-radius:16px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,#2563eb,#0891b2);border-radius:14px;display:inline-flex;align-items:center;justify-content:center">
          <span style="font-size:26px;color:#fff">🔑</span>
        </div>
      </div>
      <h2 style="color:#0f172a;text-align:center;margin:0 0 8px">إعادة تعيين كلمة المرور</h2>
      <p style="color:#64748b;text-align:center;margin:0 0 28px;font-size:15px">
        استخدم الكود أدناه لإعادة تعيين كلمة مرورك.
      </p>
      <div style="text-align:center;margin-bottom:28px">
        <div style="display:inline-block;padding:18px 40px;background:#0f172a;border-radius:14px;letter-spacing:10px;font-size:28px;font-weight:bold;color:#60a5fa;font-family:monospace">
          {code}
        </div>
      </div>
      <p style="color:#94a3b8;text-align:center;font-size:12px">
        صالح لمدة 15 دقيقة فقط. إن لم تطلب هذا، تجاهل الرسالة.
      </p>
    </div>
    """
    await send_email(to, "كود إعادة تعيين كلمة مرور ExamGen", html)


async def send_verification_email(to: str, token: str):
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;background:#f8fafc;border-radius:16px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,#2563eb,#0891b2);border-radius:14px;display:inline-flex;align-items:center;justify-content:center">
          <span style="font-size:26px">✉</span>
        </div>
      </div>
      <h2 style="color:#0f172a;text-align:center;margin:0 0 8px">تحقق من بريدك الإلكتروني</h2>
      <p style="color:#64748b;text-align:center;margin:0 0 32px;font-size:15px">
        شكراً لتسجيلك في ExamGen. اضغط الزر أدناه لتفعيل حسابك.
      </p>
      <div style="text-align:center;margin-bottom:32px">
        <a href="{link}"
           style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#2563eb,#0891b2);color:#fff;text-decoration:none;border-radius:10px;font-weight:bold;font-size:15px">
          تفعيل الحساب
        </a>
      </div>
      <p style="color:#94a3b8;text-align:center;font-size:12px">
        الرابط صالح لمدة 24 ساعة. إن لم تطلب هذا، يمكنك تجاهل الرسالة.
      </p>
    </div>
    """
    await send_email(to, "تفعيل حساب ExamGen", html)
