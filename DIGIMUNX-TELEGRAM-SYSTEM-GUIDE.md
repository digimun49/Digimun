# DigimunX Telegram System - Complete A to Z Guide

## Overview
DigimunX Telegram page displays trading signals from an external backend API. This document explains the complete system flow.

---

## 1. BACKEND API (External Server)

**Base URL:** `https://expert-backend--digimun49.replit.app`

### API Endpoints:

| Action | Method | Endpoint | Example |
|--------|--------|----------|---------|
| Get All Signals | GET | `/api/signals` | `/api/signals?limit=500` |
| Get Statistics | GET | `/api/stats` | `/api/stats` |
| Update Signal | PUT | `/api/signals/{signal_id}` | `/api/signals/SIG_1234567890_EURUSD` |
| Delete Signal | DELETE | `/api/signals/{signal_id}` | `/api/signals/SIG_1234567890_EURUSD` |

### Important Notes:
- PUT and DELETE operations require `signal_id` (e.g., `SIG_1234567890_EURUSD`) in URL path
- DO NOT use numeric `id` for PUT/DELETE
- DO NOT use query parameters like `?id=SIG_123`

### Expected API Responses:

**GET /api/signals Response:**
```json
{
  "success": true,
  "signals": [
    {
      "id": 1,
      "signal_id": "SIG_1234567890_EURUSD",
      "pair": "EUR/USD",
      "direction": "CALL",
      "confidence": 85,
      "signal_time": "2026-02-01 10:30:00",
      "result_time": "2026-02-01 10:31:00",
      "result": "WIN",
      "reason": "Strong bullish momentum detected"
    }
  ]
}
```

**GET /api/stats Response:**
```json
{
  "stats": {
    "overall": {
      "total_signals": 150,
      "wins": 120,
      "losses": 30,
      "win_rate": 80
    },
    "today": {
      "total_signals": 15,
      "win_rate": 85
    },
    "top_pairs": [
      { "pair": "EUR/USD", "win_rate": 90 },
      { "pair": "GBP/USD", "win_rate": 85 }
    ]
  }
}
```

---

## 2. FRONTEND: digimunx-telegram.html

### Global Variables:
```javascript
const API_BASE = 'https://expert-backend--digimun49.replit.app';
const SIGNALS_PER_PAGE = 50;  // Signals per page
let currentPage = 0;           // Current page number (0-indexed)
let totalSignalsCount = 0;     // Total signals count
let allSignalsCache = [];      // Cache for all signals (for pagination)
```

### Main Functions:

#### A) fetchStats() - Statistics Load Karta Hai
```javascript
async function fetchStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();
        const stats = data.stats || { overall: {}, today: {}, top_pairs: [] };

        // Update UI elements
        document.getElementById('totalSignals').textContent = stats.overall.total_signals;
        document.getElementById('totalWins').textContent = stats.overall.wins;
        document.getElementById('totalLosses').textContent = stats.overall.losses;
        document.getElementById('winRate').textContent = stats.overall.win_rate + '%';
        document.getElementById('todaySignals').textContent = stats.today.total_signals;
        document.getElementById('todayWinRate').textContent = stats.today.win_rate + '%';

        // Top pairs display
        if (stats.top_pairs?.length > 0) {
            document.getElementById('topPairs').innerHTML = stats.top_pairs.map(p => 
                `<span class="pair-tag">${p.pair} (${p.win_rate}%)</span>`
            ).join('');
        }
    } catch (e) { 
        console.error('Stats error:', e); 
    }
}
```

#### B) fetchSignals() - Signals Load Karta Hai
```javascript
async function fetchSignals() {
    try {
        const response = await fetch(`${API_BASE}/api/signals?limit=500`);
        const data = await response.json();

        if (!data.success || !data.signals?.length) {
            // Show empty state message
            return;
        }

        // Cache signals for pagination
        allSignalsCache = data.signals;
        totalSignalsCount = data.signals.length;
        currentPage = 0;
        renderSignalsPage();
    } catch (e) {
        console.error('Signals error:', e);
    }
}
```

#### C) renderSignalsPage() - Signals Table Render Karta Hai
```javascript
function renderSignalsPage() {
    const tbody = document.getElementById('signalsBody');
    const totalPages = Math.ceil(totalSignalsCount / SIGNALS_PER_PAGE);
    
    // Get current page signals
    const start = currentPage * SIGNALS_PER_PAGE;
    const end = start + SIGNALS_PER_PAGE;
    const pageSignals = allSignalsCache.slice(start, end);
    
    // Update pagination buttons
    document.getElementById('signals-prev-btn').disabled = currentPage === 0;
    document.getElementById('signals-next-btn').disabled = currentPage >= totalPages - 1;
    document.getElementById('signals-page-info').textContent = `Page ${currentPage + 1} of ${totalPages}`;

    // Render signals table
    tbody.innerHTML = pageSignals.map(s => {
        const isCall = s.direction === 'CALL' || s.direction === 'UP';
        const dirClass = isCall ? 'call' : 'put';
        
        let resultClass = 'pending';
        if (s.result === 'WIN') resultClass = 'win';
        else if (s.result === 'LOSS') resultClass = 'loss';

        return `<tr>
            <td>${s.signal_id || s.id}</td>
            <td>${s.pair}</td>
            <td><span class="direction-badge ${dirClass}">${s.direction}</span></td>
            <td>${s.confidence}%</td>
            <td>${s.signal_time || '-'}</td>
            <td>${s.result_time || '-'}</td>
            <td><span class="result-badge ${resultClass}">${s.result || 'PENDING'}</span></td>
            <td>${s.reason || '-'}</td>
        </tr>`;
    }).join('');
}
```

