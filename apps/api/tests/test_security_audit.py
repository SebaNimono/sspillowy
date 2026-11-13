import asyncio
import contextlib
import io
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import email_service
import fix_intel
import gate_bypass
from models import Base, Finding, GateBypassRequest, Repository, Scan, Workspace


class SecurityAuditRegressionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()
        self.now = datetime.now(timezone.utc)

        ws = Workspace(
            id="ws-1",
            name="Test WS",
            created_at=self.now,
        )
        repo = Repository(
            id="repo-1",
            workspace_id="ws-1",
            name="api-repo",
            url="https://github.com/org/api",
            branch="main",
            is_active=True,
            created_at=self.now,
        )
        self.db.add_all([ws, repo])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_punto_2_carry_forward_triage_branch_and_evidence_isolation(self):
        s_old = Scan(
            id="scan-old",
            repository_id="repo-1",
            status="COMPLETED",
            branch="main",
            commit_sha="11111111",
            created_at=self.now - timedelta(hours=2),
        )
        s_other_branch = Scan(
            id="scan-dev",
            repository_id="repo-1",
            status="COMPLETED",
            branch="feature/x",
            commit_sha="22222222",
            created_at=self.now - timedelta(hours=1),
        )
        s_same_branch = Scan(
            id="scan-main",
            repository_id="repo-1",
            status="COMPLETED",
            branch="main",
            commit_sha="33333333",
            created_at=self.now,
        )
        self.db.add_all([s_old, s_other_branch, s_same_branch])

        f_closed = Finding(
            id="f-1",
            repository_id="repo-1",
            scan_id="scan-old",
            engine="semgrep",
            title="sql-injection",
            severity="CRITICAL",
            file_path="app.py",
            line_number=42,
            cwe="CWE-89",
            description="Unsanitized SQL query",
            status="FALSE_POSITIVE", ai_triaged=True, ai_verdict="FALSE_POSITIVE",
            ai_summary="Validado manualmente",
            created_at=self.now - timedelta(hours=2),
        )
        f_diff_branch = Finding(
            id="f-2",
            repository_id="repo-1",
            scan_id="scan-dev",
            engine="semgrep",
            title="sql-injection",
            severity="CRITICAL",
            file_path="app.py",
            line_number=42,
            cwe="CWE-89",
            description="Unsanitized SQL query",
            status="OPEN",
            created_at=self.now - timedelta(hours=1),
        )
        f_same_branch = Finding(
            id="f-3",
            repository_id="repo-1",
            scan_id="scan-main",
            engine="semgrep",
            title="sql-injection",
            severity="CRITICAL",
            file_path="app.py",
            line_number=42,
            cwe="CWE-89",
            description="Unsanitized SQL query",
            status="OPEN",
            created_at=self.now,
        )
        self.db.add_all([f_closed, f_diff_branch, f_same_branch])
        self.db.commit()

        fix_intel.carry_forward_triage(self.db, repo_id="repo-1", scan_id="scan-dev"); self.db.flush()
        self.assertEqual(f_diff_branch.status, "OPEN")

        fix_intel.carry_forward_triage(self.db, repo_id="repo-1", scan_id="scan-main"); self.db.flush()
        self.assertEqual(f_same_branch.status, "FALSE_POSITIVE")

    def test_punto_3_password_reset_log_redaction(self):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            asyncio.run(email_service.send_password_reset_email(to="user@test.com", name="Test User", reset_url="https://app.sspillowy.com/reset?token=SECRET_TOKEN_XYZ"))
        self.assertNotIn("SECRET_TOKEN_XYZ", buf.getvalue())

    def test_punto_4_bypass_ttl_and_context_change_guard(self):
        scan = Scan(
            id="scan-latest",
            repository_id="repo-1",
            status="COMPLETED",
            branch="main",
            commit_sha="33333333",
            created_at=self.now,
        )
        stale_req = GateBypassRequest(
            id="byp-stale",
            workspace_id="ws-1",
            repository_id="repo-1",
            reason="Emergencia antigua",
            status="PENDING",
            requested_by="dev@test.com",
            expires_at=self.now + timedelta(hours=24),
            created_at=self.now - timedelta(hours=10),
        )
        active_req = GateBypassRequest(
            id="byp-ctx",
            workspace_id="ws-1",
            repository_id="repo-1",
            reason="Hotfix reciente",
            status="PENDING",
            requested_by="dev@test.com",
            expires_at=self.now + timedelta(hours=24),
            created_at=self.now - timedelta(minutes=10),
        )
        self.db.add_all([scan, stale_req, active_req])
        self.db.commit()

        expired = gate_bypass.expire_stale_bypasses(self.db)
        self.db.commit()
        self.db.refresh(stale_req)
        self.assertGreaterEqual(expired, 1)
        self.assertEqual(stale_req.status, "EXPIRED")

        session_factory = self.Session

        class DummyWs:
            id = "ws-1"
            email = "ciso@test.com"
            can_manage = True

            def session(self_inner):
                return session_factory()

        with self.assertRaises(HTTPException) as ctx:
            gate_bypass.approve_bypass(
                "byp-ctx",
                gate_bypass.BypassDecision(note="Sin confirmar commit"),
                DummyWs(),
            )
        self.assertEqual(ctx.exception.status_code, 409)

        res = gate_bypass.approve_bypass(
            "byp-ctx",
            gate_bypass.BypassDecision(
                note="Revisado",
                expected_commit_sha="33333333",
                acknowledge_context_change=True,
            ),
            DummyWs(),
        )
        self.assertEqual(res.status, "APPROVED")



    def test_punto_6_oauth_session_idor_protection(self):
        from unittest.mock import patch
        from fastapi import HTTPException
        import oauth_common

        fake_session = {"token": "valid_owner_token_123", "user": {"email": "owner@sspillowy.com"}}

        with patch.object(oauth_common, "load_session", return_value=fake_session), \
             patch.object(oauth_common, "delete_session") as mock_delete:
            # 1) Sin token Bearer -> 403 Forbidden
            with self.assertRaises(HTTPException) as ctx_no_auth:
                oauth_common.get_auth_session("sess-abc", authorization=None)
            self.assertEqual(ctx_no_auth.exception.status_code, 403)

            # 2) Con token de otro usuario -> 403 Forbidden
            with self.assertRaises(HTTPException) as ctx_wrong:
                oauth_common.get_auth_session("sess-abc", authorization="Bearer attacker_token_999")
            self.assertEqual(ctx_wrong.exception.status_code, 403)

            # 3) Logout ajeno con token inválido -> 403 Forbidden y NO borra la sesión
            with self.assertRaises(HTTPException) as ctx_logout:
                oauth_common.logout(x_session_id="sess-abc", authorization="Bearer attacker_token_999")
            self.assertEqual(ctx_logout.exception.status_code, 403)
            mock_delete.assert_not_called()

            # 4) Dueño legítimo -> 200 OK
            res = oauth_common.get_auth_session("sess-abc", authorization="Bearer valid_owner_token_123")
            self.assertEqual(res["user"]["email"], "owner@sspillowy.com")

            out = oauth_common.logout(x_session_id="sess-abc", authorization="Bearer valid_owner_token_123")
            self.assertEqual(out, {"ok": True})
            mock_delete.assert_called_once_with("sess-abc")

    def test_punto_7_rate_limiter_sliding_window_429(self):
        from starlette.requests import Request
        from starlette.responses import JSONResponse
        import rate_limit

        rate_limit._BUCKETS.clear()

        def make_request(ip: str, path: str = "/api/v1/auth/login") -> Request:
            scope = {
                "type": "http",
                "method": "POST",
                "path": path,
                "headers": [(b"x-forwarded-for", ip.encode())],
                "client": (ip, 12345),
            }
            return Request(scope)

        async def ok_next(_req):
            return JSONResponse({"ok": True}, status_code=200)

        async def run_scenario():
            # Primeras 10 peticiones desde la misma IP pasan (límite = 10/60s para /login)
            for _ in range(10):
                resp = await rate_limit.rate_limit_middleware(make_request("203.0.113.10"), ok_next)
                self.assertEqual(resp.status_code, 200)

            # Petición 11 desde la misma IP -> 429 Too Many Requests con Retry-After
            blocked = await rate_limit.rate_limit_middleware(make_request("203.0.113.10"), ok_next)
            self.assertEqual(blocked.status_code, 429)
            self.assertIn("retry-after", blocked.headers)

            # Otra IP independiente sigue operando normalmente
            other_ip = await rate_limit.rate_limit_middleware(make_request("203.0.113.99"), ok_next)
            self.assertEqual(other_ip.status_code, 200)

        asyncio.run(run_scenario())


    def test_punto_8_delete_account_endpoint(self):
        import oauth_common
        from fastapi import HTTPException
        oauth_common.SESSIONS["sess-del-1"] = {
            "user_id": "u-del-99",
            "email": "delete.me@sspillowy.io",
            "token": "owner_secret_token_xyz", "expires_at": "2099-01-01T00:00:00+00:00",
        }
        with self.assertRaises(HTTPException) as ctx_forbidden:
            oauth_common.delete_current_account(
                x_session_id="sess-del-1",
                authorization="Bearer wrong_attacker_token",
            )
        self.assertEqual(ctx_forbidden.exception.status_code, 403)
        self.assertIn("sess-del-1", oauth_common.SESSIONS)

        res = oauth_common.delete_current_account(
            x_session_id="sess-del-1",
            authorization="Bearer owner_secret_token_xyz",
        )
        self.assertTrue(res.get("ok"))
        self.assertTrue(res.get("deleted"))
        self.assertNotIn("sess-del-1", oauth_common.SESSIONS)

if __name__ == "__main__":
    unittest.main(verbosity=2)











