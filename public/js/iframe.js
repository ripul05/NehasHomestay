let lastHeight = 0;
let frameId = null;

function sendHeight() {
    const height = Math.ceil(document.documentElement.scrollHeight || document.body?.scrollHeight || 0);
    const safeHeight = Math.max(300, Math.min(height, 4000));

    if (safeHeight === lastHeight) {
        return;
    }

    lastHeight = safeHeight;

    window.parent.postMessage({
        type: "booking-height",
        height: safeHeight
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
window.addEventListener("scroll", () => {
    scheduleHeightUpdate();
}, { passive: true });

const observer = new ResizeObserver(() => {
    scheduleHeightUpdate();
});

if (document.body) {
    observer.observe(document.body);
}

setTimeout(scheduleHeightUpdate, 100);
setTimeout(scheduleHeightUpdate, 500);