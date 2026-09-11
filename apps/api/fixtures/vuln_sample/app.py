"""
Muestra intencionalmente vulnerable para Semgrep
(cuando el clone del repo remoto falla o para demos locales).
"""

import os
import sqlite3


# CWE-798: credencial hardcodeada
AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE"
DB_PASSWORD = "SuperSecretPassword123!"


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
    return "sk_live_51HxxxxxxxxDEMO"
