import os
import psycopg2
import json
import tempfile

from flask import (
    Flask,
    redirect,
    render_template,
    jsonify,
    request,
    session,
    flash,
    send_file,
)
from flask_session import Session
from werkzeug.security import check_password_hash, generate_password_hash
from psycopg2 import sql

from helpers import (
    login_required,
    get_db_connection,
    usernameAlreadyExists,
    getDbRows,
    executeQuery,
    getFeatureCollection,
    passCurrentDataToHistory,
)

app = Flask(__name__)
app.secret_key = os.environ["SECRET_KEY"]

# configure session
app.config["SESSION_PERMANENT"] = True
# set session lifetime to 14 days
app.config["PERMANENT_SESSION_LIFETIME"] = 1209600
app.config["SESSION_TYPE"] = "filesystem"
Session(app)
# set max file size to 5 mb
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username")
        if 1 > len(username) > 255:
            flash("Incorrect username length", "error")
            return redirect("/register")

        already_exists = usernameAlreadyExists(username)
        if already_exists != None and already_exists:
            flash("Username already exists, choose another one" "error")
            return redirect("/register")
        elif already_exists == None:
            flash("Database error, please submit one more time", "error")
            return redirect("/register")

        password = request.form.get("password")
        confirmation = request.form.get("confirmation")

        if len(password) < 6:
            flash("Password should consist at least of 6 characters.")
            return redirect("/register")
        elif password != confirmation:
            flash("Passwords in the form don't match")
            return redirect("/register")

        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO users(username, hash) VALUES (%s, %s)",
                (username, generate_password_hash(password)),
            )
            conn.commit()
            cur.close()
            conn.close()
            flash("Success", "success")
            return redirect("/login")
        except psycopg2.Error as e:
            error_message = str(e)
            cur.close()
            conn.close()
            flash(error_message, "error")
            return redirect("/register")

    else:
        return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if session.get("user_id"):
        session.pop("user_id", None)

    if request.method == "POST":
        if not request.form.get("username"):
            flash("Must provide username", "error")
            return redirect("/login")
        elif not request.form.get("password"):
            flash("Must provide password", "error")
            return render_template("login.html")

        rows = getDbRows(
            "SELECT * FROM users WHERE username = %s", (request.form.get("username"),)
        )

        if rows is None:
            flash("Database error. Please try one more time", "error")
            return redirect("/login")
        elif len(rows) != 1 or not check_password_hash(
            rows[0][2], request.form.get("password")
        ):
            flash("Invalid username and/or password", "error")
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
    rows = getDbRows(
        """
    SELECT id, name, ST_AsGeoJSON(ST_FlipCoordinates(location)), attributes, is_completed 
    FROM points 
    WHERE user_id = %s;
    """,
        (session["user_id"],),
    )

    if rows is None:
        return "Database error", 500

    features = []
    for row in rows:
        feature = {
            "type": "Feature",
            "properties": {
                "id": row[0],
                "name": row[1],
                "attributes": row[3],
                "is_completed": row[4],
            },
            "geometry": json.loads(row[2]),
        }
        features.append(feature)

    result = {"type": "FeatureCollection", "features": features}

    return jsonify(result)


@app.route("/pointData", methods=["POST"])
@login_required
def pointData():
    id = request.get_json().get("id")
    rows = getDbRows(
        "SELECT id, name, user_id, attributes, is_completed FROM points WHERE id=%s AND user_id=%s;",
        (id, session["user_id"]),
    )
    if rows is None:
        return "Database error", 500

    dbresponse = rows[0]
    responseToSend = {
        "id": dbresponse[0],
        "name": dbresponse[1],
        "user_id": dbresponse[2],
        "attributes": dbresponse[3],
        "is_completed": dbresponse[4],
    }

    return jsonify(responseToSend)


