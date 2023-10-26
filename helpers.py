import psycopg2
import os
import json

from flask import session, redirect, flash, render_template
from functools import wraps
from urllib.parse import urlparse 
from psycopg2 import sql
import jwt
from time import time
from flask_mail import Message

url = os.environ['DB_URL']
parsed_url = urlparse(url)
database = parsed_url.path[1:]
user = parsed_url.username
password = parsed_url.password
host = parsed_url.hostname
port = parsed_url.port

def get_db_connection():
    conn = psycopg2.connect(
        database=database,
        user=user,
        password=password,
        host=host,
        port=port)
    return conn

def login_required(f):
    @wraps (f)
    def decorated_function(*args, **kwargs):
        if session.get("user_id") is None:
            return redirect("/login")
        return f(*args, **kwargs)
    return decorated_function

# def get_db_connection():
#     conn = psycopg2.connect(
#         host="localhost",
#         database="test",
#         user=os.environ['DB_USERNAME'],
#         password=os.environ['DB_PASSWORD'])
#     return conn

def executeQuery(query, placeholdersTuple):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(query, placeholdersTuple)
        conn.commit()
        cur.close()
        conn.close()
        return 0
    except psycopg2.Error as e:
        print(e.pgerror)
        print(e)
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
    except:
        cur.close()
        conn.close()
        return None

def onAlreadyExistsInUsers(column, value):
    isExists = isExists(column, value)

    if isExists != None:
        if isExists:
            output = "{column_name} already exists, choose another one".format(column_name=column)
            flash(message=output, category="error")
            return redirect("/register")
    else:
        flash("Database error, please submit one more time", "error")
        return redirect("/register")
    
def isExists(column, value):
    query = sql.SQL('SELECT id FROM users WHERE {column_name} = %s;').format(column_name=sql.Identifier(column))
    rows = getDbRows(query, (value,))
    if rows != None:
        return len(rows) > 0
    else:
        return None
    
def getFeatureCollection(rows):
    outfile = {
        "type": "FeatureCollection",
        "features": []
    }

    for row in rows:
        # row schema: id | name | location_x | location_y | attributes | is_completed | modified 
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": []
            },
            "properties": {}
        }

        feature["properties"]["db_id"] = row[0]
        feature["properties"]["name"] = row[1]
        feature["geometry"]["coordinates"].append(row[2])
        feature["geometry"]["coordinates"].append(row[3])
        for attribute in row[4]:
            feature["properties"][attribute] = row[4][attribute]
        feature["properties"]["is_completed"] = row[5]
        feature["properties"]["modified"] = row[6]

        outfile["features"].append(feature)
    
    return(outfile)

def send_mail(email, user, mail):
    token = get_reset_token(user)
    msg = Message()
    msg.subject = "Pointer password reset"
    msg.sender = os.getenv('MAIL_ADDRESS')
    msg.recipients = [email]
    msg.html = render_template('reset_email.html', user=user, token=token)
    mail.send(msg)

def get_reset_token(username, expires=1800):
    return jwt.encode({'reset_password': username, 'exp': time() + expires}, key=os.getenv("SECRET_KEY"))

def verify_reset_token(token):
    try:
        username = jwt.decode(token, key=os.getenv("SECRET_KEY"), algorithms=["HS256"])['reset_password']
        return username
    except Exception as e:
            print(e)
            return
