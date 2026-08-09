let lastHeight = 0;
let frameId = null;

function getVisibleContentHeight() {
    const container = document.querySelector(".booking-page") || document.querySelector("main") || document.body;
    const containerHeight = container?.getBoundingClientRect().height || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const bodyHeight = document.body?.scrollHeight || 0;

    const measuredHeight = Math.max(containerHeight, viewportHeight, bodyHeight);
    return Math.ceil(Math.min(4000, Math.max(600, measuredHeight + 8)));
}

function sendHeight() {
    const height = getVisibleContentHeight();

    if (Math.abs(height - lastHeight) < 5) {
        return;
    }

    lastHeight = height;

    window.parent.postMessage({
        type: "booking-height",
        height
    }, "*");
}

function scheduleHeightUpdate() {
    if (frameId) {
        cancelAnimationFrame(frameId);
    }

    frameId = requestAnimationFrame(sendHeight);
}

window.addEventListener("load", scheduleHeightUpdate);
window.addEventListener("resize", scheduleHeightUpdate);

const observer = new ResizeObserver(() => {
    scheduleHeightUpdate();
});

if (document.body) {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    observer.observe(document.body);
}

setTimeout(scheduleHeightUpdate, 100);
setTimeout(scheduleHeightUpdate, 300);
setTimeout(scheduleHeightUpdate, 800);