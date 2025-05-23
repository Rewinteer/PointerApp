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

fetchAllPoints(updateBbox=true);

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
function fetchAllPoints(updateBbox = false) {
    showLoadingOverlay();
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
                let name = feature.properties.name;
                let attributes = feature.properties.attributes;
                let isCompleted = feature.properties.is_completed;

                div = fillPopup(div, name, featureId, attributes);

                const markerIcon = getMarkerIcon(isCompleted);
                const marker = L.marker(latlng, { icon: markerIcon }).bindPopup(div);

                markers[featureId] = marker;
                return marker;
            }
        });
        
        pointsLayer.addTo(map);

        if (updateBbox) {
            const pointsLayerBounds = pointsLayer.getBounds();
            map.fitBounds(pointsLayerBounds);
        }
        closeLoadingOverlay();
    })
    .catch(error => {
        showResponsePopup(error.message)
        closeLoadingOverlay();
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
function fillPopup(div, name, featureId, attributes) {
    div.innerHTML = `<b>Name: ${name}</b><br>id: ${featureId}<br><br><b>Attributes:</b>`;

    // popup text
    const maxAttrcount = 3;
    let counter = 0;
    for (const key in attributes) {
            if (counter == 3) {
                div.innerHTML += `<br>...`;
                break;
            }
            div.innerHTML += `<br>${key} = ${attributes[key]}`;
            counter++;
    }
    if (counter == 0) {
        div.innerHTML += `<br>no data`;
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
    showLoadingOverlay();
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
        let name = pointData.name;
        let attributes = pointData.attributes;
        let isCompleted = pointData.is_completed;
        
        let nameRow = document.getElementById("name-input");
        nameRow.value = name;

        // fill editing table
        for (const attribute in attributes) {
            fillRows(attributesTable, attribute, attributes[attribute]);
        }

        let checkbox = document.getElementById("is-completed-chk");
        checkbox.checked = isCompleted;
        closeLoadingOverlay();
    })
    .catch(error => {
        showResponsePopup(error.message);
        closeLoadingOverlay();
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
        <textarea rows="1" placeholder="Value" cols="25">${value}</textarea>
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
    const attributesData = getAttributesData();
    const jsonData = JSON.stringify(attributesData);
    
    const checkbox = document.getElementById("is-completed-chk");
    const isCompleted = checkbox.checked;

    const nameRow = document.getElementById("name-input");
    const name = nameRow.value;

    if (window.confirm('Are you sure you want to save edits?')) {

        showLoadingOverlay();            
        fetch('/saveEdits', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                'id': `${selectedNodeId}`,
                'name': `${name}`,
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
                    div = fillPopup(div, name, selectedNodeId, attributesData);
                    marker.setPopupContent(div);
                    marker.bindPopup(div);
    
                    const markerIcon = getMarkerIcon(isCompleted);
                    marker.setIcon(markerIcon);
    
                    marker.update();
                } else {
                    // update all points after new point creation
                    fetchAllPoints();
                    map.closePopup();
                }
                closePanel();
                showResponsePopup("Data successfully updated.");
                closeLoadingOverlay();
            } else {
                throw new Error("Point update failed: " + response.statusText);
            }
        })
        .catch(error => {
            showResponsePopup(error.message);
            closeLoadingOverlay();
        });
    }
}

// close editing panel
function closePanel() {
    const editPanel = document.getElementById("edit-panel");
    const checkbox = document.getElementById("is-completed-chk");
    const nameRow = document.getElementById("name-input");
    
    editPanel.classList.toggle('show');
    checkbox.checked = false;
    nameRow.value = null;
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
                    
            showLoadingOverlay();
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
                        closeLoadingOverlay();
                    }
                } else {
                    throw new Error("Point removal failed" + response.statusText);
                }
            })
            .catch(error => {
                showResponsePopup(error.message)
                closeLoadingOverlay();
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

function getMapHistory() {
    var form = document.getElementById('historyForm');
    var input = form.querySelector('input[id="history_input"]');
    input.value = selectedNodeId;
    form.submit();
}