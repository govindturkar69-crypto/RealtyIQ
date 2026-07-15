<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:2563eb,100:6366f1&height=200&section=header&text=RealtyIQ&fontSize=70&fontColor=ffffff&animation=fadeIn&fontAlignY=35&desc=ML-Powered%20Real%20Estate%20Price%20Prediction&descSize=18&descAlignY=55" width="100%"/>

<a href="https://readme-typing-svg.demolab.com">
<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=22&pause=1000&color=2563EB&center=true&vCenter=true&width=650&lines=Predict+property+prices+with+confidence+ranges;Trained+on+real+Bengaluru+market+data;FastAPI+%2B+XGBoost+%2B+Express+%2B+Next.js+14;Trends%2C+Map+Heatmap%2C+Comparison+%26+PDF+reports" alt="Typing SVG" />
</a>

<br/>

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-realty--iq--puce.vercel.app-2563eb?style=for-the-badge)](https://realty-iq-puce.vercel.app/)

<br/>

![Next.js](https://img.shields.io/badge/Next.js_14-000000?style=flat&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_18-20232A?style=flat&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-F7931E?style=flat&logo=scikit-learn&logoColor=white)
![XGBoost](https://img.shields.io/badge/XGBoost-EB0000?style=flat&logo=xgboost&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=flat&logo=jsonwebtokens&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat)

</div>

---

## 🌐 Live Deployment

| Service | URL | Stack |
|---------|-----|-------|
| 🖥️ **Frontend** | **[realty-iq-puce.vercel.app](https://realty-iq-puce.vercel.app/)** | Next.js 14 · Vercel |
| ⚙️ **Backend API** | [realtyiq-api.onrender.com](https://realtyiq-api.onrender.com) | Express · Render |
| 🧠 **ML Service** | [realtyiq-ml.onrender.com](https://realtyiq-ml.onrender.com) | FastAPI · Render |
| 🗄️ **Database** | MongoDB Atlas | Cloud |

> **Demo login** — `demo@realtyiq.dev` / `Demo@12345`
>
> ⏳ Free-tier services sleep after ~15 min idle; the first request may take ~30s to wake.

---

## ✨ What is RealtyIQ?

RealtyIQ is a **production-style SaaS platform** that predicts real-estate prices for Indian cities using a
machine-learning model trained on real market data. Every valuation ships with a **95% confidence range** and a
breakdown of **what drove the price** — no black box, no fake numbers.

---

## 🎯 Features

<table>
<tr>
<td width="50%" valign="top">

### Core
- 🏠 **Multi-step price prediction** (React Hook Form + Zod)
- 📊 **Confidence range** from real model residuals
- 🧠 **Feature-importance chart** (why this price?)
- 🔎 **Listings browse** — filter, sort, paginate
- 🏢 **Property detail** with locality price trend
- 🔐 **JWT auth** (access + refresh, protected routes)
- 🌓 **Dark mode**, skeleton loaders, toasts

</td>
<td width="50%" valign="top">

### Advanced
- 📈 **Trends dashboard** (price over time + rankings)
- ⚖️ **Comparison tool** (listed vs predicted, 2–3 side-by-side)
- 🗺️ **Interactive map** with price **heatmap** (Leaflet)
- 💡 **"Is this a good deal?"** under/over/fair indicator
- 🔔 **Saved searches** + in-app new-match alerts
- 📄 **PDF valuation report** export (jsPDF)
- 🛠️ **Admin dashboard** (stats + listing management)

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
        ┌──────────────────┐        ┌─────────────────────┐        ┌──────────────────────┐
        │  Next.js 14 (SPA)│  HTTPS │  Express API         │  HTTPS │  FastAPI ML Service   │
        │  Vercel          │ ─────▶ │  Render (Node)       │ ─────▶ │  Render (Docker)      │
        │  React · Tailwind│        │  Auth · Listings     │        │  model.joblib         │
        │  Recharts·Leaflet│ ◀───── │  Predict · Trends    │ ◀───── │  RF / GBR / XGBoost   │
        └──────────────────┘        └──────────┬──────────┘        └──────────────────────┘
                                               │
                                     ┌─────────▼─────────┐
                                     │  MongoDB Atlas    │
                                     │  users · listings │
                                     │  predictions      │
                                     └───────────────────┘
```

---

## 🧠 The ML Model

Full pipeline on the **Kaggle Bengaluru House Price** dataset (13,320 → 10,269 rows after cleaning):
parse messy `total_sqft` (ranges + unit conversions), extract BHK, group 1,305 → 224 localities, per-locality
outlier removal, engineered `sqft_per_bhk` / `bath_per_bhk`, log-target modelling.

Three models trained and compared with **5-fold GridSearchCV**; best selected by CV R²:

| Model | CV R² | Test R² |
|-------|:-----:|:-------:|
| Random Forest | 0.749 | 0.775 |
| **Gradient Boosting** ✅ | **0.782** | **0.804** |
| XGBoost | 0.775 | 0.815 |

Each prediction returns a **95% confidence interval** derived from log-residual σ, plus feature importances.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn-style UI, Recharts, Leaflet, React Hook Form + Zod, sonner, jsPDF |
| **Backend API** | Node.js, Express, Mongoose, JWT (bcryptjs), Zod, helmet, express-rate-limit, morgan |
| **ML Service** | Python, FastAPI, scikit-learn, XGBoost, pandas, numpy, joblib, Pydantic |
| **Database** | MongoDB Atlas |
| **DevOps** | Vercel, Render, Docker, MongoDB Atlas, GitHub |

---

## 📂 Project Structure

```
RealtyIQ/
├── frontend/        # Next.js 14 app (pages, components, lib)
├── backend-api/     # Express API (auth, listings, predict, compare, trends, saved-searches)
├── ml-service/      # FastAPI + training pipeline + dataset
├── docs/            # Phase notes (1–5)
├── render.yaml      # Render blueprint (ML + API)
├── docker-compose.yml
├── DEPLOYMENT.md    # step-by-step deploy guide
├── TESTING.md       # local run + test guide
└── SECURITY.md      # security audit & hardening
```

---

## 🚀 Run Locally

```bash
# 1. ML service
cd ml-service && pip install -r requirements.txt
python src/train.py --dataset bengaluru
python -m uvicorn app.main:app --app-dir app --port 8001

# 2. Backend API   (needs MongoDB running / Atlas URI in .env)
cd backend-api && npm install && npm run seed && npm start

# 3. Frontend
cd frontend && npm install && npm run dev   # http://localhost:3000
```

Full instructions in **[TESTING.md](TESTING.md)** · deploy guide in **[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## 🔒 Security

Audited against the **"5 Security Checks"** checklist (Gitleaks · Bearer · ECC · Trail of Bits):
no hardcoded secrets, bcrypt password hashing, JWT rotation, IDOR-safe queries, Zod validation,
strict auth rate-limiting, helmet security headers, fail-fast production secret validation, and an
account-deletion flow. Details in **[SECURITY.md](SECURITY.md)**.

---

## 🗺️ Roadmap

- [x] **Phase 1** — ML pipeline: dataset, cleaning, RF/GBR/XGBoost, FastAPI `/predict` with confidence range
- [x] **Phase 2** — Express backend: JWT auth, listings CRUD, predict proxy, compare, trends, saved searches
- [x] **Phase 3** — Next.js frontend: landing, predict, results, listings, detail, auth, dashboard
- [x] **Phase 4** — Advanced: trends dashboard, comparison, map heatmap, deal indicator, saved-search alerts, PDF, admin
- [x] **Phase 5** — Deployment: MongoDB Atlas + Render + Vercel, security hardening, live 🚀

---

<div align="center">

### 👨‍💻 Author

**Govind Turkar** — final-year project

[![GitHub](https://img.shields.io/badge/GitHub-govindturkar69--crypto-181717?style=flat&logo=github)](https://github.com/govindturkar69-crypto/RealtyIQ)

<sub>Estimates are model-generated for informational purposes only and are not financial advice.</sub>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:6366f1,100:2563eb&height=100&section=footer" width="100%"/>

</div>
