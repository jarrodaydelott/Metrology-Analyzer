const MODAL_ID = "changelog-modal";

export function openChangelogModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.classList.remove("hidden");
    document.body.classList.add("changelog-modal-open");
    modal.querySelector(".changelog-modal-panel")?.focus();
}

export function closeChangelogModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.classList.remove("changelog-modal-open");
}

export function initChangelogModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;

    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeChangelogModal();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.classList.contains("hidden")) {
            closeChangelogModal();
        }
    });
}
