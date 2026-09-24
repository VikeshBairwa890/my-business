# Project Guidelines & Architecture Standards (ThekaBook)

Yeh rules aur guidelines user dwara explicitly define ki gayi hain. Har feature aur code change me inka sakhti se paalan karna anivarya hai:

---

## 🎨 1. UI & Design Standards (BHIM UPI / Modern Fintech Style)
- **Visual Aesthetic:** 
  - UI ko **BHIM UPI / modern Indian fintech app** jaisa ultra-clean, trusted aur professional look and feel dena hai.
  - High quality cards, refined shadows, clean borders, crisp typography (Inter/System), aur pleasing color contrast (Navy blue, deep slate, emerald green for earnings, warm accents).
- **Header:** 
  - Header ko bilkul minimal aur distraction-free rakhna hai (sirf simple page title, back button ya profile chip; koi clutter nahi).
- **Footer / Bottom Navigation:** 
  - Har page ka layout consistent rahega.
  - Footer (Bottom Navigation Bar) standard, modern aur responsive hona chahiye with clean active/inactive icon states.
- **Micro-interactions:** 
  - Buttons, cards aur tabs par smooth feedback aur interactive polish hona chahiye jisse app use karne me premium feel aaye.

---

## 📁 2. Frontend Architecture (`apps/mobile`)
- **Pages / Screens:**
  - Har page ko **folder-wise** create karna hai:
    `src/pages/<PageName>/index.tsx` (e.g. `src/pages/Dashboard/`, `src/pages/Sites/`, `src/pages/Attendance/`, etc.).
  - Har page ka apna local style ya specific components usi folder me ya modular components me honge.
- **Icons Management:**
  - Sabhi icons ko ek dedicated folder me rakhna hai:
    `src/components/icons/` ya `src/assets/icons/`.
  - Icon components centralized aur reusable hone chahiye.
- **Shared Components:**
  - Reusable buttons, cards, modal sheets, input fields `src/components/common/` me honge.

---

## ⚙️ 3. Backend Architecture (`apps/api`)
- **Separation of Concerns:**
  - **Controllers:** Request handling aur response generation alag controllers me honge (`src/controllers/`).
  - **Routes:** API routes alag honge (`src/routes/`).
  - **Database Services:** Database operations, Prisma models aur queries alag service layer me honge (`src/services/` ya `src/db/`).
  - Kabhi bhi route handlers ke andar raw database queries ya messy inline business logic nahi likhna hai.
- **Database Engine:**
  - **Prisma ORM** with **PostgreSQL** (accessible via pgAdmin).
  - Strongly typed schemas aur integer-paise financial precision.
