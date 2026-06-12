# 📄 AR Brochure — Next.js WebAR

Point your phone camera at the brochure → video plays on top of it.
No QR code. No app download. Just open the link and scan.

---

## 🚀 Setup in 5 Steps

### Step 1 — Install dependencies
```bash
npm install
```

---

### Step 2 — Compile your brochure image into a .mind file

1. Go to 👉 https://hiukim.github.io/mind-ar-js-doc/tools/compile
2. Upload a **clear, flat photo** of your brochure (JPG or PNG)
3. Click **Compile**
4. Download the `.mind` file
5. Place it at:
```
public/targets/target.mind
```

> 💡 Tips for best detection:
> - Use a well-lit, high-contrast brochure photo
> - Make sure it has logos, text, or patterns (not plain solid colors)
> - Flat, front-facing photo works best

---

### Step 3 — Add your video

Place your video file at:
```
public/videos/brochure-video.mp4
```

> 💡 Tips:
> - MP4 format works best across all devices
> - Keep under 20MB for fast loading on mobile
> - 16:9 ratio matches the default settings

---

### Step 4 — Adjust video ratio (if needed)

Open `components/ARViewer.tsx` and find this section at the top:

```tsx
const VIDEO_WIDTH  = 1        // AR plane width
const VIDEO_HEIGHT = 0.5625  // 16:9 ratio → change for your video
```

Common ratios:
| Video format | HEIGHT value |
|---|---|
| 16:9 (default) | 0.5625 |
| 4:3 | 0.75 |
| 1:1 square | 1.0 |
| 9:16 vertical | 1.778 |

---

### Step 5 — Run locally

```bash
npm run dev
```

Open on your phone: `https://YOUR_LOCAL_IP:3000`

> ⚠️ Camera only works on HTTPS. For local testing use ngrok:
> ```bash
> npx ngrok http 3000
> ```
> Then open the ngrok URL on your phone.

---

## 🌐 Deploy to Production (Vercel — Free)

```bash
npm install -g vercel
vercel
```

Or push to GitHub and connect at vercel.com — it auto-deploys.

---

## 📁 Project Structure

```
ar-brochure/
├── app/
│   ├── layout.tsx        ← loads MindAR script globally
│   ├── page.tsx          ← main page
│   └── globals.css       ← AR styles
├── components/
│   └── ARViewer.tsx      ← all AR logic lives here
├── public/
│   ├── targets/
│   │   └── target.mind   ← YOUR compiled brochure image ← ADD THIS
│   └── videos/
│       └── brochure-video.mp4  ← YOUR video ← ADD THIS
├── next.config.js
└── package.json
```

---

## 📱 Device Support

| Browser | Works? |
|---|---|
| Chrome Android | ✅ Yes |
| Safari iPhone | ✅ Yes |
| Firefox Mobile | ⚠️ Limited |
| Desktop Chrome | ✅ Yes (for testing) |

---

## ❓ Troubleshooting

**Camera not working?**
→ Must be on HTTPS. Use ngrok for local or deploy to Vercel.

**Brochure not detecting?**
→ Make sure your brochure photo has clear patterns/text (not plain colors).
→ Hold phone steady, good lighting.

**Video not playing with sound?**
→ Browser auto-play blocks audio until user interaction. Tap the screen once.
# brosherscan
