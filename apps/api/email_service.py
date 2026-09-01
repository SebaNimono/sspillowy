"""Envío de correos (Resend API o SMTP). Sin configuración, solo registra en logs."""

from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

def _resend_key() -> str:
    return os.getenv("RESEND_API_KEY", "").strip()


def _smtp_ready() -> bool:
    return bool(
        os.getenv("SMTP_HOST", "").strip()
        and os.getenv("SMTP_USER", "").strip()
        and os.getenv("SMTP_PASSWORD", "").strip()
    )


def mailer_configured() -> bool:
    return bool(_resend_key() or _smtp_ready())


def mailer_status() -> str:
    if _resend_key():
        return "resend"
    if _smtp_ready():
        return "smtp"
    return "none"


def email_from() -> str:
    return os.getenv("EMAIL_FROM", "SSPILLOWY <noreply@sspillowy.com>").strip()


def _verification_html(name: str, verify_url: str) -> str:
    return f"""
<!DOCTYPE html>
<html lang="es">
<body style="font-family: system-ui, sans-serif; color: #1f2328; line-height: 1.5;">
  <p>Hola {name},</p>
  <p>Confirma tu correo para activar tu cuenta en <strong>SSPILLOWY</strong>:</p>
  <p><a href="{verify_url}" style="display:inline-block;padding:10px 16px;background:#1a7f37;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Verificar correo</a></p>
  <p style="font-size:0.85rem;color:#656d76;">Si no creaste esta cuenta, ignora este mensaje. El enlace caduca en 24 horas.</p>
  <p style="font-size:0.8rem;color:#8c959f;">{verify_url}</p>
</body>
</html>
"""


async def send_verification_email(*, to: str, name: str, verify_url: str) -> bool:
    subject = "Verifica tu correo — SSPILLOWY"
    html = _verification_html(name, verify_url)
    text = f"Hola {name},\n\nVerifica tu cuenta: {verify_url}\n\nEl enlace caduca en 24 horas."

    if _resend_key():
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {_resend_key()}"},
                    json={"from": email_from(), "to": [to], "subject": subject, "html": html, "text": text},
                )
            if res.status_code in (200, 201):
                return True
            print(f"[sspillowy] Resend error {res.status_code}: {res.text[:200]}")
        except Exception as exc:
            print(f"[sspillowy] Resend failed: {exc}")
        return False

    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes")

    if smtp_host and smtp_user and smtp_password:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = email_from()
            msg["To"] = to
            msg.attach(MIMEText(text, "plain", "utf-8"))
            msg.attach(MIMEText(html, "html", "utf-8"))

            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                if smtp_use_tls:
                    server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_user, [to], msg.as_string())
            return True
        except Exception as exc:
            print(f"[sspillowy] SMTP failed: {exc}")
        return False

    print(f"[sspillowy] Email no configurado. Enlace de verificación para {to}: {verify_url}")
    return False
