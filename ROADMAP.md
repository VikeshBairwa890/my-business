# ThekaBook — Mid-Level Contractor Master Product Roadmap

Yeh master roadmap **ThekaBook** ko ek single-thekedaar app se badha kar ek **Mid-Level Construction Contractor (2 se 15 active sites, 20-150 workers, 2-5 site supervisors/munshi)** ke level tak poora automate karne ke liye banaya gaya hai.

---

## 🎯 Mid-Level Contractor Ki Ground Reality & Profile
Mid-level thekedaar sirf diary me hisab nahi rakhta, uske paas multiple teams aur challenges hote hain:
1. **Multiple Running Sites:** Ek site par lenter pad raha hai, doosri par plaster chal raha hai, teesri par finishing.
2. **Team Structure:** Ek main Contractor (Maalik), 2-3 Site Supervisors (Munshi), alag-alag Karigar/Labour gangs, aur Peti Thekedaar (Shuttering, Tile, Plumbing).
3. **Material Logistics:** Ek site ka sariya doosri site bhejna (site transfer), cement ka bacha hua stock, aur supplier udhari.
4. **Running Bills (RA Bills) & Measurement:** Kamro aur deewaro ki naap-jokh (L × B × H) ke hisab se malik se paisa lena.
5. **Tools & Machinery Rent:** Mixer machine, vibrator, scaffolding (farme/balli) ka kharcha aur site allocation.

---

## 🗺️ Master Phase Overview

```
[Phase 1: DONE] ──► [Phase 2: Field Ops] ──► [Phase 3: Multi-Site & Roles] ──► [Phase 4: Measurements & Peti] ──► [Phase 5: Enterprise & BI]
  Basic Attendance     Bulk Haziri & Gangs        Supervisor/Munshi Login         Measurement Book (MB)           Real Business Net Profit
  Simple Bills/Cash    Stock & Malik Material    Site-to-Site Transfers          Running Bills (RA Bills)        Tools/Machinery Rentals
  Single User Admin    Bill/Site Photos          WhatsApp Reminders              Peti Thekedaar Ledger           Offline-First Engine
```

---

## 📋 Phase 2: High-Speed Field Operations (Immediate Priority)
*Target: Site par rozana hone wale 80% repetitive kaamo ko 2 minute me niptana.*

### 1. Bulk Attendance & Gang Work (Haziri 2.0)
- **1-Click Bulk Mark:** Ek site ke 25 workers ko ek sath "All Present" lagana, fir jo absent ya half-day ho unhe change karna.
- **Labour Gangs / Jodiyan:** Mistri + Beldar ki jodi banana taaki haziri ek click me group me lage.
- **Daily Khuraki / Kharcha Entry:** Subah ya shaam ko chaai-paani, bidi ya khuraki ka nagad kharcha seedha worker ke daily hisab me jodna.

### 2. Material Stock & Inventory (Inward, Use, Balance)
- **Stock Register:** Kitna material aaya (Inward), kitna concrete/plaster me laga (Consumed), aur site par kitna bacha hai (Closing Stock).
- **Wastage & Pilferage Tracking:** Cement ki kitni boriyaan kharab hui ya geeli hui.
- **Malik Ka Material (Client Supplied):** Agar client ne khud sariya ya cement diya hai, uska separate entry register taaki contractor ki khud ki cost inflate na ho.

### 3. Bills & Site Photos (Digital Parchi & Proof)
- **Camera & Gallery Attachment:** Material bill ki receipt, kanta parchi, dumper receipt aur site work ki photos upload karna.
- **Receipt Archival:** Bill gumne par bhi photo se supplier ka bill number aur date verify ho sake.

### 4. Shareable Statements (WhatsApp & PDF)
- **Labour Hisab Card:** Har karigar ka WhatsApp par shareable message: *"Aapki is mahine 24 haziri hui, ₹16,800 bane, ₹4,000 advance liya, Baki ₹12,800"*.
- **Supplier Ledger:** Har hardware/cement dukaandar ka khata ki kitne ka maal liya aur kitna payment diya.

---

## 👥 Phase 3: Multi-Site Management & Team Governance
*Target: Thekedaar ghar baithe har site ki activity control kar sake bina fraud ke risk ke.*

### 5. Role-Based Access Control (Munshi vs Contractor)
- **Contractor/Owner Role:** Full access (Saari sites, profit/margin, bank balance, client contract rates).
- **Supervisor/Munshi Role:** Limited access (Sirf apni assigned site ki attendance lagana, material receipt ki photo daalna; theke ka profit aur client rate nahi dekh sakega).
- **Accountant Role:** Bills, payments, bank entry aur receipts reconcile karna.

### 6. Site-to-Site Material & Labour Transfer
- **Stock Transfer:** Site A se Site B par 50 bag cement bheji:
  - Site A ke kharche se ₹18,000 minus hoga.
  - Site B ke kharche me ₹18,000 add hoga.
  - Dono sites ka margin accurate rahega.
- **Labour Movement:** Worker ne aadha din Site 1 par kaam kiya aur aadha din Site 2 par, toh wages automatically 50-50% allocate honge.

### 7. Milestone Payments & Payment Reminders
- **Stage-wise Payment Schedule:**
  - Plinth level (20%)
  - Ground floor slab (25%)
  - Brickwork & Plaster (25%)
  - Finishing & Handover (30%)
