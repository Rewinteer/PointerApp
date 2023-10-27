# PointerApp
#### Working Instance:  <https://pointerapp.onrender.com> 
Note: This instance may shut down due to inactivity, resulting in an extended delay for the first access.
#### Video Demo:  <https://youtu.be/Ib7x6hEpWNM>
#### Description:
Overview:
Pointer App is a web application developed as the final project for the CS50 Course. The application enables users to create accounts and add points to the map. Users can include additional data (key-value pairs) for each point. The primary objective of the app is to streamline the process of field surveys by allowing users to plan observation points in the office and input necessary data during fieldwork directly from their devices (the web application is adapted for mobile screens). All data is stored in the database, and the app maintains a comprehensive history log for each point. This feature enables users to access previous versions of points on the map, facilitating recurring observations and ensuring data accuracy. 

Points:
There are two data views in the app - Map view and List view. The first one mostly suitable for creation points and filling the values at the field. Points are located on the map background implemented using Leaflet library. List view allows the user to import the GeoJSON data, work with the complete list of points, edit all points on the same window and export the data to GeoJSON file if needed. The list view allows user to sort the data by values in columns. The application allows users to import the data from GeoJSON files and export their points to GeoJSON as well. So it is possible to import points which are already exist locally. 

Users:
The app requires user to register/log in. Valid email is mandatory for the registration, since the user can reset their pasport using email if needed - there is a 'forgot password' button on the Login Page. After pressing this button the user will be prompted to enter their email and if the email is valid, the user will receive the reset password link from the app. Email is the unique parameter for users as well as the username, so you can't use the same username and email for different accounts.

History:
Each point in the database has associated history of edits. In map and list views both there are 'History' buttons which opens the history table with all versions of the point edits. the app don't erase history after point removal, so you can access the history if you know the id of the removed point in the database using appropriate GET request (or using point name if you the database admin :) ).

#### Technologies Used:
- Flask
- PostgeSQL
- PostGIS
- Leaflet
