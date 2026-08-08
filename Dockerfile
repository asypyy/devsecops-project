FROM python:3.12-alpine

WORKDIR /app

# Install build dependencies required for compiling bcrypt extension on Alpine
RUN apk add --no-cache gcc musl-dev libffi-dev

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY main.py .

RUN adduser -D -H -u 1000 appuser 
USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
