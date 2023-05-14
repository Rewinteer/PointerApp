// attribute removal/adding 
document.addEventListener("DOMContentLoaded", function() {
    let pointsTable = document.getElementById("points-table");
    pointsTable.addEventListener("click", function(event) {
        if (event.target.classList.contains("remove-row")) {
            const attribute = event.target.closest("div");
            attribute.remove();
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
        }
    });
});