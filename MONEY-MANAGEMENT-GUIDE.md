# DIGIMUN PRO - Money Management System Complete Guide

## Overview
The Advanced Money Management System is a professional binary options trading tool that helps traders manage risk, control capital, plan trades, and grow their accounts. It is a standalone tool available at `/money-management` with no login required.

---

## PAGE STRUCTURE

The page is organized into these main sections:
1. **Smart Calculator** (top of page, always visible)
2. **Session Tracker** (inside Smart Calculator)
3. **5 Tabs**: Configuration, Dashboard, Compound, Discipline, Settings
4. **Action Buttons**: Copy Summary, Download PDF, Print Report

---

## 1. SMART CALCULATOR (Top Section)

The Smart Calculator sits above all tabs and provides **instant results** when you enter your account details. It is the quickest way to know your trade size and risk limits.

### Inputs:
| Input | Description | Default |
|-------|-------------|---------|
| **Balance ($)** | Your total trading account balance. Minimum $10. | $100 |
| **Risk Profile** | Pre-configured risk level that sets trade size % and daily limits. | Conservative (1%) |
| **Broker Payout (%)** | The payout percentage your broker offers on winning trades. Slider from 50% to 95%. | 80% |

### Risk Profile Options:
| Profile | Risk Per Trade | Daily Stop Loss | Max Trades/Day |
|---------|---------------|-----------------|----------------|
| **Ultra Safe** | 0.5% of balance | 3% of balance | 6 trades |
| **Conservative** | 1% of balance | 5% of balance | 10 trades |
| **Balanced** | 2% of balance | 8% of balance | 15 trades |
| **Aggressive** | 3% of balance | 12% of balance | 20 trades |

### Output Cards (7 Results):
| Card | What It Shows | Example ($100 balance, Conservative) |
|------|---------------|--------------------------------------|
| **Trade Size** | How much money to risk on each single trade. Calculated as Balance x Risk%. | $1.00 |
| **Daily Stop Loss** | Maximum amount you should lose in one day. STOP trading if you hit this. | $5.00 |
| **Daily Target** | Your realistic daily profit goal. Take profit and stop when you reach this. | $3.20 |
| **Max Trades/Day** | Maximum number of trades to place today, win or lose. | 10 |
| **Break-even Win %** | The minimum win rate you need to not lose money over time. Formula: 100 / (100 + Payout). | 55.6% |
| **Account Survival** | How many consecutive losses in a row it takes to lose your entire balance. Higher = safer. | ~100 |
| **Risk Level Badge** | Visual indicator showing your overall risk assessment. | Low Risk (green shield) |

### Risk Level Badges:
The Smart Calculator shows simplified badges based on risk profile selection:
| Badge | Risk Profile | Color |
|-------|-------------|-------|
| Low Risk | Ultra Safe (0.5%) or Conservative (1%) | Green |
| Medium Risk | Balanced (2%) | Yellow/Orange |
| High Risk | Aggressive (3%) | Orange |
| Extreme Risk | Above 3% | Red (pulsing) |

*Note: The Dashboard tab uses more advanced risk assessment based on Total Cycle Risk % and Daily Risk % (see Section 10 for exact thresholds).*

### Stop Trading Warning:
- A red banner appears below results showing: "If you lose X trades in a row, STOP trading for today!"
- The number X is calculated as: Daily Stop Loss % ÷ Risk Per Trade %
- Example: 5% daily limit ÷ 1% risk = 5 trades → "If you lose 5 trades in a row, STOP!"

### How Smart Calculator Syncs:
- When you change the balance in Smart Calculator, it automatically updates the main Configuration tab's deposit amount
- When you change the payout slider, it updates the Trade Parameters payout slider too
- Changing the Risk Profile updates the Risk Configuration settings in the Configuration tab

---

## 2. SESSION TRACKER

Located inside the Smart Calculator section. Tracks your actual trading performance **today** in real-time.

