FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/home/appuser

WORKDIR /app

ARG GITLEAKS_VERSION=8.21.2
# v0.58.2 no existe en GitHub → 404 HTML → "gzip: not in gzip format"
ARG TRIVY_VERSION=0.74.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
      -o /tmp/gitleaks.tgz \
    && tar -xzf /tmp/gitleaks.tgz -C /usr/local/bin gitleaks \
    && chmod +x /usr/local/bin/gitleaks \
    && gitleaks version \
    && curl -fsSL "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz" \
      -o /tmp/trivy.tgz \
    && tar -xzf /tmp/trivy.tgz -C /usr/local/bin trivy \
    && chmod +x /usr/local/bin/trivy \
    && trivy --version \
    && rm -f /tmp/gitleaks.tgz /tmp/trivy.tgz \
    && useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser

COPY apps/api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt \
    && pip install --no-cache-dir "semgrep>=1.80.0"

COPY . /app
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-8000}/health" || exit 1

CMD ["sh", "-c", "uvicorn apps.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
