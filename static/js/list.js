// attributes maniulation
document.addEventListener("DOMContentLoaded", function() {
    let pointsTable = document.getElementById("points-table");
    pointsTable.addEventListener("click", function(event) {
        // remove attribute row
        if (event.target.classList.contains("remove-row")) {
            const attribute = event.target.closest("div");
            attribute.remove();
        // add atribute row
        } else if (event.target.classList.contains("add-row")) {
            const newAttrDiv = document.createElement("div");
            newAttrDiv.className = "d-flex align-items-center list-point-attr";
            newAttrDiv.style = "margin-bottom: 5px;"
            newAttrDiv.innerHTML =  '<input size="20" type="text" placeholder="Key" class="input-list">' +
                '<textarea rows="1" cols="25" class="textarea-list" placeholder="Value"></textarea>' +
                '<button type="button" class="btn btn-outline-danger btn-sm remove-row">Remove row</button>';

            const attrRow = event.target.closest("div").parentNode;
            const attributesDiv = attrRow.querySelector(".list-point-attrs");
            attributesDiv.appendChild(newAttrDiv);
        // remove point
        } else if (event.target.classList.contains("remove-point")) {
            let pointId = event.target.dataset.targetId;
            if (window.confirm(`Are you sure you want to remove the point with ID = ${pointId}? This action cannot be reversed.`)) {
                    
                fetch('/removePoint', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        'id': `${pointId}`
                    })
                })
                .then(() => {
                    const rowToRemove = event.target.closest('tr');
                    rowToRemove.remove();
                });
            }
        }
    });
});

// save all edits made in the list mode
function saveListEdits() {
    const attrTable = document.getElementById("points-table");
    const rows = attrTable.getElementsByClassName('point-row');

    let pointsData = {};
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const attrDivs = row.getElementsByClassName("list-point-attr");

        const pointId = row.getAttribute('data-element-id');
        let pointAttrs = {};
        for (let j = 0; j < attrDivs.length; j++) {
            const attrDiv = attrDivs[j];
            const key = attrDiv.querySelector('.input-list').value;
            const value = attrDiv.querySelector('.textarea-list').value;
            pointAttrs[key] = value;
        }
        pointsData[pointId] = JSON.stringify(pointAttrs);        
    }

    console.log(pointsData);
    if (window.confirm(`Are you sure you want to save your attributes edits?`)) {
                    
        fetch('/listPointsUpdate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pointsData)
        });
    }
}

function discardListEdits() {
    location.reload();
}

function removeAllPoints() {
    if (window.confirm(`Are you sure you want to remove ALL points? This action cannot be reversed.`)) {
                    
        fetch('/removeAllPoints', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
        })
        .then(() => {
            location.reload();
        });
    }
}