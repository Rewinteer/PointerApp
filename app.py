from flask import Flask, redirect, render_template, jsonify, request
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
    cur.close()
    conn.close()

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

@app.route("/pointData", methods=["POST"])
def pointData():
    conn = get_db_connection()
    cur = conn.cursor()
    id = request.get_json().get('id')

    cur.execute("SELECT id, user_id, attributes FROM points WHERE id=%s;", (id,))
    dbresponse = cur.fetchall()[0]
    responseToSend = {
        'id': dbresponse[0],
        'user_id': dbresponse[1],
        'attributes': dbresponse[2]
    }

    cur.close()
    conn.close()

    return jsonify(responseToSend)

@app.route("/removePoint", methods=["POST"])
def removePoint():
    conn = get_db_connection()
    cur = conn.cursor()
    id = request.get_json().get('id')

    # TODO implement user checking by ID
    cur.execute("DELETE FROM points WHERE id=%s;", (id,))
    conn.commit()
    cur.close()
    conn.close()
    print("Removal")
    return redirect("/")

# INSERT INTO points(location, user_id, attributes) VALUES (ST_GeomFromText('POINT(54.258 -1.885)'), 0, '{"test": "test"}');