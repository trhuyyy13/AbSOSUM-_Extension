// =============================================================================
// Popup Script - Launch Main Interface
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
    const startBtn = document.getElementById('start-btn');
    const statusMessage = document.getElementById('status-message');
    
    // Check if on StackOverflow
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = tabs[0].url;
        
        if (!currentUrl.includes('stackoverflow.com')) {
            startBtn.disabled = true;
            statusMessage.style.display = 'block';
            statusMessage.innerHTML = '⚠️ Please navigate to a StackOverflow question page first';
        } else if (!currentUrl.includes('stackoverflow.com/questions/') || currentUrl.includes('/ask')) {
            startBtn.disabled = true;
            statusMessage.style.display = 'block';
            statusMessage.innerHTML = '⚠️ Please open a specific question page';
        } else {
            statusMessage.style.display = 'block';
            statusMessage.innerHTML = '✅ Ready! Click to open ABSOSUM interface';
        }
    });
    
    // Start button - inject main interface into page
    startBtn.addEventListener('click', function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'openMainInterface'}, function(response) {
                if (chrome.runtime.lastError) {
                    statusMessage.style.display = 'block';
                    statusMessage.innerHTML = '❌ Error: Please refresh the page and try again';
                } else {
                    window.close(); // Close popup after opening interface
                }
            });
        });
    });
});