### Inputs:
| Input | Description |
|-------|-------------|
| **Wins Today** | Enter the number of trades you won today. Start at 0. |
| **Losses Today** | Enter the number of trades you lost today. Start at 0. |

### Outputs:
| Output | What It Shows | How It's Calculated |
|--------|---------------|---------------------|
| **Current P&L** | Your profit or loss for today in dollars. Green = profit, Red = loss. | (Wins × Trade Size × Payout%) - (Losses × Trade Size) |
| **Trades Remaining** | How many more trades you can place today. | Max Trades/Day - (Wins + Losses) |
| **Win Rate** | Your actual win percentage today. | (Wins ÷ Total Trades) × 100 |

### STOP Banner:
- A pulsing red banner appears: "STOP - Daily Limit Reached! Do NOT place any more trades today."
- Triggers when: Total losses in dollars ≥ Daily Stop Loss amount, OR remaining trades = 0

---

## 3. CONFIGURATION TAB

The main settings tab with 5 expandable sections. Each section can be opened/closed by clicking its header.

### 3.1 Preset Buttons (Top)
Quick-apply pre-configured settings:

| Preset | Risk/Trade | Strategy | Multiplier | Steps | Daily Loss Limit | Cycles/Day |
|--------|-----------|----------|-----------|-------|-----------------|------------|
| **Ultra Safe** | 0.5% | No Martingale | 2.0x | 1 | 3% | 2 |
| **Conservative** | 1.0% | 1-Step MTG | 2.0x | 1 | 5% | 3 |
| **Balanced** | 2.0% | 1-Step MTG | 2.2x | 1 | 8% | 4 |
| **Aggressive** | 3.0% | 2-Step MTG | 2.5x | 2 | 12% | 5 |
| **High Risk** | 5.0% | Custom MTG | 2.8x | 3 | 20% | 6 |

### 3.2 Capital & Account Section

| Setting | Description | Options/Range | Default |
|---------|-------------|---------------|---------|
| **Deposit Amount** | Your total trading capital/balance | Minimum $10 | $100 |
| **Currency** | Currency for display | USD ($), EUR (€), GBP (£) | USD |
| **Account Type** | Demo or Live trading account | Demo / Live | Demo |
| **Broker** | Your binary options broker | Quotex, IQ Option, Pocket Option, Binomo, Olymp Trade, Exnova, Other | Quotex |
| **Account Goal** | Target amount you want to reach | Any number | $2,000 |
| **Risk Tolerance** | General risk comfort level slider | Conservative / Moderate / Aggressive | Moderate |

### 3.3 Trading Days Management Section

| Setting | Description | Default |
|---------|-------------|---------|
| **Trading Days** | Checkboxes for each day of the week. Check/uncheck to set your trading schedule. | Mon-Fri checked, Sat-Sun unchecked |
| **Trading Hours/Day** | How many hours per day you trade | 4 hours |
| **Sessions Per Day** | How many separate trading sessions per day | 2 sessions |
| **Monthly Trading Days** | Auto-calculated: (Days per week × 4) - Break days. Read-only. | 20 days |
| **Break Days Schedule** | Scheduled rest days for mental recovery | No scheduled breaks / 1 per week / 1 per 2 weeks / 2 per month |

### 3.4 Advanced Risk Configuration Section

| Setting | Description | Range | Default |
|---------|-------------|-------|---------|
| **Risk Per Trade Mode** | Choose between percentage-based or fixed-dollar stake | % of Capital / Fixed Amount | % of Capital |
| **Risk Per Trade (%)** | What percentage of your balance to risk on each trade | 0.5% to 10% (slider) | 1.0% |
| **Fixed Stake Amount** | If using fixed mode, the dollar amount per trade. Automatically capped at 10% of your balance for safety. | Any amount (max 10% of balance) | $10 |
| **Daily Loss Limit (%)** | Stop trading if you lose this % of capital in one day | 1% to 50% | 5% |
| **Weekly Loss Limit (%)** | Maximum weekly loss as % of capital | 1% to 100% | 15% |
| **Monthly Loss Limit (%)** | Maximum monthly loss as % of capital | 1% to 100% | 30% |
| **Max Consecutive Losses** | Stop after this many losses in a row | 1 to 20 | 5 |
| **Max Drawdown (%)** | Pause trading if account drops this % from its highest point | 5% to 50% | 20% |
| **Risk-Reward Ratio** | Expected ratio of risk to reward | 1:1, 1:2, 1:3, Custom | 1:2 |

