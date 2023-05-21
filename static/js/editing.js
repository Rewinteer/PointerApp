var markers = {};
var selectedNodeId = null;
var selectedLocation = null;
var pointsLayer = null;

// map creation
var map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

fetchAllPoints();

// Listeners registration:
// remove row from the attributes panel button listener
document.addEventListener("DOMContentLoaded", function() {
    let attributesTable = document.getElementById("attributes-table");
    attributesTable.addEventListener("click", function (event) {
        if (event.target.classList.contains("remove-row")) {
            const row = event.target.closest("tr");
            row.parentNode.removeChild(row);
        }
    });
    attributesTable.addEventListener("keydown", function(event) {
        const saveEditsButton = document.getElementById("save-edits-btn");
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            saveEditsButton.click();
        }
    });
});

// add new point on right click listener
map.on('contextmenu', (event) => {
    map.closePopup();
    // right click popup
    let coordinates = event.latlng;
    let coordinatesJson = JSON.stringify({
        lat: coordinates.lat,
        lng: coordinates.lng
    });

    let createBtnMarkup = `<button class='btn btn-primary btn-sm btn-smaller' onclick='createPoint(${coordinatesJson})'>New point</button>`
    L.popup()
    .setLatLng(coordinates)
    .setContent(createBtnMarkup)
    .addTo(map)
    .openOn(map);
});

// add points from db to the map
function fetchAllPoints(pointsLayer) {
    fetch('/points')
    .then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new Error('Points loading failed: ' + response.statusText);
        }
    })
    .then(points => {
        if (pointsLayer != null) {
            pointsLayer.clearLayers();
        }
        pointsLayer = L.geoJSON(points, {
            pointToLayer: (feature, latlng) => {
                let div = document.createElement("div");
                let featureId = feature.properties.id;
                let attributes = feature.properties.attributes;
                let isCompleted = feature.properties.is_completed;

                div = fillPopup(div, featureId, attributes);

                const markerIcon = getMarkerIcon(isCompleted);
                const marker = L.marker(latlng, { icon: markerIcon }).bindPopup(div);

                markers[featureId] = marker;
                return marker;
            }
        });
        
        pointsLayer.addTo(map);
        const pointsLayerBounds = pointsLayer.getBounds();
        map.fitBounds(pointsLayerBounds);
    })
    .catch(error => {
        showResponsePopup(error.message)
    });
}

// get marker icon based on the data
function getMarkerIcon(isCompleted) {
    const iconOptions = {
        iconUrl: isCompleted ? "static/icons/marker-green.png" : "static/icons/marker-blue.png",
        iconAnchor: [24, 48],
        popupAnchor: [1, -40],
    };

    const markerIcon = L.icon(iconOptions)
    return markerIcon;
}

// fill marker popup
function fillPopup(div, featureId, attributes) {
    div.innerHTML = `<b>ID = ${featureId}</b>`;
    for (const key in attributes) {
        div.innerHTML += `<br>${key} = ${attributes[key]}`;
    }
    
    const buttonDiv = document.createElement("div");
    const button = document.createElement("button");
    button.className = "btn btn-primary btn-sm btn-smaller";
    button.innerHTML = "Edit";

    button.onclick = function() {
        editClick(featureId);
    }
    buttonDiv.appendChild(button);

    div.appendChild(buttonDiv);

    return div;
}

// open editing panel
function editClick(featureId) {
    selectedNodeId = featureId;
    const editPanel = document.getElementById("edit-panel");
    closePanelIfOpened(editPanel);
    editPanel.classList.toggle('show');
    let attributesTable = document.querySelector("#attributes-table tbody");
    attributesTable.innerHTML = "";

    // receive point data from the server
    fetch('/pointData', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            'id': `${featureId}`
        })
    })
    .then(response => {
        if (response.ok) {
            return response.json()
        } else {
            throw new Error("Can't load data: " + response.statusText)
        }
    })
    .then(pointData => {
        let attributes = pointData.attributes;
        let isCompleted = pointData.is_completed;
        
        // fill editing table
        for (const attribute in attributes) {
            fillRows(attributesTable, attribute, attributes[attribute]);
        }

        let checkbox = document.getElementById("is-completed-chk");
        checkbox.checked = isCompleted;
    })
    .catch(error => {
        showResponsePopup(error.message);
    });
}

