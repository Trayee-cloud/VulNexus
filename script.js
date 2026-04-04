// ============================================================
//  Vulnexus – script.js
//  Handles the submit form on submit.html
//  Connects to backend at http://localhost:5000
// ============================================================

const API_BASE = "http://localhost:5000";

document.addEventListener("DOMContentLoaded", () => {
    const reportForm = document.getElementById("reportForm");
    const submitBtn  = document.getElementById("submitBtn");
    const toast      = document.getElementById("toast");

    // ── Smart Form Toggle (Vuln vs Bounty) ─────────────────
    const typeRadios    = document.querySelectorAll('input[name="submissionType"]');
    const bountySection = document.getElementById("bountySection");
    const bountyInputs  = [
        document.getElementById("bugType"),
        document.getElementById("severity"),
        document.getElementById("poc"),
        document.getElementById("bountyEligibility")
    ];

    if (typeRadios.length > 0 && bountySection) {
        typeRadios.forEach(radio => {
            radio.addEventListener("change", (e) => {
                const isBounty = e.target.value === "bounty";
                if (isBounty) {
                    bountySection.classList.add("show");
                    bountyInputs.forEach(input => input && input.setAttribute("required", "true"));
                } else {
                    bountySection.classList.remove("show");
                    bountyInputs.forEach(input => input && input.removeAttribute("required"));
                }
            });
        });
    }

    // ── Form Submit → POST /report ──────────────────────────
    if (reportForm) {
        reportForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const severityInput    = document.getElementById("severity");
            const bugTypeInput     = document.getElementById("bugType");
            const pocInput         = document.getElementById("poc");
            const eligibilityInput = document.getElementById("bountyEligibility");
            const submissionType   = document.querySelector('input[name="submissionType"]:checked')?.value || "vuln";
            const isBounty         = submissionType === "bounty";

            // Build payload matching backend expectations
            const payload = {
                domain:         document.getElementById("domain").value,
                name:           document.getElementById("name").value,
                email:          document.getElementById("email").value,
                url:            document.getElementById("url").value,
                description:    document.getElementById("description").value,
                impact:         document.getElementById("impact").value,
                submissionType: submissionType,
                bugType:        isBounty && bugTypeInput     ? bugTypeInput.value     : "N/A",
                severity:       isBounty && severityInput    ? severityInput.value    : "N/A",
                poc:            isBounty && pocInput         ? pocInput.value         : "N/A",
                bountyEligible: isBounty && eligibilityInput ? eligibilityInput.checked : false
            };

            // Loading state
            submitBtn.classList.add("loading");
            submitBtn.disabled = true;

            try {
                const response = await fetch(`${API_BASE}/report`, {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify(payload)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Submission failed.");
                }

                // Reset form
                reportForm.reset();
                if (bountySection) {
                    bountySection.classList.remove("show");
                    bountyInputs.forEach(input => input && input.removeAttribute("required"));
                }

                // Show success toast
                if (toast) {
                    toast.textContent = "✅ Report submitted successfully!";
                    toast.classList.add("show");
                    setTimeout(() => toast.classList.remove("show"), 4000);
                }

            } catch (err) {
                console.error("Submission error:", err);
                if (toast) {
                    toast.textContent = "❌ Error: " + err.message;
                    toast.style.background = "var(--accent-red, #ef4444)";
                    toast.classList.add("show");
                    setTimeout(() => {
                        toast.classList.remove("show");
                        toast.style.background = "";
                    }, 4000);
                }
            } finally {
                submitBtn.classList.remove("loading");
                submitBtn.disabled = false;
            }
        });
    }
});

// ── NEW: Fetch Domain Stats ────────────────────────────────
window.fetchDomainStats = async function() {
    try {
        const res = await fetch(`${API_BASE}/domain-stats`);
        if (!res.ok) throw new Error("Failed to fetch domain stats");
        return await res.json();
    } catch (err) {
        console.error("Domain stats error:", err);
        return [];
    }
};