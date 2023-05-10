// map creation
var map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// add points from db to the map
fetch('/points')
    .then(response => response.json())
    .then(points => {
        var pointsLayer = L.geoJSON(points, {
            pointToLayer: (feature, latlng) => {
                let div = document.createElement("div");
                let featureId = feature.properties.id;
                let attributes = feature.properties.attributes;

                div.innerHTML = `<b>ID = ${featureId}</b>`;
                for (const key in attributes) {
                    div.innerHTML += `<br>${key} = ${attributes[key]}`;
                }
                
                const buttonDiv = document.createElement("div");
                const button = document.createElement("button");
                button.className = "btn btn-primary btn-sm btn-smaller"
                button.innerHTML = "Edit";

                button.onclick = function() {
                    editClick(featureId);
                }
                buttonDiv.appendChild(button);

                div.appendChild(buttonDiv);
                return L.marker(latlng).bindPopup(div);
            }
        });
        pointsLayer.addTo(map);
    });

// fill table
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
        var attributes = pointData.attributes;
    
        for (const attribute in attributes) {
            fillRows(attributesTable, attribute, attributes[attribute]);
        }
    });
}

function closePanel() {
    var editPanel = document.getElementById("edit-panel");
    editPanel.classList.toggle('show');
}

function addRow() {
    let attributesTable = document.querySelector("#attributes-table tbody");
    fillRows(attributesTable, '', '');
}

// row removal
document.addEventListener("DOMContentLoaded", function() {
    var attributesTable = document.getElementById("attributes-table");
    attributesTable.addEventListener("click", function (event) {
        if (event.target.classList.contains("remove-row")) {
            const row = event.target.closest("tr");
            row.parentNode.removeChild(row);
        }
    });
});