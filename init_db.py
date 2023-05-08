import os
import psycopg2

conn = psycopg2.connect(
    host="localhost",
    database="test",
    user=os.environ['DB_USERNAME'],
    password=os.environ['DB_PASSWORD']
)

cur = conn.cursor()