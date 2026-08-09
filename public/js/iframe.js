function sendHeight() {

    const height = document.documentElement.scrollHeight;

    window.parent.postMessage({
        type: "booking-height",
        height: height
    }, "*");

}

// Initial load
window.addEventListener("load", sendHeight);

// Resize window
window.addEventListener("resize", sendHeight);

// Observe DOM changes
const observer = new ResizeObserver(sendHeight);

observer.observe(document.body);