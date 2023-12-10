// Relays messages from injected scripts that post messages to the window

window.addEventListener('message', function (event) {
    // Only accept messages from the same frame
    if (event.source !== window) {
        return;
    }

    var message = event.data;

    // Only accept messages that we know are ours
    if (typeof message !== 'object' || message === null ||
        message.source !== 'excalibur-dev-tools') {
        return;
    }

    chrome.runtime.sendMessage(message);
});