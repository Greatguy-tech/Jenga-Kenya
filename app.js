(() => {
  "use strict";

  const STORAGE_KEY = "jenga-kenya-loan-manager-v1";
  const SETTINGS_KEY = "jenga-kenya-interface-settings-v1";
  const defaultSettings = { theme: "light", density: "comfortable", accent: "green" };
  const day = 86400000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOffset = (offset) => {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    return dateKey(date);
  };
  const monthOffset = (offset) => {
    const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    return dateKey(date);
  };
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const initialData = {
    clients: [
      { id: "c1", name: "Wanjiku Njoroge", phone: "+254 712 345 678" },
      { id: "c2", name: "Brian Otieno", phone: "+254 723 456 789" },
      { id: "c3", name: "Amina Hassan", phone: "+254 734 567 890" },
      { id: "c4", name: "Peter Mwangi", phone: "+254 701 234 567" }
    ],
    loans: [
      { id: "JK-2401", clientId: "c1", principal: 120000, rate: 10, installments: 6, startDate: monthOffset(-3), frequency: "monthly" },
      { id: "JK-2402", clientId: "c2", principal: 80000, rate: 12, installments: 4, startDate: monthOffset(-2), frequency: "monthly" },
      { id: "JK-2403", clientId: "c3", principal: 200000, rate: 15, installments: 8, startDate: monthOffset(-2), frequency: "monthly" },
      { id: "JK-2404", clientId: "c4", principal: 50000, rate: 10, installments: 5, startDate: monthOffset(-1), frequency: "monthly" }
    ],
    payments: []
  };
  let data;
  let settings = { ...defaultSettings };
  let currentView = "overview";
  let role = "lender";
  let toastTimer;
  const byId = (id) => document.getElementById(id);
  const money = (amount) => `KES ${Math.round(amount).toLocaleString("en-KE")}`;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const clientById = (id) => data.clients.find((client) => client.id === id);
  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return structuredClone(initialData);
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.loans) || !Array.isArray(parsed.payments)) {
        throw new Error("Saved loan data has an invalid format.");
      }
      return parsed;
    } catch (error) {
      console.error("Could not load Jenga Kenya demo data.", error);
      return structuredClone(initialData);
    }
  }

  function getSchedule(loan) {
    const total = Math.round(loan.principal * (1 + loan.rate / 100));
    const baseAmount = Math.floor(total / loan.installments);
    return Array.from({ length: loan.installments }, (_, index) => {
      const dueDate = new Date(`${loan.startDate}T00:00:00`);
      if (loan.frequency === "weekly") dueDate.setDate(dueDate.getDate() + 7 * (index + 1));
      else if (loan.frequency === "fortnightly") dueDate.setDate(dueDate.getDate() + 14 * (index + 1));
      else dueDate.setMonth(dueDate.getMonth() + index + 1);
      const due = dateKey(dueDate);
      const amount = index === loan.installments - 1 ? total - baseAmount * (loan.installments - 1) : baseAmount;
      const paid = data.payments.filter((payment) => payment.loanId === loan.id && payment.installment === index + 1)
        .reduce((sum, payment) => sum + payment.amount, 0);
      return { loan, installment: index + 1, dueDate: due, amount, paid, status: paid >= amount ? "paid" : due < dateOffset(0) ? "overdue" : "upcoming" };
    });
  }

  const allSchedule = () => data.loans.flatMap(getSchedule);
  const sum = (items, select) => items.reduce((total, item) => total + select(item), 0);
  const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
  const initials = (name) => name.split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
  const statusLabel = (status) => status.charAt(0).toUpperCase() + status.slice(1);
  const loanTotal = (loan) => Math.round(loan.principal * (1 + loan.rate / 100));
  const loanPaid = (loan) => sum(data.payments.filter((payment) => payment.loanId === loan.id), (payment) => payment.amount);
  const loanStatus = (loan) => {
    const schedule = getSchedule(loan);
    if (schedule.every((item) => item.status === "paid")) return "completed";
    return schedule.some((item) => item.status === "overdue") ? "overdue" : "active";
  };
  const statusPill = (status) => `<span class="status status-${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>`;

  function notify(message) {
    const toast = byId("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (!saved) return { ...defaultSettings };
      const parsed = JSON.parse(saved);
      return {
        theme: ["light", "dark"].includes(parsed.theme) ? parsed.theme : defaultSettings.theme,
        density: ["comfortable", "compact"].includes(parsed.density) ? parsed.density : defaultSettings.density,
        accent: ["green", "red", "black"].includes(parsed.accent) ? parsed.accent : defaultSettings.accent
      };
    } catch (error) {
      console.error("Could not load interface settings.", error);
      return { ...defaultSettings };
    }
  }

  function applySettings() {
    document.body.classList.toggle("dark-theme", settings.theme === "dark");
    document.body.classList.toggle("compact-mode", settings.density === "compact");
    document.documentElement.dataset.accent = settings.accent;
    document.documentElement.style.colorScheme = settings.theme;
  }

  function openSettings() {
    openDialog(`${dialogHeader("Customize your interface", "Choose how Jenga Kenya looks and feels on this device.")}<form id="settings-form"><div class="form-grid">
      <div class="form-field full"><label for="setting-theme">Appearance</label><select id="setting-theme" name="theme"><option value="light" ${settings.theme === "light" ? "selected" : ""}>Light theme</option><option value="dark" ${settings.theme === "dark" ? "selected" : ""}>Dark theme</option></select></div>
      <div class="form-field"><label for="setting-density">Layout spacing</label><select id="setting-density" name="density"><option value="comfortable" ${settings.density === "comfortable" ? "selected" : ""}>Comfortable</option><option value="compact" ${settings.density === "compact" ? "selected" : ""}>Compact</option></select></div>
      <div class="form-field"><label for="setting-accent">Accent color</label><select id="setting-accent" name="accent"><option value="green" ${settings.accent === "green" ? "selected" : ""}>Kenya green</option><option value="red" ${settings.accent === "red" ? "selected" : ""}>Kenya red</option><option value="black" ${settings.accent === "black" ? "selected" : ""}>Black</option></select></div>
      <div class="form-note">Your preferences are saved in this browser and apply to both account views.</div>
      </div><div class="dialog-actions"><button type="button" class="button button-secondary button-small" data-close>Cancel</button><button class="button button-primary button-small" type="submit">Save preferences</button></div></form>`);
  }

  function render() {
    const schedules = allSchedule();
    const unpaid = schedules.filter((item) => item.status !== "paid");
    const overdue = unpaid.filter((item) => item.status === "overdue");
    const upcoming = unpaid.filter((item) => item.status === "upcoming" && item.dueDate <= dateOffset(7));
    const collected = sum(data.payments.filter((payment) => payment.date.slice(0, 7) === dateOffset(0).slice(0, 7)), (payment) => payment.amount);
    const disbursed = sum(data.loans, (loan) => loan.principal);
    byId("stat-disbursed").textContent = money(disbursed);
    byId("stat-active").textContent = `${data.loans.filter((loan) => loanStatus(loan) !== "completed").length} active loans`;
    byId("stat-collected").textContent = money(collected);
    byId("stat-overdue").textContent = String(overdue.length);
    byId("stat-overdue-amount").textContent = `${money(sum(overdue, (item) => item.amount - item.paid))} outstanding`;
    byId("stat-upcoming").textContent = String(upcoming.length);
    byId("stat-upcoming-amount").textContent = `${money(sum(upcoming, (item) => item.amount - item.paid))} expected`;
    byId("chart-collected").textContent = money(collected);
    byId("loan-nav-count").textContent = String(data.loans.length);
    byId("recent-loans").innerHTML = data.loans.slice().reverse().slice(0, 4).map((loan) => loanRow(loan, false)).join("");
    renderChart(Number(byId("chart-period").value));
    renderWatch(schedules);
    renderLoans();
    renderClients();
    renderPayments(schedules);
    renderClient();
  }

  function loanRow(loan, withProgress) {
    const client = clientById(loan.clientId);
    const schedule = getSchedule(loan);
    const next = schedule.find((item) => item.status !== "paid");
    const progress = Math.min(100, Math.round(loanPaid(loan) / loanTotal(loan) * 100));
    return `<tr>
      <td><div class="client-cell"><span class="client-avatar">${escapeHtml(initials(client?.name || "Client"))}</span><div><strong>${escapeHtml(client?.name || "Unknown client")}</strong><span>${escapeHtml(loan.id)}</span></div></div></td>
      <td>${money(loan.principal)}</td><td>${money(loanTotal(loan))}</td>
      ${withProgress ? `<td><div class="progress-cell"><div class="mini-progress"><i style="width:${progress}%"></i></div><span>${progress}%</span></div></td>` : ""}
      <td>${next ? formatDate(next.dueDate) : "—"}</td><td>${statusPill(loanStatus(loan))}</td>
      <td><button class="row-action" data-action="loan" data-id="${escapeHtml(loan.id)}">Details</button></td>
    </tr>`;
  }

  function renderChart(count) {
    const months = Array.from({ length: count }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth() - (count - index - 1), 1);
      return { key: dateKey(date).slice(0, 7), label: date.toLocaleDateString("en-KE", { month: "short" }) };
    });
    const values = months.map((month) => sum(data.payments.filter((payment) => payment.date.slice(0, 7) === month.key), (payment) => payment.amount));
    const max = Math.max(1, ...values, ...data.loans.map((loan) => loanTotal(loan) / Math.max(loan.installments, 1)));
    byId("repayment-chart").innerHTML = months.map((month, index) => {
      const paidHeight = Math.max(values[index] ? 8 : 3, values[index] / max * 95);
      const pending = unpaidForMonth(month.key);
      const remainingHeight = Math.min(35, pending / max * 35);
      return `<div class="chart-column"><div class="bar-stack"><div class="bar-remaining" style="height:${remainingHeight}px"></div><div class="bar-paid" style="height:${paidHeight}px"></div></div><span class="chart-month">${escapeHtml(month.label)}</span></div>`;
    }).join("");
  }
  function unpaidForMonth(month) {
    return sum(allSchedule().filter((item) => item.dueDate.slice(0, 7) === month && item.status !== "paid"), (item) => item.amount - item.paid);
  }

  function renderWatch(schedules) {
    const items = schedules.filter((item) => item.status !== "paid")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4);
    byId("payment-watch").innerHTML = items.length ? items.map((item) => {
      const date = new Date(`${item.dueDate}T00:00:00`);
      return `<div class="watch-item"><div class="watch-date ${item.status === "overdue" ? "late" : ""}"><strong>${date.getDate()}</strong><span>${date.toLocaleDateString("en-KE", { month: "short" })}</span></div><div class="watch-main"><strong>${escapeHtml(clientById(item.loan.clientId)?.name || "Unknown client")}</strong><span>${item.status === "overdue" ? "Overdue" : "Due"} · instalment ${item.installment}</span></div><span class="watch-amount">${money(item.amount - item.paid)}</span></div>`;
    }).join("") : `<div class="empty-state">No payments to watch. You’re all caught up!</div>`;
  }

  function renderLoans() {
    const query = byId("loan-search").value.trim().toLowerCase();
    const status = byId("loan-filter").value;
    const loans = data.loans.filter((loan) => {
      const name = clientById(loan.clientId)?.name || "";
      return `${name} ${loan.id}`.toLowerCase().includes(query) && (status === "all" || loanStatus(loan) === status);
    });
    byId("loans-table").innerHTML = loans.map((loan) => loanRow(loan, true)).join("");
    byId("loans-empty").classList.toggle("hidden", loans.length > 0);
  }

  function renderClients() {
    const query = byId("client-search").value.trim().toLowerCase();
    const clients = data.clients.filter((client) => `${client.name} ${client.phone}`.toLowerCase().includes(query));
    byId("client-count").textContent = `${clients.length} client${clients.length === 1 ? "" : "s"}`;
    byId("clients-table").innerHTML = clients.map((client) => {
      const loans = data.loans.filter((loan) => loan.clientId === client.id);
      const outstanding = sum(loans, (loan) => Math.max(0, loanTotal(loan) - loanPaid(loan)));
      return `<tr><td><div class="client-cell"><span class="client-avatar">${escapeHtml(initials(client.name))}</span><div><strong>${escapeHtml(client.name)}</strong><span>${loans.length} loan${loans.length === 1 ? "" : "s"}</span></div></div></td><td>${escapeHtml(client.phone)}</td><td>${loans.filter((loan) => loanStatus(loan) !== "completed").length}</td><td>${money(sum(loans, (loan) => loan.principal))}</td><td>${money(outstanding)}</td><td><button class="row-action" data-action="client" data-id="${escapeHtml(client.id)}">View</button></td></tr>`;
    }).join("");
    byId("clients-empty").classList.toggle("hidden", clients.length > 0);
  }

  function renderPayments(schedules) {
    const query = byId("payment-search").value.trim().toLowerCase();
    const filter = byId("payment-filter").value;
    const items = schedules.filter((item) => {
      const name = clientById(item.loan.clientId)?.name || "";
      return name.toLowerCase().includes(query) && (filter === "all" || item.status === filter);
    }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    byId("payments-table").innerHTML = items.map((item) => `<tr><td><div class="client-cell"><span class="client-avatar">${escapeHtml(initials(clientById(item.loan.clientId)?.name || "Client"))}</span><div><strong>${escapeHtml(clientById(item.loan.clientId)?.name || "Unknown client")}</strong><span>${escapeHtml(clientById(item.loan.clientId)?.phone || "")}</span></div></div></td><td>${item.installment} of ${item.loan.installments}</td><td>${formatDate(item.dueDate)}</td><td>${money(item.amount - item.paid)}</td><td>${escapeHtml(item.loan.id)}</td><td>${statusPill(item.status)}</td><td>${item.status !== "paid" ? `<button class="row-action" data-action="record-payment" data-loan="${escapeHtml(item.loan.id)}" data-installment="${item.installment}" data-amount="${item.amount - item.paid}">Record payment</button>` : "—"}</td></tr>`).join("");
    byId("payments-empty").classList.toggle("hidden", items.length > 0);
    const overdue = schedules.filter((item) => item.status === "overdue");
    const upcoming = schedules.filter((item) => item.status === "upcoming" && item.dueDate <= dateOffset(7));
    const paid = schedules.filter((item) => item.status === "paid");
    byId("payment-summary").innerHTML = [
      ["Overdue instalments", overdue.length, "overdue"],
      ["Due in the next 7 days", upcoming.length, ""],
      ["Payments completed", paid.length, ""]
    ].map(([label, amount, style]) => `<div class="payment-summary-card ${style}"><span>${label}</span><strong>${amount}</strong></div>`).join("");
  }

  function renderClient() {
    const client = data.clients[0];
    const home = byId("client-home");
    const lenderStats = byId("lender-stats");
    const lenderOverview = byId("lender-overview");
    const recent = byId("recent-loans-panel");
    const clientRole = role === "client";
    document.body.classList.toggle("client-mode", clientRole);
    document.body.classList.toggle("client-schedule", clientRole && currentView === "schedule");
    home.classList.toggle("hidden", !clientRole);
    lenderStats.classList.toggle("hidden", clientRole);
    lenderOverview.classList.toggle("hidden", clientRole);
    recent.classList.toggle("hidden", clientRole);
    byId("primary-action").classList.toggle("hidden", clientRole);
    byId("welcome-title").innerHTML = clientRole ? `Hello, ${escapeHtml(client?.name || "there")} <span>✦</span>` : "Good morning, Lydiah Wangari <span>✦</span>";
    byId("welcome-subtitle").textContent = clientRole ? "Here’s a clear view of your loan and repayment plan." : "Here’s what’s happening with your loan portfolio today.";
    byId("profile-name").textContent = clientRole ? (client?.name || "Client") : "Lydiah Wangari";
    byId("profile-role").textContent = clientRole ? "Client account" : "Lender account";
    byId("profile-avatar").textContent = clientRole ? initials(client?.name || "Client") : "LW";
    byId("topbar-avatar").textContent = clientRole ? initials(client?.name || "Client") : "LW";
    byId("workspace-label").textContent = clientRole ? "MY ACCOUNT" : "WORKSPACE";
    byId("help-title").textContent = clientRole ? "Need help with your loan?" : "Need a hand?";
    byId("help-copy").textContent = clientRole
      ? "Questions about a payment or your account? Get in touch."
      : "Our team is here to help you get started.";
    if (!clientRole || !client) return;
    const loans = data.loans.filter((loan) => loan.clientId === client.id);
    const schedules = loans.flatMap(getSchedule);
    const borrowed = sum(loans, (loan) => loan.principal);
    const balance = sum(loans, (loan) => Math.max(0, loanTotal(loan) - loanPaid(loan)));
    const paid = sum(loans, loanPaid);
    const next = schedules.filter((item) => item.status !== "paid").sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const remaining = schedules.filter((item) => item.status !== "paid").length;
    const percent = borrowed ? Math.min(100, Math.round(paid / sum(loans, loanTotal) * 100)) : 0;
    byId("client-balance").textContent = money(balance);
    byId("client-principal").textContent = money(borrowed);
    byId("client-paid").textContent = money(paid);
    byId("client-next").textContent = next ? money(next.amount - next.paid) : "—";
    byId("client-next-date").textContent = next ? `${next.status === "overdue" ? "Overdue · " : "Due · "}${formatDate(next.dueDate)}` : "No payment due";
    byId("client-left").textContent = String(remaining);
    byId("client-progress-percent").textContent = `${percent}%`;
    byId("client-progress-bar").style.width = `${percent}%`;
    byId("client-progress-copy").textContent = `${money(paid)} repaid of ${money(sum(loans, loanTotal))}.`;
    byId("client-target").textContent = loans.length ? formatDate(schedules[schedules.length - 1].dueDate) : "No loans yet";
    byId("client-schedule").innerHTML = schedules.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((item) => `<tr><td>Instalment ${item.installment} <span style="color:#a0a8a3">· ${escapeHtml(item.loan.id)}</span></td><td>${formatDate(item.dueDate)}</td><td>${money(item.amount)}</td><td>${money(item.paid)}</td><td>${statusPill(item.status)}</td></tr>`).join("") || `<tr><td colspan="5">No loan schedule yet. Contact Jenga Kenya for details.</td></tr>`;
  }

  function showView(view) {
    if (role === "client" && !["overview", "schedule"].includes(view)) {
      notify("That page is not available in your client account.");
      return;
    }
    currentView = view;
    const activePanel = role === "client" ? "overview" : view;
    document.querySelectorAll(".view-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `${activePanel}-view`));
    document.querySelectorAll(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    document.body.classList.toggle("client-schedule", role === "client" && view === "schedule");
    const title = view === "schedule" ? "Repayment plan" : view === "overview" ? "Overview" : view.charAt(0).toUpperCase() + view.slice(1);
    byId("page-title").textContent = role === "client" ? (view === "schedule" ? "Repayment plan" : "My overview") : title;
    byId("sidebar").classList.remove("open");
  }

  function openDialog(content) {
    byId("dialog-content").innerHTML = content;
    byId("app-dialog").showModal();
  }
  function closeDialog() { byId("app-dialog").close(); }
  function dialogHeader(title, subtitle) {
    return `<div class="dialog-heading"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="dialog-close" type="button" data-close aria-label="Close">×</button></div>`;
  }

  function openLoanForm() {
    if (!data.clients.length) {
      notify("Add a client before creating a loan.");
      showView("clients");
      openClientForm();
      return;
    }
    const options = data.clients.map((client) => `<option value="${escapeHtml(client.id)}">${escapeHtml(client.name)}</option>`).join("");
    openDialog(`${dialogHeader("Create a new loan", "Set up the loan and its repayment schedule.")}<form id="loan-form"><div class="form-grid">
      <div class="form-field full"><label for="loan-client">Client</label><select id="loan-client" name="clientId" required>${options}</select></div>
      <div class="form-field"><label for="loan-amount">Loan amount (KES)</label><input id="loan-amount" name="principal" type="number" min="1" step="1" placeholder="50,000" required></div>
      <div class="form-field"><label for="loan-rate">Interest rate (%)</label><input id="loan-rate" name="rate" type="number" min="0" max="1000" step="0.1" value="10" required></div>
      <div class="form-field"><label for="loan-installments">Number of instalments</label><input id="loan-installments" name="installments" type="number" min="1" max="120" value="6" required></div>
      <div class="form-field"><label for="loan-frequency">Payment frequency</label><select id="loan-frequency" name="frequency"><option value="monthly">Monthly</option><option value="fortnightly">Fortnightly</option><option value="weekly">Weekly</option></select></div>
      <div class="form-field full"><label for="loan-start">Loan start date</label><input id="loan-start" name="startDate" type="date" value="${dateOffset(0)}" required></div>
      <div class="form-note">Instalments are calculated using a simple flat interest rate and equal payments. This demo does not disburse funds.</div>
      </div><div class="dialog-actions"><button type="button" class="button button-secondary button-small" data-close>Cancel</button><button class="button button-primary button-small" type="submit">Create loan</button></div></form>`);
  }

  function openClientForm() {
    openDialog(`${dialogHeader("Add a client", "Add a borrower to your Jenga Kenya portfolio.")}<form id="client-form"><div class="form-grid">
      <div class="form-field full"><label for="client-name">Full name</label><input id="client-name" name="name" autocomplete="name" required placeholder="e.g. Mary Wanjiku"></div>
      <div class="form-field full"><label for="client-phone">Phone number</label><input id="client-phone" name="phone" type="tel" autocomplete="tel" required placeholder="+254 7XX XXX XXX"></div>
      <div class="form-note">This demo stores client information only in this browser. It does not send invitations or messages.</div>
      </div><div class="dialog-actions"><button type="button" class="button button-secondary button-small" data-close>Cancel</button><button class="button button-primary button-small" type="submit">Add client</button></div></form>`);
  }

  function openPaymentForm(loanId, installment, amount) {
    const loan = data.loans.find((item) => item.id === loanId);
    if (!loan) return;
    const client = clientById(loan.clientId);
    openDialog(`${dialogHeader("Record a repayment", "Log a payment received from your client.")}<form id="payment-form"><div class="detail-list">
      <div class="detail-row"><span>Client</span><strong>${escapeHtml(client?.name || "Unknown client")}</strong></div>
      <div class="detail-row"><span>Loan & instalment</span><strong>${escapeHtml(loan.id)} · ${installment} of ${loan.installments}</strong></div>
      <div class="detail-row"><span>Amount remaining</span><strong>${money(amount)}</strong></div>
      </div><div class="form-grid"><div class="form-field"><label for="payment-amount">Amount received (KES)</label><input id="payment-amount" name="amount" type="number" min="1" max="${amount}" step="1" value="${amount}" required></div><div class="form-field"><label for="payment-date">Payment date</label><input id="payment-date" name="date" type="date" max="${dateOffset(0)}" value="${dateOffset(0)}" required></div><input type="hidden" name="loanId" value="${escapeHtml(loanId)}"><input type="hidden" name="installment" value="${installment}"></div>
      <div class="dialog-actions"><button type="button" class="button button-secondary button-small" data-close>Cancel</button><button class="button button-primary button-small" type="submit">Save repayment</button></div></form>`);
  }

  function openLoanDetails(loanId) {
    const loan = data.loans.find((item) => item.id === loanId);
    if (!loan) return;
    const schedule = getSchedule(loan);
    const client = clientById(loan.clientId);
    openDialog(`${dialogHeader(`Loan ${escapeHtml(loan.id)}`, `Borrower: ${escapeHtml(client?.name || "Unknown client")}`)}<div class="detail-list">
      <div class="detail-row"><span>Original amount</span><strong>${money(loan.principal)}</strong></div>
      <div class="detail-row"><span>Total repayment</span><strong>${money(loanTotal(loan))}</strong></div>
      <div class="detail-row"><span>Interest rate</span><strong>${loan.rate}% flat</strong></div>
      <div class="detail-row"><span>Repaid so far</span><strong>${money(loanPaid(loan))}</strong></div>
      <div class="detail-row"><span>Outstanding balance</span><strong>${money(Math.max(0, loanTotal(loan) - loanPaid(loan)))}</strong></div>
      <div class="detail-row"><span>Status</span><strong>${statusLabel(loanStatus(loan))}</strong></div>
      </div><div class="dialog-actions"><button type="button" class="button button-secondary button-small" data-close>Close</button>${schedule.some((item) => item.status !== "paid") ? `<button type="button" class="button button-primary button-small" data-action="record-next" data-id="${escapeHtml(loan.id)}">Record payment</button>` : ""}</div>`);
  }

  function openClientDetails(clientId) {
    const client = clientById(clientId);
    if (!client) return;
    const loans = data.loans.filter((loan) => loan.clientId === client.id);
    openDialog(`${dialogHeader(escapeHtml(client.name), "Client account summary")}<div class="detail-list">
      <div class="detail-row"><span>Phone number</span><strong>${escapeHtml(client.phone)}</strong></div>
      <div class="detail-row"><span>Loans</span><strong>${loans.length}</strong></div>
      <div class="detail-row"><span>Total borrowed</span><strong>${money(sum(loans, (loan) => loan.principal))}</strong></div>
      <div class="detail-row"><span>Outstanding</span><strong>${money(sum(loans, (loan) => Math.max(0, loanTotal(loan) - loanPaid(loan))))}</strong></div>
      </div><div class="dialog-actions"><button type="button" class="button button-secondary button-small" data-close>Close</button><button type="button" class="button button-primary button-small" data-action="new-client-loan" data-id="${escapeHtml(client.id)}">＋ New loan</button></div>`);
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.hasAttribute("data-close")) { closeDialog(); return; }
    if (target.dataset.view) { showView(target.dataset.view); return; }
    if (target.dataset.go) { showView(target.dataset.go); return; }
    if (target.id === "primary-action" || target.id === "add-loan-button") { openLoanForm(); return; }
    if (target.id === "add-client-button") { openClientForm(); return; }
    if (target.id === "mobile-menu") { byId("sidebar").classList.toggle("open"); return; }
    if (target.dataset.action === "open-settings") { openSettings(); return; }
    if (target.dataset.action === "switch-lender") {
      byId("role-select").value = "lender";
      byId("role-select").dispatchEvent(new Event("change"));
      notify("Switched to the lender account.");
      return;
    }
    if (target.dataset.action === "loan") { openLoanDetails(target.dataset.id); return; }
    if (target.dataset.action === "client") { openClientDetails(target.dataset.id); return; }
    if (target.dataset.action === "record-payment") { openPaymentForm(target.dataset.loan, Number(target.dataset.installment), Number(target.dataset.amount)); return; }
    if (target.dataset.action === "record-next") {
      const loan = data.loans.find((item) => item.id === target.dataset.id);
      const next = loan && getSchedule(loan).find((item) => item.status !== "paid");
      closeDialog();
      if (next) openPaymentForm(loan.id, next.installment, next.amount - next.paid);
      return;
    }
    if (target.dataset.action === "new-client-loan") {
      const clientId = target.dataset.id;
      closeDialog();
      openLoanForm();
      byId("loan-client").value = clientId;
    }
  });

  byId("app-dialog").addEventListener("click", (event) => {
    if (event.target === byId("app-dialog")) closeDialog();
  });
  byId("app-dialog").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const values = Object.fromEntries(new FormData(form).entries());
    if (form.id === "client-form") {
      const name = values.name.trim();
      const phone = values.phone.trim();
      if (!name || !phone) return;
      const duplicate = data.clients.some((client) => client.phone.replace(/\s/g, "") === phone.replace(/\s/g, ""));
      if (duplicate) { notify("A client with this phone number already exists."); return; }
      data.clients.push({ id: `c${Date.now()}`, name, phone });
      save(); closeDialog(); render(); showView("clients"); notify("Client added successfully.");
    } else if (form.id === "loan-form") {
      const principal = Number(values.principal);
      const rate = Number(values.rate);
      const installments = Number(values.installments);
      if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(rate) || rate < 0 || !Number.isInteger(installments) || installments < 1 || installments > 120) {
        notify("Enter a valid loan amount, rate and instalment count."); return;
      }
      const loan = { id: `JK-${String(Date.now()).slice(-6)}`, clientId: values.clientId, principal, rate, installments, startDate: values.startDate, frequency: values.frequency };
      data.loans.push(loan); save(); closeDialog(); render(); showView("loans"); notify(`Loan ${loan.id} created.`);
    } else if (form.id === "payment-form") {
      const loan = data.loans.find((item) => item.id === values.loanId);
      const installment = Number(values.installment);
      const amount = Number(values.amount);
      const scheduleItem = loan && getSchedule(loan).find((item) => item.installment === installment);
      if (!scheduleItem || !Number.isFinite(amount) || amount <= 0 || amount > scheduleItem.amount - scheduleItem.paid) {
        notify("Enter a valid amount up to the remaining instalment balance."); return;
      }
      data.payments.push({ id: `p${Date.now()}`, loanId: loan.id, installment, amount, date: values.date });
      save(); closeDialog(); render(); notify("Repayment recorded successfully.");
    } else if (form.id === "settings-form") {
      const nextSettings = {
        theme: values.theme,
        density: values.density,
        accent: values.accent
      };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
      } catch (error) {
        console.error("Could not save interface settings.", error);
        notify("Settings could not be saved in this browser.");
        return;
      }
      settings = nextSettings;
      applySettings();
      closeDialog();
      notify("Your interface preferences have been saved.");
    }
  });

  byId("role-select").addEventListener("change", (event) => {
    role = event.target.value;
    renderClient();
    showView("overview");
  });
  byId("chart-period").addEventListener("change", (event) => renderChart(Number(event.target.value)));
  byId("loan-search").addEventListener("input", renderLoans);
  byId("loan-filter").addEventListener("change", renderLoans);
  byId("client-search").addEventListener("input", renderClients);
  byId("payment-search").addEventListener("input", () => renderPayments(allSchedule()));
  byId("payment-filter").addEventListener("change", () => renderPayments(allSchedule()));
  byId("current-year").textContent = String(today.getFullYear());

  data = loadData();
  settings = loadSettings();
  applySettings();
  render();
})();
