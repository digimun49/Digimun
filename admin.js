// admin.js — Digimun Admin (robust email search + prefix search + filters + pagination)
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, updateDoc, serverTimestamp,
  collection, query, where, orderBy, limit, startAfter, getDocs, documentId
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---------- CONFIG ----------
const ADMIN_EMAIL = "muneebg249@gmail.com"; // change if needed
const PAGE_SIZE = 50;

// ---------- DOM ----------
const sidebarToggle = document.getElementById("sidebar-toggle");
const tableBody     = document.getElementById("user-data");
const loadMoreBtn   = document.getElementById("load-more");
const searchBtn     = document.getElementById("search-btn");
const prefixBtn     = document.getElementById("prefix-btn");
const searchInput   = document.getElementById("search-email");

// Filter controls
const applyFilterBtn = document.getElementById("apply-filter");
const clearFilterBtn = document.getElementById("clear-filter");
const filterFieldSel = document.getElementById("filter-field");
const filterValueSel = document.getElementById("filter-value");

// ---------- UI helpers ----------
function toggleSpinner(show) {
  const s = document.getElementById("loading-spinner");
  if (s) s.style.display = show ? "block" : "none";
}
if (sidebarToggle) {
  sidebarToggle.addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    sidebar.style.width = sidebar.style.width === "250px" ? "0" : "250px";
  });
}

// ---------- Auth guard (client-side UX; enforce via rules server-side) ----------
onAuthStateChanged(auth, (user) => {
  if (!user || user.email !== ADMIN_EMAIL) {
    alert("Access Denied. You are not an admin.");
    window.location.href = "login.html";
  }
});