### 3.5 Strategy & Martingale System Section

| Setting | Description | Options | Default |
|---------|-------------|---------|---------|
| **Strategy Type** | Your trading strategy for handling losses | No Martingale, 1-Step MTG, 2-Step MTG, Custom MTG, Compound (No MTG) | 1-Step MTG |
| **Anti-Martingale** | Reverse martingale: increase stake on WINS instead of losses | Off / On | Off |
| **Martingale Multiplier** | How much to multiply the stake after a loss | 1.5x to 3.0x (slider) | 2.2x |
| **Max MTG Steps** | How many martingale recovery steps allowed | 1 to 5 steps | 1 Step |

#### Martingale Strategies Explained:
- **No Martingale**: Keep the same trade size after every trade, win or lose. Safest approach.
- **1-Step MTG**: After a loss, place ONE recovery trade with increased stake (base × multiplier). If it wins, you recover the loss plus profit. If it loses, stop the cycle and go back to base stake.
- **2-Step MTG**: After a loss, you get TWO recovery attempts with increasing stakes. More aggressive but can recover from 2 consecutive losses.
- **Custom MTG**: Configure up to 5 recovery steps. Very aggressive - each step risks more capital.
- **Compound (No MTG)**: No recovery trades. Instead, profits are reinvested to grow the account over time.

#### Martingale Table:
Displays a table showing for each step:
- **Step**: Base, MTG 1, MTG 2, etc.
- **Stake**: Amount to trade at this step
- **Potential Win**: How much you win if this trade succeeds (Stake × Payout%)
- **Total at Risk**: Cumulative amount at risk across all steps so far
- **Recovery Profit**: Net profit/loss if you win at this step (Win - Total Previous Losses)

Example with $1 base, 2.2x multiplier, 80% payout:
| Step | Stake | Win | Total Risk | Recovery |
|------|-------|-----|-----------|----------|
| Base | $1.00 | $0.80 | $1.00 | $0.80 |
| MTG 1 | $2.20 | $1.76 | $3.20 | -$0.44 |
| MTG 2 | $4.84 | $3.87 | $8.04 | -$0.97 |

### 3.6 Trade Parameters Section

| Setting | Description | Range | Default |
|---------|-------------|-------|---------|
| **Expected Payout (%)** | What % your broker pays on winning trades | 50% to 95% (slider) | 80% |
| **Win Rate Expectation (%)** | Your expected percentage of winning trades | 50% to 90% (slider) | 60% |
| **Max Trades/Session** | Maximum trades per trading session | 1 to 100 | 10 |
| **Max Trades/Day** | Maximum total trades per day | 1 to 200 | 20 |
| **Max Cycles/Day** | Maximum martingale cycles per day | 1 to 20 | 3 |
| **Trade Duration** | Time frame for each trade | 30 Seconds, 1 Minute, 5 Minutes, 15 Minutes, 30 Minutes, 1 Hour | 1 Minute |

### 3.7 Quick Stake Calculator Section

A simple calculator within the Configuration tab for quick stake calculations:

| Input | Description | Default |
|-------|-------------|---------|
| **Account Balance** | Enter your current balance | Synced with main deposit |
| **Risk Percentage** | Slider from 1% to 5% | 2% |

**Outputs:**
- **Recommended Stake**: Balance × Risk%
- **Step 1 (Base)**: Same as recommended stake
- **Step 2 (MTG 1)**: Step 1 × Martingale Multiplier
- **Step 3 (MTG 2)**: Step 2 × Martingale Multiplier

