# 🤝 Contributing to DB Zoo

First off — welcome. And seriously, thanks for being here ❤️

DB Zoo is built for developers, by developers — and contributions are what make it better.

Whether you're fixing a bug, improving UI, or adding a new database feature — you're helping shape the future of this tool.

---

## 🚀 Ways You Can Contribute

You don’t need to be an expert to help.

- 🐛 Found a bug? Report it
- 💡 Got an idea? Share it
- 🛠️ Want to build something? Go for it
- 📖 Improve docs
- 🧪 Test edge cases

Every contribution matters.

---

## ⚡ Quick Start

### 1. Fork & clone

```bash
git clone https://github.com/your-username/db-zoo.git
cd db-zoo
```

---

### 2. Install & run

```bash
npm install
npm run prisma:generate
npm run dev
```

Boom — you're in.

---

## 🌱 Create a Branch

Keep things clean and scoped:

```bash
git checkout -b feature/your-feature
```

Examples:

- `feature/sql-export`
- `fix/postgres-timezone-bug`
- `ui/improve-table-layout`

---

## 🧠 Guidelines (Keep It Clean)

- Write **clear, readable TypeScript**
- Avoid unnecessary complexity
- Follow existing structure
- Reuse components when possible
- Keep UI consistent (Tailwind patterns)

Think:
> “Would another dev understand this instantly?”

---

## 🔐 Security Mindset

DB Zoo deals with databases — so be careful.

- ❌ Never commit secrets
- 🔐 Respect encryption logic
- ⚠️ Be cautious with query execution changes
- 🧪 Test anything that touches DB operations

---

## 🧪 Before You Submit

Make sure:

```bash
npm run dev
npm run build
```

✔ No crashes  
✔ Feature works  
✔ No regressions  

---

## 📝 Commit Like a Pro

Use clean commit messages:

```
feat: add query export
fix: handle null values in postgres
refactor: simplify provider logic
```

---

## 📬 Pull Request

When you're ready:

1. Push your branch
2. Open a PR
3. Explain:
   - what you changed
   - why it matters
   - how to test it

Screenshots are a big plus for UI changes.

---

## 🙌 Final Note

You don’t need permission to improve something.

If you see a better way — build it.

We’re glad you’re here 💖