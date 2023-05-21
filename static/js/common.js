function showResponsePopup(message) {
    const responsePopupContainer = document.getElementById("response-popup-container");
    responsePopupContainer.textContent = message;
    responsePopupContainer.style.display = 'block';

    setTimeout(function() {
        hideResponsePopup();
    }, 3000);
}

function hideResponsePopup() {
    const responsePopupContainer = document.getElementById("response-popup-container");
    responsePopupContainer.style.display = 'none';
}
