import psycopg2
import os

from flask import session, redirect
from functools import wraps

def login_required(f):
    @wraps (f)
    def decorated_function(*args, **kwargs):
        if session.get("user_id") is None:
            return redirect("/login")
        return f(*args, **kwargs)
    return decorated_function

def get_db_connection():
    conn = psycopg2.connect(
        host="localhost",
        database="test",
        user=os.environ['DB_USERNAME'],
        password=os.environ['DB_PASSWORD'])
    return conn

def executeQuery(query, placeholdersTuple):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(query, placeholdersTuple)
        conn.commit()
        cur.close()
        conn.close()
        return 0
    except psycopg2.Error:
        cur.close()
        conn.close()
        return 1

def getDbRows(query, placeholdersTuple):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(query, placeholdersTuple)        
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except psycopg2.Error:
        cur.close()
        conn.close()
        return None

def usernameAlreadyExists(username):
    rows = getDbRows('SELECT id FROM users WHERE username = %s', (username,))

    if rows != None:
        return len(rows) > 0
    else:
        return rows
    
def getFeatureCollection(rows):
    outfile = {
        "type": "FeatureCollection",
        "features": []
    }

    for row in rows:
        # row schema: id | location_x | location_y | attributes | is_completed | modified 
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": []
            },
            "properties": {}
        }

        feature["properties"]["id"] = row[0]
        feature["geometry"]["coordinates"].append(row[1])
        feature["geometry"]["coordinates"].append(row[2])
        for attribute in row[3]:
            feature["properties"][attribute] = row[3][attribute]
        feature["properties"]["is_completed"] = row[4]
        feature["properties"]["modified"] = row[5]

        outfile["features"].append(feature)
    
    return(outfile)