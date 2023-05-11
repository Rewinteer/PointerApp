// map creation
var map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

var markers = {};

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

// add points from db to the map
fetch('/points')
    .then(response => response.json())
    .then(points => {
        var pointsLayer = L.geoJSON(points, {
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

var selectedNodeId = null;

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

    const jsonData = JSON.stringify(attributesData);
    console.log(jsonData);

    if (window.confirm('Are you sure you want to save edits?')) {
                    
        fetch('/saveEdits', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                'id': `${selectedNodeId}`,
                'attributes': `${jsonData}`
            })
        })
        .then(() => {
            const marker = markers[selectedNodeId];
            if (marker) {
                let div = document.createElement("div");
                div = fillPopup(div, selectedNodeId, attributesData);
                marker.setPopupContent(div);
                marker.bindPopup(div);
                marker.update();
                closePanel();
            }
        });
    }
}