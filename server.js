const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 10000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeThisAdmin123!";
const UPI_ID = process.env.UPI_ID || "yourupi@bank";
const SITE_URL = process.env.SITE_URL || "";
const users = [];
const payments = [];
const collaborations = [];
const sessions = new Map();

function send(res, status, data, type="application/json; charset=utf-8") {
  res.writeHead(status, {"Content-Type": type, "X-Content-Type-Options":"nosniff"});
  res.end(type.startsWith("application/json") ? JSON.stringify(data) : data);
}
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; if (body.length > 100000) reject(new Error("Request too large")); });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("Invalid JSON")); }
    });
  });
}
function token() { return crypto.randomBytes(24).toString("hex"); }
function getUser(req) {
  const t = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const id = sessions.get(t);
  return users.find(u => u.id === id) || null;
}
function safeUser(u) {
  return {id:u.id, name:u.name, email:u.email, channel:u.channel, niche:u.niche, language:u.language, bio:u.bio, paidUntil:u.paidUntil || null};
}
function member(u) { return !!(u && u.paidUntil && new Date(u.paidUntil) > new Date()); }
function sendError(res, status, message) { send(res, status, {error:message}); }

const ideas = [
  {niche:"Education", title:"Explain one difficult topic in 60 seconds", format:"Short", prompt:"Start with a common mistake, explain the correct idea, and end with one quick example."},
  {niche:"Gaming", title:"3 beginner mistakes in your favourite game", format:"Short", prompt:"Show each mistake with a quick clip and one practical fix."},
  {niche:"Tech", title:"One free AI tool that saves time", format:"Short", prompt:"Show the problem, demonstrate the tool, and explain one limitation honestly."},
  {niche:"Vlogging", title:"A day in your life with a clear story", format:"Video", prompt:"Choose one goal for the day, show obstacles, and finish with the result."},
  {niche:"Food", title:"Make a popular snack on a small budget", format:"Short", prompt:"Show ingredients and total cost, then the fastest preparation steps."},
  {niche:"Education", title:"5 questions beginners always ask", format:"Video", prompt:"Answer each question simply and include examples viewers can save."},
  {niche:"Business", title:"A small business lesson from a real example", format:"Short", prompt:"Explain the challenge, the decision, and the lesson for beginners."},
  {niche:"Any", title:"What I learned after posting consistently", format:"Video", prompt:"Share real results, what did not work, and what you will change next."}
];

