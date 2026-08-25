document.addEventListener(
    "DOMContentLoaded",
    () => {

        const trigger =
            document.getElementById(
                "mobilePolicyTrigger"
            );

        const overlay =
            document.getElementById(
                "mobilePolicyOverlay"
            );

        const closeButton =
            document.getElementById(
                "mobilePolicyClose"
            );

        const doneButton =
            document.getElementById(
                "mobilePolicyDone"
            );


        if (
            !trigger ||
            !overlay ||
            !closeButton ||
            !doneButton
        ) {
            return;
        }


        const openPolicy = () => {

            overlay.classList.add(
                "is-open"
            );

            overlay.setAttribute(
                "aria-hidden",
                "false"
            );

            document.body.style.overflow =
                "hidden";

        };


        const closePolicy = () => {

            overlay.classList.remove(
                "is-open"
            );

            overlay.setAttribute(
                "aria-hidden",
                "true"
            );

            document.body.style.overflow =
                "";

        };


        trigger.addEventListener(
            "click",
            openPolicy
        );


        closeButton.addEventListener(
            "click",
            closePolicy
        );


        doneButton.addEventListener(
            "click",
            closePolicy
        );


        /*
         * Close when clicking outside
         * the modal.
         */

        overlay.addEventListener(
            "click",
            (event) => {

                if (
                    event.target === overlay
                ) {

                    closePolicy();

                }

            }
        );


        /*
         * Close with Escape.
         */

        document.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key === "Escape" &&
                    overlay.classList.contains(
                        "is-open"
                    )
                ) {

                    closePolicy();

                }

            }
        );

    }
);