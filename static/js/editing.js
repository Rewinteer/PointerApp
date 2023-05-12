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

// add points from db to the map
function fetchAllPoints(pointsLayer) {
    fetch('/points')
    .then(response => response.json())
    .then(points => {
        if (pointsLayer != null) {
            pointsLayer.clearLayers();
        }
        pointsLayer = L.geoJSON(points, {
            pointToLayer: (feature, latlng) => {
                let div = document.createElement("div");
                let featureId = feature.properties.id;
                let attributes = feature.properties.attributes;

                div = fillPopup(div, featureId, attributes);

                const marker = L.marker(latlng).bindPopup(div);
                markers[featureId] = marker;
                return marker;
            }
        });
        pointsLayer.addTo(map);
    });
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
    const editPanel = document.getElementById("edit-panel");
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
    .then(response => response.json())
    .then(pointData => {
        let attributes = pointData.attributes;
        let id = pointData.id;
        let user_id = pointData.user_id
        
        // fill editing table
        for (const attribute in attributes) {
            fillRows(attributesTable, attribute, attributes[attribute]);
        }
        
        selectedNodeId = id;
    });
}

// close editing panel
function closePanel() {
    let editPanel = document.getElementById("edit-panel");
    editPanel.classList.toggle('show');
    console.log("close panel");
    selectedLocation = null;
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
            .then(() => {
                const marker = markers[selectedNodeId];
                if (marker) {
                    marker.remove();
                    closePanel();
                }
            });
        }
    // if unsaved point selected (during creation)
    } else {
        closePanel();
        map.closePopup();
    }
    
}

// add row to the attributes table
function addRow() {
    let attributesTable = document.querySelector("#attributes-table tbody");
    fillRows(attributesTable, '', '');
}

// remove row from the attributes panel
document.addEventListener("DOMContentLoaded", function() {
    let attributesTable = document.getElementById("attributes-table");
    attributesTable.addEventListener("click", function (event) {
        if (event.target.classList.contains("remove-row")) {
            const row = event.target.closest("tr");
            row.parentNode.removeChild(row);
        }
    });
});

// save attributes changes
function saveEdits() {
    const attributesData = getAttributesData()
    const jsonData = JSON.stringify(attributesData);

    if (window.confirm('Are you sure you want to save edits?')) {
                    
        fetch('/saveEdits', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                'id': `${selectedNodeId}`,
                'attributes': `${jsonData}`,
                'location': `${selectedLocation}`
            })
        })
        .then(() => {
            const marker = markers[selectedNodeId];
            if (marker) {
                // update popup of the updated marker
                let div = document.createElement("div");
                div = fillPopup(div, selectedNodeId, attributesData);
                marker.setPopupContent(div);
                marker.bindPopup(div);
                marker.update();
            } else {
                // update all points after new point creation
                fetchAllPoints(pointsLayer);
                map.closePopup();
            }
            closePanel();
        });
    }
}

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

// add new point
map.on('contextmenu', (event) => {
    map.closePopup();
    // right click popup
    let coordinates = event.latlng;
    let coordinatesJson = JSON.stringify({
        lat: coordinates.lat,
        lng: coordinates.lng
    });

    console.log(coordinates);
    let createBtnMarkup = `<button class='btn btn-primary btn-sm btn-smaller' onclick='createPoint(${coordinatesJson})'>New point</button>`
    L.popup()
    .setLatLng(coordinates)
    .setContent(createBtnMarkup)
    .addTo(map)
    .openOn(map);
});

function createPoint(coordinates) {
    let editPanel = document.getElementById("edit-panel");
    let attributesTable = document.querySelector("#attributes-table tbody");
    attributesTable.innerHTML = "";
    selectedNodeId = null;
    selectedLocation = JSON.stringify(coordinates);
    editPanel.classList.toggle('show');
}