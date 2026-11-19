
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 10000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeThisAdmin123!";
const UPI_ID = process.env.UPI_ID || "yourupi@bank";

const users = [];
const payments = [];
const collaborations = [];
const sessions = new Map();

function send(res, status, data, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff"
  });
  res.end(type.startsWith("application/json") ? JSON.stringify(data) : data);
}

function error(res, status, message) {
  send(res, status, { error: message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 100000) reject(new Error("Request too large"));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}

function getUser(req) {
  const t = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const id = sessions.get(t);
  return users.find(u => u.id === id) || null;
}

function safeUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    channel: u.channel,
    niche: u.niche,
    language: u.language,
    bio: u.bio,
    paidUntil: u.paidUntil || null
  };
}

function isMember(u) {
  return !!(u && u.paidUntil && new Date(u.paidUntil) > new Date());
}

const ideas = [
  { niche: "Education", title: "Explain one difficult topic in 60 seconds", format: "Short", prompt: "Explain a common mistake and give one simple example." },
  { niche: "Gaming", title: "3 beginner mistakes in your favourite game", format: "Short", prompt: "Show each mistake and explain how to fix it." },
  { niche: "Tech", title: "One free AI tool that saves time", format: "Short", prompt: "Demonstrate the tool and explain its limitations." },
  { niche: "Vlogging", title: "A day in your life with a clear story", format: "Video", prompt: "Show one goal, the obstacles and the result." },
  { niche: "Food", title: "Make a popular snack on a small budget", format: "Short", prompt: "Show ingredients, cost and preparation." },
  { niche: "Education", title: "5 questions beginners always ask", format: "Video", prompt: "Answer five common questions with examples." },
  { niche: "Business", title: "A small business lesson", format: "Short", prompt: "Explain a challenge and the lesson learned." },
  { niche: "Any", title: "What I learned after posting consistently", format: "Video", prompt: "Share honest results and improvements." }
];

