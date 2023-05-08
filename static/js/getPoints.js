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

function editClick(attributesString) {
    const editPanel = document.getElementById("edit-panel");
    editPanel.classList.toggle('show');
    let attributesTable = document.getElementById("attributes-table");
    attributesTable.innerHTML = "";

    var attributes = JSON.parse(attributesString);
    

    for (const attribute in attributes) {
        let row = attributesTable.insertRow();
        let key = row.insertCell();
        let value = row.insertCell();
        key.innerHTML = `${attribute}`;
        value.innerHTML = `<textarea rows="2" cols="40">${attributes[attribute]}</textarea>`;
    }
}