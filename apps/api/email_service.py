"""Envío de correos (Resend API o SMTP). Sin configuración, solo registra en logs."""

from __future__ import annotations

import html
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import httpx
from dotenv import load_dotenv

from obs_metrics import Timer

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
    safe_name = html.escape(name)
    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8fa;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border:1px solid #d0d7de;border-radius:10px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid #d0d7de;background:#ffffff;">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:#656d76;text-transform:uppercase;">Web Hub · DevSecOps</span><br>
            <span style="font-size:18px;font-weight:700;color:#1f2328;letter-spacing:-0.02em;">SSPILLOWY</span>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 12px;font-size:15px;color:#1f2328;">Hola {safe_name},</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#656d76;">
              Confirma tu correo para activar el acceso a la consola de gobernanza de seguridad.
              Hasta entonces no podrás iniciar sesión con contraseña.
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0">
              <tr>
                <td style="border-radius:6px;background:#1a7f37;">
                  <a href="{verify_url}" style="display:inline-block;padding:11px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Verificar correo
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#8c959f;">
              El enlace caduca en 24 horas. Si no creaste esta cuenta, ignora este mensaje.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px;border-top:1px solid #d0d7de;background:#f6f8fa;">
            <p style="margin:0;font-size:11px;color:#8c959f;">
              SSPILLOWY · Software Security Platform<br>
              <a href="https://sspillowy.com" style="color:#0969da;text-decoration:none;">sspillowy.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _verification_text(name: str, verify_url: str) -> str:
    return f"""Hola {name},

Confirma tu correo para activar tu cuenta en SSPILLOWY (Web Hub DevSecOps).

Verificar: {verify_url}

El enlace caduca en 24 horas. Si no creaste esta cuenta, ignora este mensaje.

— SSPILLOWY
https://sspillowy.com
"""


def send_email_sync(*, to: str, subject: str, text: str, html_body: str) -> bool:
    """Envío síncrono (Resend o SMTP). Usable desde jobs en background."""
    if not mailer_configured():
        return _deliver(to=to, subject=subject, text=text, html_body=html_body)
    with Timer("email", "send") as t:
        ok = _deliver(to=to, subject=subject, text=text, html_body=html_body)
        t.error = not ok
    return ok


def _deliver(*, to: str, subject: str, text: str, html_body: str) -> bool:
    if _resend_key():
        try:
            res = httpx.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {_resend_key()}"},
                json={"from": email_from(), "to": [to], "subject": subject, "html": html_body, "text": text},
                timeout=20.0,
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
            msg.attach(MIMEText(html_body, "html", "utf-8"))

            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                if smtp_use_tls:
                    server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_user, [to], msg.as_string())
            return True
        except Exception as exc:
            print(f"[sspillowy] SMTP failed: {exc}")
        return False

    print(f"[sspillowy] Email no configurado. Asunto={subject!r} to={to}")
    return False


def alert_recipients() -> list[str]:
    raw = os.getenv("SECURITY_ALERT_EMAILS", "").strip()
    if not raw:
        raw = os.getenv("PILLOW_ADMIN_EMAILS", "").strip()
    return [e.strip().lower() for e in raw.split(",") if e.strip()]


def send_security_alert(
    *,
    recipients: list[str],
    repo_name: str,
    decision: str,
    summary: str,
    reasons: list[str] | None = None,
    open_secrets: int = 0,
    frontend_url: str | None = None,
) -> int:
    """Alerta GATE_BLOCK / secretos a los responsables del espacio. Devuelve cuántos correos se enviaron."""
    if not recipients:
        print("[sspillowy] el espacio no tiene responsables — no se envía alerta de gate.")
        return 0

    hub = (frontend_url or os.getenv("FRONTEND_URL", "https://sspillowy.com")).rstrip("/")
    reason_lines = "\n".join(f"• {r}" for r in (reasons or [])) or "• (sin detalle)"
    subject = f"[SSPILLOWY] Gate {decision} — {repo_name}"
    text = f"""Alerta de Security Gate

Repositorio: {repo_name}
Decisión: {decision}
Resumen: {summary}
Secretos abiertos (GitLeaks): {open_secrets}

Motivos:
{reason_lines}

Consola: {hub}

— SSPILLOWY Hub
"""
    safe_repo = html.escape(repo_name)
    safe_summary = html.escape(summary)
    reasons_html = "".join(f"<li>{html.escape(r)}</li>" for r in (reasons or [])) or "<li>(sin detalle)</li>"
    html_body = f"""<!DOCTYPE html>
<html lang="es"><body style="font-family:system-ui,sans-serif;color:#1f2328;">
  <h2 style="margin:0 0 12px;">Security Gate · {html.escape(decision)}</h2>
  <p><strong>Repo:</strong> {safe_repo}</p>
  <p><strong>Resumen:</strong> {safe_summary}</p>
  <p><strong>Secretos abiertos:</strong> {open_secrets}</p>
  <ul>{reasons_html}</ul>
  <p><a href="{html.escape(hub)}">Abrir consola SSPILLOWY</a></p>
</body></html>"""

    sent = 0
    for to in recipients:
        if send_email_sync(to=to, subject=subject, text=text, html_body=html_body):
            sent += 1
    return sent


async def send_verification_email(*, to: str, name: str, verify_url: str) -> bool:
    subject = "Confirma tu acceso — SSPILLOWY"
    html_body = _verification_html(name, verify_url)
    text = _verification_text(name, verify_url)
    ok = send_email_sync(to=to, subject=subject, text=text, html_body=html_body)
    if not ok and not mailer_configured():
        print(f"[sspillowy] Email no configurado. Enlace de verificación para {to}: {verify_url}")
    return ok


def _password_reset_html(name: str, reset_url: str) -> str:
    safe_name = html.escape(name)
    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8fa;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border:1px solid #d0d7de;border-radius:10px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid #d0d7de;background:#ffffff;">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:#656d76;text-transform:uppercase;">Web Hub · DevSecOps</span><br>
            <span style="font-size:18px;font-weight:700;color:#1f2328;letter-spacing:-0.02em;">SSPILLOWY</span>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 12px;font-size:15px;color:#1f2328;">Hola {safe_name},</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#656d76;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta.
              Si no fuiste tú, ignora este mensaje; tu contraseña no cambiará.
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0">
              <tr>
                <td style="border-radius:6px;background:#1a7f37;">
                  <a href="{reset_url}" style="display:inline-block;padding:11px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Restablecer contraseña
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#8c959f;">
              El enlace caduca en 1 hora por seguridad.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px;border-top:1px solid #d0d7de;background:#f6f8fa;">
            <p style="margin:0;font-size:11px;color:#8c959f;">
              SSPILLOWY · Software Security Platform<br>
              <a href="https://sspillowy.com" style="color:#0969da;text-decoration:none;">sspillowy.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _password_reset_text(name: str, reset_url: str) -> str:
    return f"""Hola {name},

Restablece tu contraseña de SSPILLOWY:

{reset_url}

El enlace caduca en 1 hora. Si no solicitaste esto, ignora el mensaje.

— SSPILLOWY
https://sspillowy.com
"""


async def send_password_reset_email(*, to: str, name: str, reset_url: str) -> bool:
    subject = "Restablece tu contraseña — SSPILLOWY"
    html_body = _password_reset_html(name, reset_url)
    text = _password_reset_text(name, reset_url)
    ok = send_email_sync(to=to, subject=subject, text=text, html_body=html_body)
    if not ok and not mailer_configured():
        print(f"[sspillowy] Email no configurado. Enlace de reset para {to}: {reset_url}")
    return ok
