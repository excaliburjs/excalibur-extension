console.log('hello from excalibur dev tools!')

if ((window).___EXCALIBUR_DEVTOOL) {
    alert('has excalibur!');
    // chrome.runtime.sendMessage((window as any).___EXCALIBUR_DEVTOOL)
}