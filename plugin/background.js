chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.sync.set({
        extensionEnabled: true,
        shortcutKey: 'q',
        apiEndpoint: 'http://127.0.0.1:8000'
    }, function() {
        console.log("AbSOSUM Extension initialized");
    });
    
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
        chrome.declarativeContent.onPageChanged.addRules([{
            conditions: [
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: { 
                        hostContains: 'stackoverflow.com',
                        pathContains: 'questions/ask'
                    }
                })
            ],
            actions: [new chrome.declarativeContent.ShowAction()]
        }]);
    });
});