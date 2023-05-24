// attributes manipulation
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
                    
                showLoadingOverlay();
                fetch('/removePoint', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        'id': `${pointId}`
                    })
                })
                .then(response => {
                    if (response.ok) {
                        const rowToRemove = event.target.closest('tr');
                        rowToRemove.remove();
                        showResponsePopup("Success");
                        closeLoadingOverlay();
                    } else {
                        throw new Error("Point removal error: " + response.statusText)
                    }   
                })
                .catch(error => {
                    showResponsePopup(error.message);
                    closeLoadingOverlay();
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
    let isCompleted = {};
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const attrDivs = row.getElementsByClassName("list-point-attr");

        const pointId = row.getAttribute('data-element-id');
        const checkbox = row.querySelector(".list-checkbox")
        const completed = checkbox.checked;
        let pointAttrs = {};
        for (let j = 0; j < attrDivs.length; j++) {
            const attrDiv = attrDivs[j];
            const key = attrDiv.querySelector('.input-list').value;
            const value = attrDiv.querySelector('.textarea-list').value;
            pointAttrs[key] = value;
        }
        pointsData[pointId] = pointAttrs;
        isCompleted[pointId] = completed;      
    }

    if (window.confirm(`Are you sure you want to save your attributes edits?`)) {
        
        showLoadingOverlay();
        fetch('/listPointsUpdate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                'attributes': pointsData,
                'is_completed': isCompleted
            })
        })
        .then(response => {
            if (response.ok) {
                showResponsePopup("Data successfully updated.");
                closeLoadingOverlay();
            } else {
                throw new Error("Data update error: " + response.statusText)
            }
        })
        .catch(error => {
            showResponsePopup(error.message);
            closeLoadingOverlay();
        });
    }
}

function discardListEdits() {
    location.reload();
    showResponsePopup("Attributes edits were discarded.");
}

function removeAllPoints() {
    if (window.confirm(`Are you sure you want to remove ALL points? This action cannot be reversed.`)) {
        
        showLoadingOverlay();
        fetch('/removeAllPoints', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
        })
        .then(response => {
            if (response.ok) {
                showResponsePopup("All points were removed.");
                location.reload();
                closeLoadingOverlay();
            } else {
                throw new Error("Removal error: ", response.statusText);
            }
        })
        .catch(error => {
            showResponsePopup(error.message)
            closeLoadingOverlay();
        });
    }
}

function exportData() {
    if (window.confirm(`Please ensure that you saved all necessary edits before export. Do you want to proceed?`)) {
             
        showLoadingOverlay();
        fetch('/exportData', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
        })
        .then(response => {
            if (response.ok) {
                const filename = response.headers.get('Content-Disposition').split('=')[1];
                response.blob().then(blob => {
                    const url = URL.createObjectURL(blob);

                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    link.click();
                    URL.revokeObjectURL(url);
                    closeLoadingOverlay();
                });
            } else {
                throw new Error("Export error: ", response.statusText);
            }
        })
        .catch(error => {
            showResponsePopup(error.message);
            closeLoadingOverlay();
        });
    }
}