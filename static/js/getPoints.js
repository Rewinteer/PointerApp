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
                const attributes = feature.properties.attributes;

                for (const key in attributes) {
                    popupContent += `</br>${key} = ${attributes[key]}`
                }

                layer.bindPopup(popupContent);            
            }
        });
        points.addTo(map);
    });