#### D) loadSignalsPage() - Pagination Navigation
```javascript
function loadSignalsPage(direction) {
    const totalPages = Math.ceil(totalSignalsCount / SIGNALS_PER_PAGE);
    currentPage += direction;
    if (currentPage < 0) currentPage = 0;
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    renderSignalsPage();
}
```

#### E) Auto-Refresh (30 seconds)
```javascript
fetchStats();
fetchSignals();
setInterval(() => { fetchStats(); fetchSignals(); }, 30000);
```

---

## 3. ADMIN PANEL: admincontroldp49.html

### Signal Management Variables:
```javascript
const SIGNALS_API = 'https://expert-backend--digimun49.replit.app';
const SIGNALS_PER_PAGE = 25;  // Admin panel shows 25 per page
let currentPage = 0;
let totalSignalsCount = 0;
let allSignalsCache = [];
let currentEditSignalId = null;   // IMPORTANT: Used for PUT/DELETE (e.g., "SIG_123...")
let currentEditNumericId = null;  // Numeric ID (NOT used for API calls)
```

### Key Functions:

#### A) loadSignals() - Admin Panel Signals Load
```javascript
async function loadSignals() {
    try {
        const response = await fetch(`${SIGNALS_API}/api/signals?limit=500`);
        const data = await response.json();
        
        if (data.success && data.signals) {
            allSignalsCache = data.signals;
            totalSignalsCount = data.signals.length;
            currentPage = 0;
            renderSignalsPage();
        }
    } catch (e) {
        console.error('Error loading signals:', e);
    }
}
```

#### B) openSignalModal() - Edit Modal Open
```javascript
function openSignalModal(signal) {
    currentEditSignalId = signal.signal_id || signal.id;  // Use signal_id for API
    currentEditNumericId = signal.id;
    
    // Populate form fields
    document.getElementById('edit-signal-id').value = currentEditSignalId;
    document.getElementById('edit-signal-pair').value = signal.pair || '';
    document.getElementById('edit-signal-direction').value = signal.direction || 'CALL';
    document.getElementById('edit-signal-confidence').value = signal.confidence || 0;
    document.getElementById('edit-signal-time').value = signal.signal_time || '';
    document.getElementById('edit-result-time').value = signal.result_time || '';
    document.getElementById('edit-signal-reason').value = signal.reason || '';
    document.getElementById('edit-signal-result').value = signal.result || 'PENDING';
    
    document.getElementById('signal-modal').classList.add('active');
}
```