---

## 4. DASHBOARD TAB

Shows all calculated results in a visual card grid. All values update automatically when you change any setting.

### Safety Alerts (Top):
| Alert | Appears When | Color |
|-------|-------------|-------|
| **BLOCKED** | Total cycle risk exceeds 10% of capital | Red |
| **Daily Loss Warning** | Potential daily risk exceeds your daily loss limit | Yellow |
| **MTG Steps Warning** | Using more than 1 martingale step | Yellow |

### Dashboard Cards:

| Card | What It Shows | How It's Calculated |
|------|---------------|---------------------|
| **Base Stake** | Your initial trade amount | Balance × Risk% (or Fixed Amount) |
| **MTG Stake** | Recovery trade amount (last MTG step) | Base Stake × Multiplier^Steps |
| **Total Cycle Risk** | Full exposure if all MTG steps lose | Sum of all stakes in one cycle |
| **Profit per Win** | Profit from a winning base trade | Base Stake × Payout% |
| **Recovery Profit** | Net profit after winning MTG recovery | MTG Win - Previous Losses in Cycle |
| **Expected Daily** | Expected daily profit based on win rate | Avg Profit Per Trade × Daily Trades |
| **Expected Weekly** | Expected weekly profit | Daily Profit × Trading Days Per Week |
| **Expected Monthly** | Expected monthly profit | Daily Profit × Monthly Trading Days |
| **Max Daily Loss** | Maximum loss allowed per day | Balance × Daily Loss Limit% |
| **Max Weekly Loss** | Maximum loss allowed per week | Balance × Weekly Loss Limit% |
| **Max Monthly Loss** | Maximum loss allowed per month | Balance × Monthly Loss Limit% |
| **Break-even Win %** | Minimum win rate to not lose money | 100 ÷ (100 + Payout) × 100 |
| **Days to Goal** | Trading days needed to reach your goal | (Goal - Balance) ÷ Expected Daily Profit |

### Risk Badge Card:
Shows a large risk assessment with:
- **Risk Indicator**: Circle icon (green/yellow/orange/red) with emoji
- **Risk Level Text**: Low/Medium/High/Extreme Risk with description
- **Account Survival**: Number of consecutive losses before account is empty

### Recovery Calculator (Inside Dashboard):
Calculate how many wins are needed to recover from a loss:
| Input | Description |
|-------|-------------|
| **Current Loss Amount** | Total amount you need to recover |
| **Current Stake** | Your current trade size |

| Output | Description |
|--------|-------------|
| **Wins Needed** | Number of winning trades to fully recover |
| **After 1 Win** | Remaining loss/profit after 1 win |
| **After 2 Wins** | Remaining loss/profit after 2 wins |
| **After 3 Wins** | Remaining loss/profit after 3 wins |

### Action Buttons (Sticky at Bottom):
- **Copy Summary**: Copies a formatted text summary to clipboard (for Telegram/WhatsApp)
- **Download Trading Plan (PDF)**: Generates a professional 5-page PDF
- **Print Report**: Opens browser print dialog

---

## 5. COMPOUND TAB

Projects how your account will grow over time if you reinvest profits.

### Settings:
| Setting | Description | Options | Default |
|---------|-------------|---------|---------|
| **Enable Compound Growth** | Turn compound calculations on/off | Enabled / Disabled | Enabled |
| **Compound Frequency** | How often profits are reinvested | Daily / Weekly / Monthly | Daily |
| **Reinvest Percentage (%)** | What % of profits to add back to capital | 0% to 100% (slider) | 50% |

### Visual Chart:
- Bar chart showing projected balance at 7, 14, 30, 60, and 90 days
- Bars grow taller showing compound growth effect

### Projection Table:
| Column | Description |
|--------|-------------|
| **Period** | Time period (7, 14, 30, 60, 90 days) |
| **Starting Balance** | Balance at start of period |
| **Profit** | Total profit earned in this period |
| **Reinvested** | Amount added back to trading capital |
| **Ending Balance** | Balance at end of period (highlighted) |
| **Growth %** | Total growth from initial deposit |

