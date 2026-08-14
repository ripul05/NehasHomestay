document.addEventListener("DOMContentLoaded", () => {
    const steps = Array.from(document.querySelectorAll(".step"));
    const bookingCard = document.querySelector(".booking-card");
    const availabilitySection = document.getElementById("availabilitySection");
    const guestDetailsSection = document.getElementById("guestDetailsSection");

    let currentStep = 1;

    function updateParentHeightIfNeeded() {
        if (typeof window.updateParentHeight === "function") {
            window.updateParentHeight();
        }
    }

    function showStep(stepNumber) {
        currentStep = stepNumber;

        steps.forEach((step, index) => {
            const stepIndex = index + 1;
            const shouldShow = stepIndex === stepNumber;
            step.classList.toggle("active", shouldShow);
            step.classList.toggle("hidden-step", !shouldShow);
            step.style.display = shouldShow ? "block" : "none";
        });

        if (stepNumber === 1) {
            bookingCard.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (stepNumber === 2) {
            availabilitySection.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (stepNumber === 3) {
            guestDetailsSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        setTimeout(updateParentHeightIfNeeded, 80);
    }

    function goToStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > steps.length) return;
        showStep(stepNumber);
    }

    function nextStep() {
        if (currentStep < steps.length) {
            showStep(currentStep + 1);
        }
    }

    function previousStep() {
        if (currentStep > 1) {
            showStep(currentStep - 1);
        }
    }

    window.bookingWizard = {
        currentStep,
        showStep,
        goToStep,
        nextStep,
        previousStep
    };

    showStep(1);
});
