
chrome.devtools.panels.create(
    "Excalibur",
    "icon.png",
    "excalibur-panel.html", (evt) => {
        console.log('excalibur dev tools', evt)
    }
)