@app.route("/removePoint", methods=["POST"])
@login_required
def removePoint():
    id = request.get_json().get("id")
    user_id = session["user_id"]

    # user_id check
    rows = getDbRows("SELECT user_id FROM points WHERE id=%s", (id,))
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
    id = request.get_json().get("id")
    name = request.get_json().get("name")
    attributes = request.get_json().get("attributes")
    location = json.loads(request.get_json().get("location"))
    is_completed = request.get_json().get("is_completed")

    # point data update
    if id != "null":
        execute = executeQuery(
            """
        UPDATE points SET name = %s, attributes = %s, is_completed = %s, modified = current_timestamp, version = version + 1 
        WHERE id = %s AND user_id = %s AND (name <> %s OR attributes::jsonb <> %s::jsonb OR is_completed <> %s);
        """,
            (
                name,
                attributes,
                is_completed,
                id,
                session["user_id"],
                name,
                attributes,
                is_completed,
            ),
        )
        if execute == 1:
            return "Database error, please try one more time", 500

    # new points creation
    else:
        execute = executeQuery(
            """
        INSERT INTO points(name, location, user_id, attributes, is_completed) 
        VALUES (%s, ST_GeomFromText('POINT(%s %s)'), %s, %s, %s);
        """,
            (
                name,
                location["lat"],
                location["lng"],
                session["user_id"],
                attributes,
                is_completed,
            ),
        )
        if execute == 1:
            return "Database error, please try one more time", 500

    return "Success"


@app.route("/pointList")
@login_required
def pointList():
    print(request.args)

    if "sort_by" in request.args:
        sort_by = request.args.get("sort_by")
        order = "ASC"

        if sort_by not in ["id", "name", "attributes", "is_completed"]:
            return "Invalid sort column", 400

        if "sort_order" in request.args:
            order = request.args.get("sort_order")
            if order not in ["ASC", "DESC"]:
                return "Invalid sort order", 400
    else:
        sort_by = "name"
        order = "ASC"

    if order == "ASC":
        query = sql.SQL(
            "SELECT id, name, attributes, is_completed FROM points WHERE user_id = %s ORDER BY {column} ASC"
        ).format(column=sql.Identifier(sort_by))
    else:
        query = sql.SQL(
            "SELECT id, name, attributes, is_completed FROM points WHERE user_id = %s ORDER BY {column} DESC"
        ).format(column=sql.Identifier(sort_by))

    rows = getDbRows(query, (session["user_id"],))
    if rows is None:
        return "Database error, please try one more time", 500

    pointsData = rows

    return render_template("list.html", pointsData=pointsData)


@app.route("/listPointsUpdate", methods=["POST"])
@login_required
def listPointUpdate():
    newData = request.get_json()
    namesData = newData.get("names")
    attributesData = newData.get("attributes")
    completenessData = newData.get("is_completed")

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        for id in attributesData:
            name = namesData[id]
            attributes = json.dumps(attributesData[id])
            is_completed = completenessData[id]
            try:
                # db trigger function checks if the new data differs from old, and uploads the history if yes
                cur.execute(
                    """
                    UPDATE points SET name = %(name)s, attributes = %(attr)s, is_completed = %(compl)s, modified = current_timestamp, version = version + 1 
                    WHERE id = %(id)s AND user_id = %(us_id)s 
                    AND (name <> %(name)s OR attributes::jsonb <> %(attr)s::jsonb OR is_completed <> %(compl)s);
                """,
                    {
                        "name": name,
                        "attr": attributes,
                        "compl": is_completed,
                        "id": id,
                        "us_id": session["user_id"],
                    },
                )

            except Exception as e:
                return str(e), 500

            conn.commit()

        cur.close()
        conn.close()
        return "Data successfully updated"

    except:
        return "Database error, please try one more time", 500


@app.route("/removeAllPoints", methods=["POST"])
@login_required
def removeAllPoints():
    execute = executeQuery(
        "DELETE FROM points WHERE user_id = %s;", (session["user_id"],)
    )
    if execute == 1:
        return "Database error, please try one more time", 500

    return "Data successfully removed"