// fill attributes table
function fillRows(tableBody, key, value) {
    let row = tableBody.insertRow();
    let newKey = row.insertCell();
    let newValue = row.insertCell();
    newKey.innerHTML = `
    <div class="d-flex align-items-center">
        <input size="10" type="text" placeholder="Key" value="${key}">
    </div>`;
    newValue.innerHTML = `
    <div class="d-flex align-items-center">
        <textarea rows="1" cols="25">${value}</textarea>
        <button type="button" class="btn btn-danger btn-sm btn-smaller remove-row">Remove row</button>
    </div>`;
}

// add row to the attributes table
function addRow() {
    let attributesTable = document.querySelector("#attributes-table tbody");
    fillRows(attributesTable, '', '');
}

// parse attributes table
function getAttributesData() {
    let attributesTable = document.querySelector("#attributes-table tbody");
    let attributesData = {};
    for (let i = 0; i < attributesTable.rows.length; i++) {
        const row = attributesTable.rows[i];
        const keyInput = row.querySelector("input[type='text']");
        const valueTextArea = row.querySelector("textarea");

        const key = keyInput.value;
        const value = valueTextArea.value;
        
        attributesData[key] = value;
    }

    return attributesData;
}

// save attributes changes
function saveEdits() {
    const attributesData = getAttributesData()
    const jsonData = JSON.stringify(attributesData);
    
    const checkbox = document.getElementById("is-completed-chk");
    const isCompleted = checkbox.checked;

    if (window.confirm('Are you sure you want to save edits?')) {
                    
        fetch('/saveEdits', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                'id': `${selectedNodeId}`,
                'attributes': `${jsonData}`,
                'location': `${selectedLocation}`,
                'is_completed': `${isCompleted}`
            })
        })
        .then(response => {
            if (response.ok) {
                const marker = markers[selectedNodeId];
                if (marker) {
                    // update popup of the updated marker
                    let div = document.createElement("div");
                    div = fillPopup(div, selectedNodeId, attributesData);
                    marker.setPopupContent(div);
                    marker.bindPopup(div);
    
                    const markerIcon = getMarkerIcon(isCompleted);
                    marker.setIcon(markerIcon);
    
                    marker.update();
                } else {
                    // update all points after new point creation
                    fetchAllPoints(pointsLayer);
                    map.closePopup();
                }
                closePanel();
                showResponsePopup("Data successfully updated.");
            } else {
                throw new Error("Point update failed: " + response.statusText);
            }
        })
        .catch(error => {
            showResponsePopup(error.message);
        });
    }
}

// close editing panel
function closePanel() {
    const editPanel = document.getElementById("edit-panel");
    const checkbox = document.getElementById("is-completed-chk");
    editPanel.classList.toggle('show');
    checkbox.checked = false;
    selectedLocation = null;
}

// close panel if already opened
function closePanelIfOpened (editPanel) {
    if (editPanel.classList.contains('show')) {
        closePanel();
    }
}

// points removal
function removePoint() {
    // if points from DB selected
    if (selectedNodeId) {
        if (window.confirm(`Are you sure you want to remove the point with ID = ${selectedNodeId}?`)) {
                    
            fetch('/removePoint', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    'id': `${selectedNodeId}`
                })
            })
            .then(response => {
                if (response.ok) {
                    const marker = markers[selectedNodeId];
                    if (marker) {
                        marker.remove();
                        closePanel();
                    }
                } else {
                    throw new Error("Point removal failed" + response.statusText);
                }
            })
            .catch(error => {
                showResponsePopup(error.message)
            });
        }
    // if unsaved point selected (during creation)
    } else {
        closePanel();
        map.closePopup();
    }
}

// create new point
function createPoint(coordinates) {
    let editPanel = document.getElementById("edit-panel");
    closePanelIfOpened(editPanel);
    let attributesTable = document.querySelector("#attributes-table tbody");
    attributesTable.innerHTML = "";
    selectedNodeId = null;
    selectedLocation = JSON.stringify(coordinates);
    editPanel.classList.toggle('show');
}