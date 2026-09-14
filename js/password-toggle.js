// Password show/hide toggle — attaches a small eye button to every
// input[type=password] on the page. Loaded after the form markup; it
// runs on DOMContentLoaded so it works whether the script is in <head>
// or at the end of <body>. Safe to include on pages with a zero password
// fields, and never double-wraps an already-toggled input.
(function () {
  function attach(input) {
    if (input.dataset.passwordToggle === "1") return;
    input.dataset.passwordToggle = "1";
    input.classList.add("has-toggle");

    const wrap = document.createElement("div");
    wrap.className = "password-field-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "password-toggle-btn";
    btn.setAttribute("aria-label", "Show password");
    btn.title = "Show / hide password";
    btn.innerHTML = '<i class="fa-solid fa-eye" aria-hidden="true"></i>';
    wrap.appendChild(btn);

    btn.addEventListener("click", () => {
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      btn.innerHTML = showing
        ? '<i class="fa-solid fa-eye" aria-hidden="true"></i>'
        : '<i class="fa-solid fa-eye-slash" aria-hidden="true"></i>';
      input.focus();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('input[type="password"]').forEach(attach);
  });
})();