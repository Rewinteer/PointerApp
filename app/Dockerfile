FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install -r requirements.txt

COPY . .

EXPOSE 5001

CMD ["gunicorn", "--workers=1", "--threads=2", "--bind=0.0.0.0:5001", "app:app"]