const scripts = [
  {title:"Telugu-English educational short", body:"Hook: Ee topic lo chala mandi ee mistake chestaru!\\nPoint 1: First, [simple explanation].\\nPoint 2: Example chuddam — [example].\\nClose: Ilaanti simple creator tips kosam follow avvandi."},
  {title:"AI tool demo short", body:"Hook: Ee pani ni minutes lo cheyyachu.\\nProblem: Usually manam [task] ki ekkuva time spend chestham.\\nDemo: [tool] open chesi, [steps] follow avvandi.\\nHonest note: Output ni publish cheyyadaniki mundu check cheyyandi.\\nCTA: Meeku next ye tool kavalo comment cheyyandi."},
  {title:"YouTube video intro", body:"Hi friends! Ee video lo manam [topic] ni beginner-friendly ga nerchukundam. Video end varaku chusthe, meeru [benefit] cheyyagalugutaru. Let's begin!"}
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, {ok:true, app:"CreatorCircle"});
  if (req.method === "GET" && url.pathname === "/api/config") return send(res, 200, {upiId:UPI_ID, siteUrl:SITE_URL});
  if (req.method === "POST" && url.pathname === "/api/register") {
    try {
      const b = await parseBody(req);
      const name = String(b.name||"").trim(), email = String(b.email||"").trim().toLowerCase();
      const password = String(b.password||"");
      if (!name || !email || password.length < 6) return sendError(res,400,"Enter your name, valid email and password (at least 6 characters).");
      if (users.some(u=>u.email===email)) return sendError(res,409,"This email is already registered. Please log in.");
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.scryptSync(password,salt,64).toString("hex");
      const u = {id:crypto.randomUUID(),name,email,passwordHash:hash,salt,channel:String(b.channel||""),niche:String(b.niche||"Any"),language:String(b.language||"Both"),bio:String(b.bio||""),paidUntil:null,createdAt:new Date().toISOString()};
      users.push(u); const t=token(); sessions.set(t,u.id);
      return send(res,201,{token:t,user:safeUser(u)});
    } catch(e) { return sendError(res,400,e.message); }
  }
  if (req.method === "POST" && url.pathname === "/api/login") {
    try {
      const b=await parseBody(req), email=String(b.email||"").trim().toLowerCase(), password=String(b.password||"");
      const u=users.find(x=>x.email===email);
      if (!u || crypto.scryptSync(password,u.salt,64).toString("hex")!==u.passwordHash) return sendError(res,401,"Email or password is incorrect.");
      const t=token(); sessions.set(t,u.id); return send(res,200,{token:t,user:safeUser(u)});
    } catch(e) { return sendError(res,400,e.message); }
  }
  if (req.method === "GET" && url.pathname === "/api/me") {
    const u=getUser(req); if(!u) return sendError(res,401,"Please log in."); return send(res,200,{user:safeUser(u),isMember:member(u)});
  }
  if (req.method === "GET" && url.pathname === "/api/ideas") return send(res,200,{ideas});
  if (req.method === "GET" && url.pathname === "/api/scripts") return send(res,200,{scripts});
  if (req.method === "GET" && url.pathname === "/api/creators") {
    const u=getUser(req); if(!u) return sendError(res,401,"Please log in.");
    const list=users.filter(x=>x.id!==u.id).map(x=>({id:x.id,name:x.name,niche:x.niche,language:x.language,channel:x.channel,bio:x.bio}));
    return send(res,200,{creators:list});
  }
  if (req.method === "POST" && url.pathname === "/api/collaborations") {
    const u=getUser(req); if(!u) return sendError(res,401,"Please log in.");
    try { const b=await parseBody(req); if(!b.targetId || !String(b.message||"").trim()) return sendError(res,400,"Choose a creator and write a message.");
      collaborations.push({id:crypto.randomUUID(),from:u.id,to:String(b.targetId),message:String(b.message).slice(0,1000),status:"Pending",createdAt:new Date().toISOString()});
      return send(res,201,{ok:true,message:"Collaboration request sent."});
    } catch(e){return sendError(res,400,e.message);}
  }
  if (req.method === "GET" && url.pathname === "/api/collaborations") {
    const u=getUser(req); if(!u) return sendError(res,401,"Please log in.");
    const items=collaborations.filter(c=>c.from===u.id||c.to===u.id).map(c=>({...c,fromName:users.find(x=>x.id===c.from)?.name||"Creator",toName:users.find(x=>x.id===c.to)?.name||"Creator"}));
    return send(res,200,{collaborations:items});
  }
  if (req.method === "POST" && url.pathname === "/api/payment") {
    const u=getUser(req); if(!u) return sendError(res,401,"Please log in.");
    try { const b=await parseBody(req); const ref=String(b.reference||"").trim(); if(ref.length<4) return sendError(res,400,"Enter your UPI transaction reference.");
      payments.push({id:crypto.randomUUID(),userId:u.id,name:u.name,email:u.email,reference:ref,status:"Pending",createdAt:new Date().toISOString()});
      return send(res,201,{ok:true,message:"Payment reference submitted for admin review."});
    } catch(e){return sendError(res,400,e.message);}
  }
  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    try { const b=await parseBody(req); if(String(b.password||"")!==ADMIN_PASSWORD) return sendError(res,401,"Incorrect admin password.");
      const t=token(); sessions.set("admin:"+t,"ADMIN"); return send(res,200,{token:t});
    } catch(e){return sendError(res,400,e.message);}
  }
  if (url.pathname.startsWith("/api/admin/")) {
    const t=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
    if(sessions.get("admin:"+t)!=="ADMIN") return sendError(res,401,"Admin login required.");
    if(req.method==="GET" && url.pathname==="/api/admin/overview") return send(res,200,{users:users.map(safeUser),payments,collaborations});
    if(req.method==="POST" && url.pathname==="/api/admin/approve") {
      try { const b=await parseBody(req); const p=payments.find(x=>x.id===b.paymentId); if(!p) return sendError(res,404,"Payment not found.");
        const u=users.find(x=>x.id===p.userId); if(!u) return sendError(res,404,"Creator not found.");
        const start=u.paidUntil && new Date(u.paidUntil)>new Date()?new Date(u.paidUntil):new Date();
        start.setDate(start.getDate()+30); u.paidUntil=start.toISOString(); p.status="Approved"; p.approvedAt=new Date().toISOString();
        return send(res,200,{ok:true});
      } catch(e){return sendError(res,400,e.message);}
    }
    if(req.method==="POST" && url.pathname==="/api/admin/reject") {
      try { const b=await parseBody(req); const p=payments.find(x=>x.id===b.paymentId); if(!p) return sendError(res,404,"Payment not found."); p.status="Rejected"; return send(res,200,{ok:true}); }
      catch(e){return sendError(res,400,e.message);}
    }
  }
  
  // Serve frontend files
  let file = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
  let full = path.join(__dirname, "public", file);

  if (url.pathname === "/" && !fs.existsSync(full)) {
    full = path.join(__dirname, "index.html");
  }

  if (!full.startsWith(path.join(__dirname, "public")) &&
      full !== path.join(__dirname, "index.html")) {
    return sendError(res, 403, "Forbidden");
  }

  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    const ext = path.extname(full);
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8"
    };
    send(res, 200, data, types[ext] || "application/octet-stream");
  });
});


server.listen(PORT, "0.0.0.0", () => console.log(`CreatorCircle running on ${PORT}`));


