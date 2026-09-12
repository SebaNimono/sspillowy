"""
Muestra intencionalmente vulnerable para Semgrep + GitLeaks
(cuando el clone del repo remoto falla o para demos locales).
"""

import os
import sqlite3


# CWE-798: credencial hardcodeada (GitLeaks / Semgrep)
AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
DB_PASSWORD = "SuperSecretPassword123!"
# GitHub PAT ficticio con forma detectable por GitLeaks
GITHUB_TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz0123456789ABCD"
# Stripe live-like (demo)
STRIPE_KEY = "sk_live_51HuxDemoKeyForGitleaksScan000000000"


def search_users(user_input: str):
    # CWE-89: SQL Injection por concatenación
    conn = sqlite3.connect("users.db")
    cur = conn.cursor()
    query = "SELECT * FROM users WHERE name = '" + user_input + "';"
    cur.execute(query)
    return cur.fetchall()


def run_command(filename: str):
    # CWE-78: command injection
    os.system("cat " + filename)


def get_token():
    # secreto en código
    return STRIPE_KEY
