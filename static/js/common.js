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

function showLoadingOverlay() {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = 'flex';
}

function closeLoadingOverlay() {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = 'none';
}
