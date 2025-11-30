document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault(); // HENTIKAN REFRESH

    const username = document.getElementById("user").value;
    const password = document.getElementById("pass").value;

    const statusBox = document.getElementById("status");
    statusBox.textContent = "Memproses...";

    try {
        const res = await fetch("/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
            credentials: "include"   // ← INI YANG KURANG!!
        });

        const data = await res.json();

        if (data.success) {
            statusBox.style.color = "#8aff8a";
            statusBox.textContent = "Login berhasil! Mengalihkan...";

            setTimeout(() => {
                window.location.href = "/admin/dashboard";
            }, 700);
        } else {
            statusBox.style.color = "#ff7777";
            statusBox.textContent = "Username atau password salah!";
        }

    } catch (err) {
        statusBox.textContent = "Server error!";
    }
});