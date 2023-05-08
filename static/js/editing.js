var map = L.map('map').setView([51.505, -0.09], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

fetch('/points')
    .then(response => response.json())
    .then(data => {
        var points = L.geoJSON(data, {
            onEachFeature: function (feature, layer) {
                let popupContent = `<b>ID = ${feature.properties.id}</b>`;
                var attributes = feature.properties.attributes;
                for (const key in attributes) {
                    popupContent += `</br>${key} = ${attributes[key]}`
                }

                attributesToSend = JSON.stringify(attributes);
                console.log(`${attributesToSend}`)

                layer.bindPopup(popupContent + '</br><button id="edit-button" onclick="editClick(\`${attributesToSend}\`)">Edit</button>');
            }
        });
        points.addTo(map);

    });

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
        <button type="button" class="btn btn-danger btn-sm align-middle remove-row">Remove row</button>
    </div>`;
}

function editClick(attributesString) {
    const editPanel = document.getElementById("edit-panel");
    editPanel.classList.toggle('show');
    let attributesTable = document.querySelector("#attributes-table tbody");
    attributesTable.innerHTML = "";

    var attributes = JSON.parse(attributesString);
    
    for (const attribute in attributes) {
        fillRows(attributesTable, attribute, attributes[attribute]);
    }
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