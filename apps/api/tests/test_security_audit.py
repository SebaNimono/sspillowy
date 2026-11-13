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


if __name__ == "__main__":
    unittest.main(verbosity=2)






