from flask import Flask, redirect, render_template, jsonify
import os
import psycopg2
import json

app = Flask(__name__)
app.debug = True

def get_db_connection():
    conn = psycopg2.connect(
        host="localhost",
        database="test",
        user=os.environ['DB_USERNAME'],
        password=os.environ['DB_PASSWORD'])
    return conn

@app.route("/")
def index():
    return render_template("map.html")

@app.route("/points")
def points():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT id, ST_AsGeoJSON(ST_FlipCoordinates(location)), user_id, attributes FROM points;')
    rows = cur.fetchall()

    features = []
    for row in rows:
        feature = {
            "type": "Feature",
            "properties": {
                "id": row[0], 
                "user_id": row[2],
                "attributes": row[3]
            },
            "geometry": json.loads(row[1])
        }
        features.append(feature)
    
    result = {
        "type": "FeatureCollection",
        "features": features
    }

    return jsonify(result)