#### C) saveSignalChanges() - Update Signal (PUT)
```javascript
async function saveSignalChanges() {
    if (!currentEditSignalId) return;  // MUST use signal_id
    
    const updatedData = {
        pair: document.getElementById('edit-signal-pair').value,
        direction: document.getElementById('edit-signal-direction').value,
        confidence: parseInt(document.getElementById('edit-signal-confidence').value) || 0,
        signal_time: document.getElementById('edit-signal-time').value,
        result_time: document.getElementById('edit-result-time').value,
        reason: document.getElementById('edit-signal-reason').value,
        result: document.getElementById('edit-signal-result').value
    };
    
    try {
        // CORRECT: Uses signal_id in URL path
        const response = await fetch(`${SIGNALS_API}/api/signals/${currentEditSignalId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        
        const data = await response.json();
        if (data.success) {
            showToast('Signal updated successfully!', 'success');
            loadSignals();
            closeSignalModal();
        } else {
            showToast(data.error || 'Failed to update signal', 'error');
        }
    } catch (e) {
        showToast('Error updating signal', 'error');
    }
}
```

#### D) deleteSignalById() - Delete Signal (DELETE)
```javascript
async function deleteSignalById(signalId, showConfirm = true) {
    if (showConfirm && !confirm('Are you sure you want to delete this signal?')) return;
    
    try {
        // CORRECT: Uses signal_id in URL path
        const response = await fetch(`${SIGNALS_API}/api/signals/${signalId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
            showToast('Signal deleted successfully!', 'success');
            loadSignals();
        } else {
            showToast(data.error || 'Failed to delete signal', 'error');
        }
    } catch (e) {
        showToast('Error deleting signal', 'error');
    }
}
```

#### E) Inline Delete Button (Table Row)
```javascript
// CORRECT: Passes signal_id as string
<button onclick="deleteSignalById('${s.signal_id || s.id}')">Delete</button>

// WRONG (OLD):
<button onclick="deleteSignalById(${s.id})">Delete</button>  // Numeric ID - WRONG!
```

---

## 4. DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TELEGRAM BOT                                  │
│                    (Generates Signals)                               │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND SERVER                                    │
│         https://expert-backend--digimun49.replit.app                 │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ POST Signal │  │ Store in DB │  │ Calculate   │                  │
│  │ (from Bot)  │─▶│ (SQLite/    │─▶│ Stats       │                  │
│  └─────────────┘  │ PostgreSQL) │  └─────────────┘                  │
│                   └─────────────┘                                    │
│                                                                      │
│  API Endpoints:                                                      │
│  GET  /api/signals     → Returns all signals                        │
│  GET  /api/stats       → Returns statistics                         │
│  PUT  /api/signals/:id → Update signal (uses signal_id)             │
│  DELETE /api/signals/:id → Delete signal (uses signal_id)           │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   digimunx-telegram.html │     │  admincontroldp49.html  │
│   (Public View)          │     │  (Admin Panel)          │
│                          │     │                         │
│   - fetchStats()         │     │  - loadSignals()        │
│   - fetchSignals()       │     │  - saveSignalChanges()  │
│   - renderSignalsPage()  │     │  - deleteSignalById()   │
│   - Auto-refresh 30s     │     │  - Pagination 25/page   │
│   - Pagination 50/page   │     │  - Edit Modal           │
└─────────────────────────┘     └─────────────────────────┘
```

---

## 5. COMMON ISSUES & FIXES

### Issue 1: "Invalid endpoint. Use DELETE /api/signals/:id"
**Cause:** Using numeric `id` instead of `signal_id`
**Fix:** Always use `signal_id` (e.g., `SIG_1234567890_EURUSD`) in URL path

```javascript
// WRONG
fetch(`/api/signals/${numericId}`, { method: 'DELETE' })

// CORRECT  
fetch(`/api/signals/${signalId}`, { method: 'DELETE' })
// Where signalId = "SIG_1234567890_EURUSD"
```

### Issue 2: Signals not updating in real-time
**Cause:** Cache not refreshing
**Fix:** Auto-refresh is set to 30 seconds. To force refresh, call `loadSignals()` or `fetchSignals()`

### Issue 3: Pagination not working
**Cause:** totalSignalsCount or allSignalsCache not properly set
**Fix:** Ensure fetchSignals() sets both values before calling renderSignalsPage()

### Issue 4: Empty stats showing
**Cause:** API returning null/undefined values
**Fix:** Use fallback values:
```javascript
const format = (v) => v !== undefined && v !== null ? v : '-';
```

---

## 6. HTML ELEMENT IDs (Required)

### digimunx-telegram.html:
- `totalSignals` - Total signals count
- `totalWins` - Total wins count
- `totalLosses` - Total losses count
- `winRate` - Overall win rate
- `todaySignals` - Today's signals count
- `todayWinRate` - Today's win rate
- `topPairsContainer` - Top pairs container
- `topPairs` - Top pairs list
- `signalsBody` - Table body for signals
- `signals-pagination` - Pagination container
- `signals-prev-btn` - Previous page button
- `signals-next-btn` - Next page button
- `signals-page-info` - Page info text
- `lastUpdate` - Last update timestamp

### admincontroldp49.html (Signals Section):
- `signals-table-body` - Table body for signals
- `signals-mobile-cards` - Mobile cards container
- `signals-prev-btn` - Previous page button
- `signals-next-btn` - Next page button
- `signals-page-info` - Page info text
- `signals-pagination` - Pagination container
- `signal-modal` - Edit signal modal
- `edit-signal-id` - Signal ID input
- `edit-signal-pair` - Pair input
- `edit-signal-direction` - Direction select
- `edit-signal-confidence` - Confidence input
- `edit-signal-time` - Signal time input
- `edit-result-time` - Result time input
- `edit-signal-reason` - Reason textarea
- `edit-signal-result` - Result select

---

## 7. TESTING CHECKLIST

- [ ] Signals load on page open
- [ ] Statistics display correctly
- [ ] Pagination works (Previous/Next)
- [ ] Edit signal opens modal with correct data
- [ ] Save signal updates correctly (check console for errors)
- [ ] Delete signal works (uses signal_id, not numeric id)
- [ ] Auto-refresh works (every 30 seconds)
- [ ] Empty state shows when no signals
- [ ] Error state shows on connection failure

---

## 8. FILES INVOLVED

| File | Purpose |
|------|---------|
| `digimunx-telegram.html` | Public signals display page |
| `admincontroldp49.html` | Admin panel with signal management |
| Backend (external) | Signal storage and API |

---

**Created:** February 2026
**Last Updated:** February 2026