---

## 6. DISCIPLINE TAB

Mental preparation and review tools for emotional trading control.

### Pre-Session Checklist (7 Items):
Complete these BEFORE you start trading each day:
1. I am in a calm and focused mental state
2. I have reviewed my trading plan and rules
3. I know my maximum loss limit for today
4. I am not trading to recover previous losses
5. I have no urgent distractions
6. I accept that some trades will be losses
7. I will stick to my stake size regardless of emotions

### Session Review Prompts (5 Items):
Complete these AFTER each trading session:
1. Did I follow my trading plan?
2. Did I respect my loss limits?
3. Did I avoid revenge trading?
4. Did I manage my emotions well?
5. What can I improve for next session?

**How to use:** Click on each item to check it off (turns green with checkmark). Click "Reset Checklists" to clear all checks.

---

## 7. SETTINGS TAB

### 7.1 Profile Management
Save and load multiple configuration profiles:
- **Save Profile**: Enter a name and save current settings
- **Load Profile**: Select a saved profile from dropdown and load it
- **Delete Profile**: Remove a saved profile
- Profiles are stored in your browser's localStorage

### 7.2 Auto-Save
- **Enabled**: Settings are automatically saved after every change
- **Disabled**: Settings are only saved when you manually save a profile
- Auto-save indicator shows "Saving..." then "Settings saved"

### 7.3 Export & Import
- **Export Settings (JSON)**: Downloads your current settings as a JSON file
- **Import Settings (JSON)**: Upload a previously exported JSON file to restore settings
- Useful for backing up or transferring settings between devices

### 7.4 Reset Options
- **Reset to Defaults**: Resets ALL settings to factory defaults ($100 balance, Conservative preset)
- **Clear All Saved Data**: Permanently deletes all saved settings AND all saved profiles from browser storage

