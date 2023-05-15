from flask import Flask, redirect, render_template, jsonify, request
import os
import psycopg2
import json

app = Flask(__name__)
app.debug = True

# TODO DB query execution in the separate function
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
    # WHERE user_id = ?
    cur.execute('SELECT id, ST_AsGeoJSON(ST_FlipCoordinates(location)), user_id, attributes, is_completed FROM points;')
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
                "attributes": row[3],
                "is_completed": row[4]
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
    # WHERE user_id = ?
    cur.execute("SELECT id, user_id, attributes, is_completed FROM points WHERE id=%s;", (id,))
    dbresponse = cur.fetchall()[0]
    responseToSend = {
        'id': dbresponse[0],
        'user_id': dbresponse[1],
        'attributes': dbresponse[2],
        'is_completed': dbresponse[3]
    }

    cur.close()
    conn.close()

    return jsonify(responseToSend)

@app.route("/removePoint", methods=["POST"])
def removePoint():
    conn = get_db_connection()
    cur = conn.cursor()
    id = request.get_json().get('id')

    # TODO implement user checking by ID to prevent other users points removal
    cur.execute("DELETE FROM points WHERE id=%s;", (id,))
    conn.commit()
    cur.close()
    conn.close()
    return "removed"

@app.route("/saveEdits", methods=["POST"])
def saveEdits():
    conn = get_db_connection()
    cur = conn.cursor()
    id = request.get_json().get('id')
    attributes = request.get_json().get('attributes')
    location = json.loads(request.get_json().get('location'))
    is_completed = request.get_json().get('is_completed')

    # update of existing points
    # WHERE user_id = ?
    if id != 'null':
        cur.execute('UPDATE points SET attributes = %s, is_completed = %s WHERE id = %s', (attributes, is_completed, id))
    # new points creation
    else:
        # WHERE user_id = ?
        cur.execute("INSERT INTO points(location, user_id, attributes, is_completed) VALUES (ST_GeomFromText('POINT(%s %s)'), 0, %s, %s);", (location['lat'], location['lng'], attributes, is_completed))
    
    conn.commit()
    cur.close()
    conn.close()
    return redirect("/")

@app.route("/pointList")
def pointList():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, attributes, is_completed FROM points WHERE user_id = 0 ORDER BY id;")
    pointsData = cur.fetchall()
    cur.close()
    conn.close()

    return render_template("list.html", pointsData=pointsData)

@app.route("/listPointsUpdate", methods=["POST"])
def listPointUpdate():
    newData = request.get_json()
    attributesData = newData.get('attributes')
    completenessData = newData.get('is_completed')
    print(newData)

    dbQuery = ""
    # TODO implement user_id check
    for id in attributesData:
        attributes = json.dumps(attributesData[id])
        is_completed = completenessData[id]
        query = "UPDATE points SET attributes = '%s', is_completed = %s WHERE id = %s; " % (attributes, is_completed, id)
        dbQuery += query

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(dbQuery)
    conn.commit()
    cur.close()
    conn.close()
    print(dbQuery)

    return redirect("/pointList")

@app.route("/removeAllPoints", methods=["POST"])
def removeAllPoints():
    # TODO user id validation
    user_id = 0
    dbQuery = "DELETE FROM points WHERE user_id = %s;" % (user_id)

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(dbQuery)
    conn.commit()
    cur.close()
    conn.close()

    return redirect("/pointList")
