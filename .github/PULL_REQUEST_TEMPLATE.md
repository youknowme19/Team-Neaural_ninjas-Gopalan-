## 📌 Pull Request Overview

### 📝 Summary of Changes
<!-- Provide a concise description of the changes made and the problem being solved. -->

### 🎯 Affected Components
- [ ] 🌐 Web App (`apps/web`)
- [ ] 🖥️ Desktop UI (`apps/desktop/src`)
- [ ] ⚙️ Rust Backend / Audio Engine (`apps/desktop/src-tauri`)
- [ ] 📜 Scripts & Infrastructure (`scripts/`, configs)
- [ ] 📖 Documentation

---

## 🔍 Preview & Testing Instructions

### How to test locally:
```bash
# 1. Checkout this PR
gh pr checkout <PR_NUMBER>

# 2. Run Desktop UI / Tauri dev
cd apps/desktop
pnpm dev

# 3. (Optional) Run Web dev
cd apps/web
pnpm dev
```

### 📸 Screenshots / Video Previews
<!-- Paste screenshots or GIFs demonstrating the preview of your changes, especially for UI or overlay features -->

---

## ✅ Quality Checklist
- [ ] Code compiles without warnings (`pnpm build` / `cargo check`)
- [ ] Live preview verified in browser or desktop window
- [ ] Real-time audio or WebSocket streaming verified (if modified)
- [ ] No extraneous files or sensitive credentials committed