- **Client Payment Follow-up:** Client ko professional reminder message aur auto-generated UPI payment link/QR code.

---

## 📐 Phase 4: Measurement Book (MB), Running Bills & Peti Thekedaar
*Target: Mid-level billing standard aur sub-contractor reconciliation.*

### 8. Measurement Book (MB Records)
- **Dimensions Calculator:** Length × Breadth × Height/Thickness (Feet-Inch ya Meter-Centimeter).
  - Example: Plaster 12'6" × 10'0" = 125 sq ft.
  - Example: PCC/Raft: Length × Breadth × Depth = Cubic Feet (CFT) / Cubic Meter (Cum).
- **Deductions Support:** Deewar me darwaze aur khidki ki opening deduct karne ka standard rule.

### 9. Running Account (RA) Bills for Clients
- **Item-rate Billing:** Har item ka approved rate (e.g. Brickwork ₹45/sq ft, Tile fitting ₹28/sq ft).
- **Previous vs Current Bill:** Pehle kitna naap hua tha, is bill me kitna naya kaam hua, total kitna bana.
- **Client Signature / Digital Approval:** Site par hi client ke digital sign le kar bill freeze karna.

### 10. Peti Thekedaar (Sub-Contractor) Management
- Shuttering thekedaar, Pop/False ceiling wale, Tile mistri ko theka dena (Sq ft ya Lumpsum basis par).
- Peti thekedaar ka running ledger: Unko kitna kaam diya, kitna naap pass hua, kitna advance diya, aur retention money kitni rok ke rakhi.

---

## 💼 Phase 5: Complete Business Financials, Assets & Enterprise Readiness
*Target: Pure business ka real net profit, equipment tracking aur production scalability.*

### 11. Machinery & Plant Asset Management
- **Contractor Tools:** Mixer machine, needle vibrators, shuttering plates/props, safety harness, tractor/trolley.
- **Asset Location:** Koun si machine kis site par lagi hui hai aur kab wapas aani hai.
- **Rental Expenses:** Bahar se rent par li gayi machine ka daily/monthly rental cost site me add hona.

### 12. Actual Business Net Profit (Beyond Site Margins)
- **Overhead Expenses:** Office rent, thekedaar ki bike/car ka diesel, munshi ki monthly salary, repair & maintenance.
- **Net Company Profit:** Sabhi sites ka gross margin minus overhead expenses = Contractor ka asli shuddh munafa.
- **GST & TDS Tracking:** Client dwara kata gaya 1% ya 2% TDS aur GST bills ka hisab.

### 13. Offline-First Architecture & Sync Engine
- Site ke basement me ya gaon ki location me network na hone par bhi bina rukawat haziri aur photo lena.
- Network aane par SQLite / Local Storage se background me PostgreSQL ke sath secure sync.

### 14. Localization & Voice Features
- **Complete Hindi / Hinglish Voice Input:** Munshi bol kar entry kar sake: *"Ramesh mistri 1 din, Sonu beldar half day"*.
- Easy visual icons (karigar photo, site photo, green/red status indicators).

### 15. Production Infrastructure & Mobile Release
- **Backend:** PostgreSQL (Neon / AWS RDS) with automated daily off-site encrypted backups.
- **Mobile Apps:** Production signed Android APK & Google Play Store release, iOS App Store build via Expo EAS.

---

## 📊 Priority Matrix for Development

| Priority | Feature Area | Impact on Contractor | Effort |
| :--- | :--- | :--- | :--- |
| **P0 (Urgent)** | Bulk Haziri + Daily Khuraki/Advance | Har roz 30-45 minute ka time save hota hai | Medium |
| **P0 (Urgent)** | Bill & Receipt Photo Upload | Gum hui parchi ka hazaron ka nuksan rukta hai | Medium |
| **P1 (High)** | Individual Labour WhatsApp Statement | Hafte ke settlement me jhagde 100% khatam | Low |
| **P1 (High)** | Material Stock & Malik Material | Cement/Reta chori aur wastage pakad me aati hai | Medium |
| **P1 (High)** | Munshi/Supervisor Login (Role Permissions) | Chori/data tampering rukti hai, thekedaar free hota hai | High |
| **P2 (Medium)** | Site-to-Site Material Transfer | Multi-site margins 100% accurate hote hain | Medium |
| **P2 (Medium)** | Measurement Book (MB) & RA Bills | Client se payment time par pass hoti hai | High |
| **P2 (Medium)** | Peti Thekedaar (Sub-contractor) Ledger | Shuttering aur tile thekedaar ka hisab saaf | Medium |
| **P3 (Planned)** | Offline-first sync & Asset tracking | Remote sites aur equipment rent control | High |
| **P3 (Planned)** | Company Net Profit & Overhead | Salana CA audit aur real income pata chalti hai | Medium |

---

## 🛠️ Next Execution Step
Next step me hum **P0 features (Phase 2)** se implementation start karenge:
1. **Bulk Attendance UI + API** (Ek sath sabhi workers ki haziri)
2. **Bill / Receipt Photo Camera & Storage Integration**
3. **Individual Labour WhatsApp Hisab Formatter**
