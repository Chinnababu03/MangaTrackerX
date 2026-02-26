# ─── Build stage ──────────────────────────────────────────────────────────────
FROM python:3.13-slim AS builder

WORKDIR /app
COPY api/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt


# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM python:3.13-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy only the application code needed at runtime
COPY api/ ./api/
COPY src/utilities/database_connection.py ./src/utilities/database_connection.py
COPY src/__init__.py ./src/__init__.py
COPY src/utilities/__init__.py ./src/utilities/__init__.py

# Cloud Run injects PORT env var — default to 8080
ENV PORT=8080

CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]