const scripts = [
  {
    title: "Telugu-English educational short",
    body: "Hook: Ee topic lo chala mandi ee mistake chestaru!\nPoint 1: First, [simple explanation].\nPoint 2: Example chuddam — [example].\nClose: Ilaanti creator tips kosam follow avvandi."
  },
  {
    title: "AI tool demo short",
    body: "Hook: Ee pani ni minutes lo cheyyachu.\nProblem: Usually manam [task] ki ekkuva time spend chestham.\nDemo: [tool] open chesi, [steps] follow avvandi.\nCTA: Meeku next ye tool kavalo comment cheyyandi."
  },
  {
    title: "YouTube video intro",
    body: "Hi friends! Ee video lo manam [topic] ni beginner-friendly ga nerchukundam. Video end varaku chusthe, meeru [benefit] cheyyagalugutaru. Let's begin!"
  }
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const route = url.pathname;

  try {

    if (req.method === "GET" && route === "/health") {
      return send(res, 200, { ok: true, app: "CreatorCircle" });
    }

    if (req.method === "GET" && route === "/api/config") {
      return send(res, 200, { upiId: UPI_ID });
    }

    if (req.method === "POST" && route === "/api/register") {
      const b = await readBody(req);
      const name = String(b.name || "").trim();
      const email = String(b.email || "").trim().toLowerCase();
      const password = String(b.password || "");

      if (!name || !email || password.length < 6) {
        return error(res, 400, "Enter your name, email and password of at least 6 characters.");
      }

      if (users.some(u => u.email === email)) {
        return error(res, 409, "Email already registered. Please log in.");
      }

      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.scryptSync(password, salt, 64).toString("hex");

      const user = {
        id: crypto.randomUUID(),
        name,
        email,
        passwordHash: hash,
        salt,
        channel: String(b.channel || ""),
        niche: String(b.niche || "Any"),
        language: String(b.language || "Both"),
        bio: String(b.bio || ""),
        paidUntil: null
      };

      users.push(user);
      const t = makeToken();
      sessions.set(t, user.id);

      return send(res, 201, { token: t, user: safeUser(user) });
    }

    if (req.method === "POST" && route === "/api/login") {
      const b = await readBody(req);
      const email = String(b.email || "").trim().toLowerCase();
      const password = String(b.password || "");
      const user = users.find(u => u.email === email);

      if (!user) return error(res, 401, "Email or password is incorrect.");

      const hash = crypto.scryptSync(password, user.salt, 64).toString("hex");
      if (hash !== user.passwordHash) {
        return error(res, 401, "Email or password is incorrect.");
      }

      const t = makeToken();
      sessions.set(t, user.id);
      return send(res, 200, { token: t, user: safeUser(user) });
    }

    if (req.method === "GET" && route === "/api/me") {
      const user = getUser(req);
      if (!user) return error(res, 401, "Please log in.");
      return send(res, 200, {
        user: safeUser(user),
        isMember: isMember(user)
      });
    }

    if (req.method === "GET" && route === "/api/ideas") {
      return send(res, 200, { ideas });
    }

    if (req.method === "GET" && route === "/api/scripts") {
      return send(res, 200, { scripts });
    }

    if (req.method === "GET" && route === "/api/creators") {
      const user = getUser(req);
      if (!user) return error(res, 401, "Please log in.");

      const creators = users
        .filter(u => u.id !== user.id)
        .map(u => ({
          id: u.id,
          name: u.name,
          niche: u.niche,
          language: u.language,
          channel: u.channel,
          bio: u.bio
        }));

      return send(res, 200, { creators });
    }

    if (req.method === "POST" && route === "/api/collaborations") {
      const user = getUser(req);
      if (!user) return error(res, 401, "Please log in.");

      const b = await readBody(req);
      if (!b.targetId || !String(b.message || "").trim()) {
        return error(res, 400, "Choose a creator and write a message.");
      }

      collaborations.push({
        id: crypto.randomUUID(),
        from: user.id,
        to: String(b.targetId),
        message: String(b.message).slice(0, 1000),
        status: "Pending",
        createdAt: new Date().toISOString()
      });

      return send(res, 201, {
        ok: true,
        message: "Collaboration request sent."
      });
    }

    if (req.method === "GET" && route === "/api/collaborations") {
      const user = getUser(req);
      if (!user) return error(res, 401, "Please log in.");

      const items = collaborations
        .filter(c => c.from === user.id || c.to === user.id)
        .map(c => ({
          ...c,
          fromName: users.find(u => u.id === c.from)?.name || "Creator",
          toName: users.find(u => u.id === c.to)?.name || "Creator"
        }));

      return send(res, 200, { collaborations: items });
    }

    if (req.method === "POST" && route === "/api/payment") {
      const user = getUser(req);
      if (!user) return error(res, 401, "Please log in.");

      const b = await readBody(req);
      const reference = String(b.reference || "").trim();

      if (reference.length < 4) {
        return error(res, 400, "Enter your UPI transaction reference.");
      }

      payments.push({
        id: crypto.randomUUID(),
        userId: user.id,
        name: user.name,
        email: user.email,
        reference,
        status: "Pending",
        createdAt: new Date().toISOString()
      });

      return send(res, 201, {
        ok: true,
        message: "Payment submitted for admin verification."
      });
    }

    if (req.method === "POST" && route === "/api/admin/login") {
      const b = await readBody(req);

      if (String(b.password || "") !== ADMIN_PASSWORD) {
        return error(res, 401, "Incorrect admin password.");
      }

      const t = makeToken();
      sessions.set("admin:" + t, "ADMIN");
      return send(res, 200, { token: t });
    }

    if (route.startsWith("/api/admin/")) {
      const t = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

      if (sessions.get("admin:" + t) !== "ADMIN") {
        return error(res, 401, "Admin login required.");
      }

      if (req.method === "GET" && route === "/api/admin/overview") {
        return send(res, 200, {
          users: users.map(safeUser),
          payments,
          collaborations
        });
      }

      if (req.method === "POST" && route === "/api/admin/approve") {
        const b = await readBody(req);
        const payment = payments.find(p => p.id === b.paymentId);

        if (!payment) return error(res, 404, "Payment not found.");

        const user = users.find(u => u.id === payment.userId);
        if (!user) return error(res, 404, "Creator not found.");

        const start = user.paidUntil && new Date(user.paidUntil) > new Date()
          ? new Date(user.paidUntil)
          : new Date();

        start.setDate(start.getDate() + 30);
        user.paidUntil = start.toISOString();
        payment.status = "Approved";

        return send(res, 200, { ok: true });
      }

      if (req.method === "POST" && route === "/api/admin/reject") {
        const b = await readBody(req);
        const payment = payments.find(p => p.id === b.paymentId);

        if (!payment) return error(res, 404, "Payment not found.");

        payment.status = "Rejected";
        return send(res, 200, { ok: true });
      }
    }

    // Homepage and static files
    const requested = route === "/" ? "index.html" : route.replace(/^\/+/, "");

    const publicRoot = path.resolve(__dirname, "public");
    const rootIndex = path.resolve(__dirname, "index.html");

    let file = path.resolve(publicRoot, requested);

    if (!file.startsWith(publicRoot + path.sep) && file !== path.join(publicRoot, "index.html")) {
      return error(res, 403, "Forbidden");
    }

    if (!fs.existsSync(file) && route === "/" && fs.existsSync(rootIndex)) {
      file = rootIndex;
    }

    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, "Website file not found.", "text/plain; charset=utf-8");

      const ext = path.extname(file).toLowerCase();
      const types = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".png": "image/png",
        ".svg": "image/svg+xml"
      };

      send(res, 200, data, types[ext] || "application/octet-stream");
    });

  } catch (err) {
    console.error("Request error:", err);
    if (!res.headersSent) error(res, 500, "Server error.");
  }
});

// Start the web server
server.listen(PORT, "0.0.0.0", () => {
  console.log("CreatorCircle running on port " + PORT);
});