// ---------- Utils ----------
function cleanEmail(s) {
  if (!s) return "";
  // remove zero-width + NBSP, then trim + lowercase
  return s.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "").trim().toLowerCase();
}
function statusBadge(val) {
  const safe = (val || "pending").toLowerCase();
  const klass = safe === "approved" ? "status-approved"
             : safe === "suspended" ? "status-suspended"
             : "status-pending";
  return `<span class="status-badge ${klass}">${safe}</span>`;
}
function formatApprovedAt(ts) {
  try {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d)) return "—";
    return d.toLocaleString();
  } catch { return "—"; }
}
function renderRow(email, data) {
  const approvedDate = formatApprovedAt(data.approvedAt);
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${email}</td>

    <td>
      <label class="switch">
        <input type="checkbox" ${data.status === "approved" ? "checked" : ""}
               aria-label="Toggle main status for ${email}"
               onchange="toggleSwitchStatus('${email}', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="font-size:12px;margin-top:4px;">${statusBadge(data.status)}</div>
    </td>

    <td>
      <label class="switch">
        <input type="checkbox" ${data.paymentStatus === "approved" ? "checked" : ""}
               aria-label="Toggle payment status for ${email}"
               onchange="toggleSwitchField('${email}', 'paymentStatus', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="font-size:12px;margin-top:4px;">${statusBadge(data.paymentStatus)}</div>
    </td>

    <td>
      <label class="switch">
        <input type="checkbox" ${data.quotexStatus === "approved" ? "checked" : ""}
               aria-label="Toggle quotex status for ${email}"
               onchange="toggleSwitchField('${email}', 'quotexStatus', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="font-size:12px;margin-top:4px;">${statusBadge(data.quotexStatus)}</div>
    </td>

    <td>
      <label class="switch">
        <input type="checkbox" ${data.recoveryRequest === "approved" ? "checked" : ""}
               aria-label="Toggle recovery status for ${email}"
               onchange="toggleSwitchField('${email}', 'recoveryRequest', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="font-size:12px;margin-top:4px;">${statusBadge(data.recoveryRequest)}</div>
    </td>

    <td>
      <label class="switch">
        <input type="checkbox" ${data.digimaxStatus === "approved" ? "checked" : ""}
               aria-label="Toggle digimax status for ${email}"
               onchange="toggleSwitchField('${email}', 'digimaxStatus', this.checked)">
        <span class="slider"></span>
      </label>
      <div style="font-size:12px;margin-top:4px;">${statusBadge(data.digimaxStatus)}</div>
    </td>

    <td>${approvedDate}</td>
  `;
  return tr;
}
function setTableMessage(msg) {
  tableBody.innerHTML = `<tr><td colspan="7" class="hint">${msg}</td></tr>`;
}

// ---------- Search (exact + fallback field query) ----------
if (searchBtn) {
  searchBtn.addEventListener("click", async () => {
    const raw = searchInput?.value || "";
    const typedLower = cleanEmail(raw);
    if (!typedLower) return;

    toggleSpinner(true);
    tableBody.innerHTML = "";

    try {
      // 1) try docId == lower
      let snap = await getDoc(doc(db, "users", typedLower));

      // 1b) try docId == original trimmed (for legacy mixed-case docIds)
      if (!snap.exists() && raw.trim() !== typedLower) {
        snap = await getDoc(doc(db, "users", raw.trim()));
      }

      if (snap.exists()) {
        tableBody.appendChild(renderRow(snap.id, snap.data()));
      } else {
        // 2) try field queries (prefer emailLower)
        const usersCol = collection(db, "users");
        let qs = await getDocs(query(usersCol, where("emailLower", "==", typedLower), limit(1)));
        if (qs.empty) {
          qs = await getDocs(query(usersCol, where("email", "==", raw.trim()), limit(1)));
        }
        if (!qs.empty) {
          const d = qs.docs[0];
          tableBody.appendChild(renderRow(d.id, d.data()));
        } else {
          setTableMessage("User not found");
        }
      }
    } catch (e) {
      console.error(e);
      setTableMessage("Error loading user");
    } finally {
      toggleSpinner(false);
      // reset filter state
      currentField = null; currentValue = null; lastDoc = null;
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
    }
  });
}
// Enter to search
if (searchInput) {
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchBtn?.click();
  });
}

// ---------- Optional: Prefix search (emailLower starts-with) ----------
if (prefixBtn) {
  prefixBtn.addEventListener("click", async () => {
    const raw = searchInput?.value || "";
    const p = cleanEmail(raw);
    if (!p) return;

    toggleSpinner(true);
    tableBody.innerHTML = "";
    try {
      // Compute simple end bound: increment last char
      const end = p.slice(0, -1) + String.fromCharCode(p.charCodeAt(p.length - 1) + 1);
      const usersCol = collection(db, "users");
      const qy = query(
        usersCol,
        orderBy("emailLower"),
        where("emailLower", ">=", p),
        where("emailLower", "<", end),
        limit(PAGE_SIZE)
      );
      const qs = await getDocs(qy);
      if (qs.empty) {
        setTableMessage("No matches");
      } else {
        qs.forEach(d => tableBody.appendChild(renderRow(d.id, d.data())));
      }
      currentField = null; currentValue = null; lastDoc = null; // this is not the filter pager
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
    } catch (e) {
      console.error(e);
      setTableMessage("Error loading list");
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
    } finally {
      toggleSpinner(false);
    }
  });
}

// ---------- Filters (with pagination) ----------
let currentField = null;
let currentValue = null;
let lastDoc = null;

async function runFilter(firstPage = true) {
  if (!currentField || !currentValue) return;
  if (firstPage) { tableBody.innerHTML = ""; lastDoc = null; }

  toggleSpinner(true);
  try {
    let base = query(
      collection(db, "users"),
      where(currentField, "==", currentValue),
      orderBy(documentId()),
      limit(PAGE_SIZE)
    );
    if (lastDoc) {
      base = query(
        collection(db, "users"),
        where(currentField, "==", currentValue),
        orderBy(documentId()),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
    }

    const qs = await getDocs(base);
    if (qs.empty && firstPage) {
      setTableMessage(`No users found for <b>${currentField}</b> = <b>${currentValue}</b>`);
      if (loadMoreBtn) loadMoreBtn.style.display = "none";
      return;
    }
    qs.forEach(d => tableBody.appendChild(renderRow(d.id, d.data())));
    lastDoc = qs.docs[qs.docs.length - 1] || null;
    if (loadMoreBtn) loadMoreBtn.style.display = qs.size === PAGE_SIZE ? "inline-block" : "none";
  } catch (e) {
    console.error(e);
    if (firstPage) setTableMessage("Error loading list");
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
  } finally {
    toggleSpinner(false);
  }
}
if (applyFilterBtn) {
  applyFilterBtn.addEventListener("click", async () => {
    currentField = filterFieldSel?.value || null;
    currentValue = filterValueSel?.value || null;
    await runFilter(true);
  });
}
if (loadMoreBtn) {
  loadMoreBtn.addEventListener("click", async () => { await runFilter(false); });
}
if (clearFilterBtn) {
  clearFilterBtn.addEventListener("click", () => {
    currentField = null; currentValue = null; lastDoc = null;
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
    setTableMessage("Filters cleared. Use search or apply a filter.");
  });
}

// ---------- Firestore updates (switches) ----------
window.toggleSwitchStatus = async function (email, isChecked) {
  try {
    toggleSpinner(true);
    const newStatus = isChecked ? "approved" : "pending";
    const updateObj = { status: newStatus };
    if (newStatus === "approved") updateObj.approvedAt = serverTimestamp();
    await updateDoc(doc(db, "users", email), updateObj);
    await refreshRowOrView(email);
  } catch (e) {
    alert(e.message);
  } finally { toggleSpinner(false); }
};
window.toggleSwitchField = async function (email, field, isChecked) {
  try {
    toggleSpinner(true);
    const newValue = isChecked ? "approved" : "pending";
    await updateDoc(doc(db, "users", email), { [field]: newValue });
    await refreshRowOrView(email);
  } catch (e) {
    alert(e.message);
  } finally { toggleSpinner(false); }
};

async function refreshRowOrView(email) {
  // If in filter mode → rerun filter page; else if typed → repeat search; else reload only this doc
  if (currentField && currentValue) return runFilter(true);

  const typedLower = cleanEmail(searchInput?.value || "");
  if (typedLower) return searchBtn?.click();

  // No filter and no search → reload just this row
  tableBody.innerHTML = "";
  const snap = await getDoc(doc(db, "users", email));
  if (snap.exists()) tableBody.appendChild(renderRow(email, snap.data()));
}