### 7.5 Need Help?
- Link to Telegram support: [@Digimun49](https://t.me/Digimun49)

---

## 8. PDF TRADING PLAN (5 Pages)

Generated using the "Download Trading Plan (PDF)" button. Professional dark-themed PDF with DIGIMUN PRO branding.

### Page 1: Cover Page
- DIGIMUN PRO title in accent color
- "Money Management Plan" subtitle
- Generation date
- Current balance and risk profile
- Semi-transparent diagonal watermark

### Page 2: Account & Risk Summary
- **Account Settings Table**: Broker, Account Type, Balance, Currency, Goal
- **Risk Parameters Table**: Risk Per Trade, Daily/Weekly/Monthly Stop Loss, Max Drawdown, Max Consecutive Losses
- **Trade Parameters Table**: Payout, Win Rate, Strategy, Max Trades/Day, Trade Duration

### Page 3: Trading Plan
- **Calculated Trading Values Table**: Base Stake, MTG Stake, Cycle Risk, Profit per Win, Expected Daily/Weekly/Monthly Profit, Break-even Win Rate, Days to Goal
- **Martingale Ladder Table**: All steps with Stake, Potential Win, Total Risk, Recovery Profit

### Page 4: 30-Day Trading Plan Calendar
- Day-by-day plan for 30 days
- Shows: Day number, Date, Status (Trade/Rest), Start Balance, Target Profit, Target Balance
- Rest days shown in gray, Trade days in green
- Balance grows each trading day by expected daily profit

### Page 5: Rules & Emergency Stops
- **Emergency Stop Rules**: 7 critical rules with personalized values (e.g., "Stop if daily loss reaches $5.00")
- **Pre-Session Checklist**: 7 items with checkboxes
- **Post-Session Review**: 5 items with checkboxes

**PDF Features:**
- Dark background (matching the app theme)
- Color-coded table headers (green for account, red for risk, purple for trade params, orange for MTG)
- DIGIMUN PRO watermark on every page (semi-transparent, diagonal)
- Footer with "Generated by Digimun Pro" and page numbers
- Filename: `digimun-trading-plan-YYYY-MM-DD.pdf`

---

## 9. COPY SUMMARY

Copies a formatted text summary to clipboard for sharing on Telegram or WhatsApp. Includes:
- Account settings (Deposit, Broker, Account Type, Goal)
- Strategy details (Type, Risk/Trade, Payout, Win Rate)
- Trade amounts (Base Stake, MTG Stake, Cycle Risk)
- Expected results (Profit per Win, Daily/Weekly/Monthly profit)
- Risk limits (Daily Loss, Risk Level, Days to Goal)
- Digimun Pro branding and link

---

## 10. CORE CALCULATIONS EXPLAINED

### Base Stake Calculation:
```
If Percentage Mode: Base Stake = Balance × (Risk% ÷ 100)
If Fixed Mode: Base Stake = min(Fixed Amount, Balance × 10%)
  (Fixed stake is automatically capped at 10% of balance for safety)
```

### Martingale Stake:
```
Step 0 (Base): Base Stake
Step 1: Base Stake × Multiplier
Step 2: Step 1 × Multiplier
Step N: Step(N-1) × Multiplier
```

### Total Cycle Risk:
```
Sum of all stakes from Base through last MTG step
```

### Profit per Win:
```
Base Stake × (Payout% ÷ 100)
```

### Recovery Profit:
```
Last MTG Stake × (Payout% ÷ 100) - (Total Cycle Risk - Last MTG Stake)
```

### Average Profit Per Trade:
```
(Profit per Win × Win Probability) - (Base Stake × Loss Probability)
Where Win Probability = Win Rate ÷ 100
Where Loss Probability = 1 - Win Probability
```

### Expected Daily Profit:
```
max(0, Average Profit Per Trade × Trades Per Session × Sessions Per Day)
```

### Break-even Win Rate:
```
100 ÷ (100 + Payout) × 100
Example: 100 ÷ (100 + 80) × 100 = 55.6%
```

### Account Survival:
```
floor(Balance ÷ Base Stake)
Example: $100 ÷ $1 = 100 consecutive losses before account empty
```

### Days to Goal:
```
ceil((Goal - Balance) ÷ Expected Daily Profit)
Example: ($2000 - $100) ÷ $3.20 = 594 days
```

### Risk Assessment:
```
Cycle Risk % = (Total Cycle Risk ÷ Balance) × 100
Daily Risk % = (Total Cycle Risk × Max Cycles/Day ÷ Balance) × 100

If Daily Risk > 20% or Cycle Risk > 10% → Extreme Risk
If Daily Risk > 15% or Cycle Risk > 7% → High Risk
If Daily Risk > 10% or Cycle Risk > 4% → Medium Risk
Otherwise → Low Risk
```

---

## 11. DATA STORAGE

All settings are stored in the browser's **localStorage**:
- `mm_state`: Current settings (auto-saved if enabled)
- `mm_profiles`: Saved named profiles

**Important:** Clearing browser data or using a different browser/device will lose saved settings. Use Export/Import to backup.

---

## 12. SAFETY FEATURES

1. **Risky Configuration Blocker**: Dashboard shows red alert if total risk exceeds safe limits
2. **Daily Loss Warning**: Alert when potential daily risk exceeds your set limit
3. **MTG Steps Warning**: Alert when using multiple martingale steps
4. **Stop Trading Banners**: Red pulsing banners in Smart Calculator and Session Tracker
5. **Discipline Checklists**: Mental preparation tools to prevent emotional trading
6. **Beginner-Safe Defaults**: $100 starting balance, 1% risk, conservative preset
7. **Confirmation Modals**: Dangerous actions (delete profile, clear data) require confirmation

---

## 13. SUPPORT

For questions about money management strategies or help with your trading plan:
- **Telegram**: [@Digimun49](https://t.me/Digimun49)

---

*This guide covers every feature, function, and option in the Digimun Pro Advanced Money Management System v2.0*
