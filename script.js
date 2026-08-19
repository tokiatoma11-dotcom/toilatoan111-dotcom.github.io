// script.js - dùng chung cho toàn bộ website

document.addEventListener("DOMContentLoaded", () => {
  // Gắn class "active" cho link nav khớp với trang hiện tại
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("nav a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === currentPage) {
      link.classList.add("active");
    }
  });

  console.log("Website đã sẵn sàng ✅");
});
