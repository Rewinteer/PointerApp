import os
import psycopg2
import json
import tempfile

from flask import Flask, redirect, render_template, jsonify, request, session, flash, send_file
from flask_session import Session
from werkzeug.security import check_password_hash, generate_password_hash

from helpers import login_required, get_db_connection, usernameAlreadyExists, getDbRows, executeQuery, getFeatureCollection

app = Flask(__name__)
app.secret_key = os.environ["SECRET_KEY"]

# configure session
app.config["SESSION_PERMANENT"] = True
# set session lifetime to 14 days
app.config["PERMANENT_SESSION_LIFETIME"] = 1209600
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

if __name__ == '__main__':
    app.run(debug=True, port=8000, host='127.0.0.1')


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username")
        if 1 > len(username) > 255:
            flash('Incorrect username length', 'error')
            return "Incorrect username length"
        
        already_exists = usernameAlreadyExists(username)
        if already_exists != None and already_exists:
            flash('Username already exists, choose another one' 'error')
            return redirect("/register")
        elif already_exists == None:
            flash('Database error, please submit one more time', 'error')
            return redirect("/register")
        
        password = request.form.get("password")
        confirmation = request.form.get("confirmation")

        if len(password) < 6:
            flash('Password should consist at least of 6 characters.')
            return redirect("/register")
        elif password != confirmation:
            flash("Passwords in the form don't match")
            return redirect("/register")
        
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute('INSERT INTO users(username, hash) VALUES (%s, %s)', (username, generate_password_hash(password)))
            conn.commit()
            cur.close()
            conn.close()
            flash('Success', 'success')
            return redirect("/login")
        except psycopg2.Error as e:
            error_message = str(e)
            cur.close()
            conn.close()
            flash(error_message, 'error')
            return redirect("/register")


    else:
        return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    session.clear()

    if request.method == "POST":
        if not request.form.get("username"):
            flash('Must provide username', 'error')
            return redirect("/login")
        elif not request.form.get("password"):
            flash('Must provide password', 'error')
            return redirect("/login")
        
        rows = getDbRows("SELECT * FROM users WHERE username = %s", (request.form.get("username"), ))

        if rows is None:
            flash('Database error. Please try one more time', 'error')
            return redirect("/login")
        elif len(rows) != 1 or not check_password_hash(rows[0][2], request.form.get("password")):
            flash('Invalid username and/or password', 'error')
            return redirect("/login")
        
        session["user_id"] = rows[0][0]
        return redirect("/")
    
    else:
        return render_template("login.html")

@app.route("/logout")
@login_required
def logout():
    session.clear()
    return redirect("/")

@app.route("/")
@login_required
def index():
    return render_template("map.html")    

@app.route("/points")
@login_required
def points():
    rows = getDbRows('SELECT id, ST_AsGeoJSON(ST_FlipCoordinates(location)), attributes, is_completed FROM points WHERE user_id = %s;', (session["user_id"],))
    if rows is None:
        return "Database error", 500

    features = []
    for row in rows:
        feature = {
            "type": "Feature",
            "properties": {
                "id": row[0], 
                "attributes": row[2],
                "is_completed": row[3]
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
@login_required
def pointData():
    id = request.get_json().get('id')
    rows = getDbRows("SELECT id, user_id, attributes, is_completed FROM points WHERE id=%s AND user_id=%s;", (id,session["user_id"]))
    if rows is None:
        return "Database error", 500
    
    dbresponse = rows[0]
    responseToSend = {
        'id': dbresponse[0],
        'user_id': dbresponse[1],
        'attributes': dbresponse[2],
        'is_completed': dbresponse[3]
    }

    return jsonify(responseToSend)

@app.route("/removePoint", methods=["POST"])
@login_required
def removePoint():
    id = request.get_json().get('id')
    user_id = session["user_id"]

    # user_id check
    rows = getDbRows('SELECT user_id FROM points WHERE id=%s', (id,))
    if rows is None:
        return "Database error, please try one more time", 500
    elif user_id != rows[0][0]:
        return "Wrong point ID", 400

    execute = executeQuery("DELETE FROM points WHERE id=%s;", (id,))
    if execute == 1:
        return "Database error, please try one more time", 500

    return "Point removed"

@app.route("/saveEdits", methods=["POST"])
@login_required
def saveEdits():
    id = request.get_json().get('id')
    attributes = request.get_json().get('attributes')
    location = json.loads(request.get_json().get('location'))
    is_completed = request.get_json().get('is_completed')

    if id != 'null':
        execute = executeQuery('UPDATE points SET attributes = %s, is_completed = %s, modified = current_timestamp WHERE id = %s AND user_id = %s;', (attributes, is_completed, id, session["user_id"]))
        if execute == 1:
            return "Database error, please try one more time", 500
    # new points creation
    else:
        execute = executeQuery("INSERT INTO points(location, user_id, attributes, is_completed) VALUES (ST_GeomFromText('POINT(%s %s)'), %s, %s, %s);", (location['lat'], location['lng'], session["user_id"], attributes, is_completed))
        if execute == 1:
            return "Database error, please try one more time", 500

    
    return "Success"

@app.route("/pointList")
@login_required
def pointList():
    rows = getDbRows("SELECT id, attributes, is_completed FROM points WHERE user_id = %s ORDER BY id;", (session["user_id"], ))
    if rows is None:
        return "Database error, please try one more time", 500
    
    pointsData = rows

    return render_template("list.html", pointsData=pointsData)

@app.route("/listPointsUpdate", methods=["POST"])
@login_required
def listPointUpdate():
    newData = request.get_json()
    attributesData = newData.get('attributes')
    completenessData = newData.get('is_completed')

    dbQuery = ""
    for id in attributesData:
        attributes = json.dumps(attributesData[id])
        is_completed = completenessData[id]
        query = "UPDATE points SET attributes = '%s', is_completed = %s, modified = current_timestamp WHERE id = %s AND user_id = %s; " % (attributes, is_completed, id, session["user_id"])
        dbQuery += query

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(dbQuery)
        conn.commit()
        cur.close()
        conn.close()
        return "Data successfully updated"
    except:
        return "Database error, please try one more time", 500


@app.route("/removeAllPoints", methods=["POST"])
@login_required
def removeAllPoints():    
    execute = executeQuery("DELETE FROM points WHERE user_id = %s;", (session["user_id"],))
    if execute == 1:
        return "Database error, please try one more time", 500

    return "Data successfully removed"

@app.route("/exportData", methods=["POST"])
@login_required
def exportData():
    rows = getDbRows("SELECT id, ST_X(ST_FlipCoordinates(location)), ST_Y(ST_FlipCoordinates(location)), attributes, is_completed, CAST(modified as TEXT) FROM points WHERE user_id=%s;", (session["user_id"],))
    if rows is None:
        return "Database error", 500
    
    try:
        data = getFeatureCollection(rows)
        temp_file_path = tempfile.mkstemp(suffix='.json')[1]
        with open(temp_file_path, 'w') as file:
            file.write(jsonify(data).get_data(as_text=True))

        content_type = 'application/json'
        return send_file(temp_file_path, mimetype=content_type, as_attachment=True, download_name='points.geojson')
    except:
        return "Server error", 500
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)