@app.route("/exportData", methods=["POST"])
@login_required
def exportData():
    rows = getDbRows(
        """
    SELECT id, name, ST_X(ST_FlipCoordinates(location)), ST_Y(ST_FlipCoordinates(location)), attributes, is_completed, CAST(modified as TEXT) 
    FROM points WHERE user_id=%s;
    """,
        (session["user_id"],),
    )
    if rows is None:
        return "Database error", 500

    try:
        data = getFeatureCollection(rows)
        temp_file_path = tempfile.mkstemp(suffix=".json")[1]
        with open(temp_file_path, "w") as file:
            file.write(jsonify(data).get_data(as_text=True))

        content_type = "application/json"
        return send_file(
            temp_file_path,
            mimetype=content_type,
            as_attachment=True,
            download_name="points.geojson",
        )

    except:
        return "Server error", 500

    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@app.route("/importData", methods=["POST"])
@login_required
def importData():
    if "files" not in request.files:
        return "No file found", 400

    files = request.files.getlist("files")
    if not files:
        return "No files selected", 400

    for file in files:
        if file.filename == "":
            continue

        if not file.filename.endswith(".geojson"):
            return "Invalid file extension", 400

        try:
            data = json.load(file)

            if "type" not in data or data["type"] != "FeatureCollection":
                return "Invalid GeoJSON content", 400

            for feature in data["features"]:
                if feature["geometry"]["type"] != "Point":
                    return "The application works with points data only", 400

                coordindates = feature["geometry"]["coordinates"]
                # attributes = json.dumps(feature['properties'])
                attributes = feature["properties"]
                name = None

                # if the file contain name column - assign value to the name
                if "name" in attributes:
                    name = attributes["name"]
                    del attributes["name"]

                attributes = json.dumps(attributes)
                execute = executeQuery(
                    """
                    INSERT INTO points(name, location, is_completed, user_id, attributes) 
                    VALUES (%s, ST_GeomFromText('POINT(%s %s)'), %s, %s);
                    """,
                    (
                        name,
                        coordindates[1],
                        coordindates[0],
                        session["user_id"],
                        attributes,
                    ),
                )

                if execute == 1:
                    raise Exception("Database error")

        except json.JSONDecodeError:
            return "Invalid JSON format", 400

        except Exception as e:
            return str(e), 500

    return "Data successfully imported"


@app.route("/getHistory", methods=["GET"])
@login_required
def getHistory():
    if "id" in request.args:
        id = request.args.get("id")

        print("id = ", id)

        historyRows = getDbRows(
            """SELECT point_id, point_name, pt_attributes, pt_version, pt_completed, CAST(pt_version_created as TEXT)
                         FROM history WHERE point_id = %s AND creator_id = %s 
                         ORDER BY pt_version DESC""",
            (id, session["user_id"]),
        )

        print("historyData = ", historyRows)

        currentVersion = getDbRows(
            """SELECT id, name, attributes, version, is_completed, CAST(modified as TEXT)
                         FROM points WHERE id = %s AND user_id = %s""",
            (id, session["user_id"]),
        )[0]

        print("currentData = ", currentVersion)

        if (historyRows is None) or (currentVersion is None):
            return "Database error", 500
        else:
            versions = []

            currentData = {
                "id": currentVersion[0],
                "name": currentVersion[1],
                "attributes": currentVersion[2],
                "version": currentVersion[3],
                "is_completed": currentVersion[4],
                "version_created": currentVersion[5],
                "is_latest": True,
            }
            versions.append(currentData)

            for row in historyRows:
                entry = {
                    "id": row[0],
                    "name": row[1],
                    "attributes": row[2],
                    "version": row[3],
                    "is_completed": row[4],
                    "version_created": row[5],
                    "is_latest": False,
                }
                versions.append(entry)

            print(versions)

            return render_template("history.html", versions=versions)

    else:
        return "wrong point ID"


if __name__ == "__main__":
    app.run(debug=True, port=5000, host="127.0.0.1")
