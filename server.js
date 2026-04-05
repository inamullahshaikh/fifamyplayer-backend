const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const {
  normalizeSecurityAnswer,
  isAllowedQuestion,
} = require("./securityQuestions");
const app = express();

dotenv.config();

const UPLOAD_ROOT = path.join(__dirname, "uploads");
const AVATAR_DIR = path.join(UPLOAD_ROOT, "avatars");

function ensureAvatarDir() {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

function unlinkAvatarFile(avatarUrl) {
  if (!avatarUrl || typeof avatarUrl !== "string" || !avatarUrl.startsWith("/uploads/")) {
    return;
  }
  const rel = avatarUrl.replace(/^\//, "");
  const fp = path.join(__dirname, rel);
  if (fs.existsSync(fp)) {
    try {
      fs.unlinkSync(fp);
    } catch {
      /* ignore */
    }
  }
}

app.use("/uploads", express.static(UPLOAD_ROOT));

app.use(express.json());
app.use(cors());

// ✅ MongoDB connection — fix dbName here
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const Schema = mongoose.Schema;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

const User = mongoose.model(
  "User",
  new Schema(
    {
      username: { type: String, required: true, unique: true, trim: true },
      passwordHash: { type: String, required: true },
      /** One of the preset security questions (exact string). */
      securityQuestion: { type: String, default: "" },
      securityAnswerHash: { type: String, default: "" },
      /** Selected `Player` (career) document for stats entry & reads. */
      activeCareerPlayerId: {
        type: Schema.Types.ObjectId,
        ref: "Player",
        default: null,
      },
    },
    { timestamps: true },
  ),
  "users",
);

// `playerId` on this model = owning user account (legacy field name).
const Player = mongoose.model(
  "Player",
  new Schema(
    {
      name: String,
      rating: String,
      nationality: String,
      position: String,
      value: Number,
      retired: { type: Boolean, default: false },
      /** Public URL path e.g. `/uploads/avatars/...` (set by upload endpoint only). */
      avatarUrl: { type: String, default: "" },
      playerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    },
    { timestamps: true },
  ),
  "players",
);

// `playerId` on stats collections = career profile id (`Player._id`), not user id.
const SeasonData = mongoose.model(
  "SeasonData",
  new Schema({
    season: String,
    competition: String,
    apps: Number,
    goals: Number,
    assists: Number,
    avgrating: Number,
    team: String,
    playerId: { type: Schema.Types.ObjectId, ref: "Player", index: true },
  }),
  "seasondatas",
);

const YearlyData = mongoose.model(
  "YearlyData",
  new Schema({
    year: String,
    goals: Number,
    assists: Number,
    playerId: { type: Schema.Types.ObjectId, ref: "Player", index: true },
  }),
  "yearlydatas",
);

const SeasonTrophy = mongoose.model(
  "SeasonTrophy",
  new Schema({
    season: String,
    competition: String,
    playerId: { type: Schema.Types.ObjectId, ref: "Player", index: true },
  }),
  "seasontrophies",
);

const IntData = mongoose.model(
  "IntData",
  new Schema({
    season: String,
    competition: String,
    apps: Number,
    goals: Number,
    assists: Number,
    avgrating: Number,
    playerId: { type: Schema.Types.ObjectId, ref: "Player", index: true },
  }),
  "intdatas",
);

const IntTrophy = mongoose.model(
  "IntTrophy",
  new Schema({
    season: String,
    competition: String,
    playerId: { type: Schema.Types.ObjectId, ref: "Player", index: true },
  }),
  "inttrophies",
);

const SeasonAwards = mongoose.model(
  "SeasonAwards",
  new Schema({
    season: String,
    award: String,
    quantity: Number,
    playerId: { type: Schema.Types.ObjectId, ref: "Player", index: true },
  }),
  "seasonawards",
);

const Transfer = mongoose.model(
  "Transfer",
  new Schema({
    season: String,
    from: String,
    to: String,
    value: String,
    playerId: { type: Schema.Types.ObjectId, ref: "Player", index: true },
  }),
  "transfers",
);

const CAREER_OWNED_MODELS = [
  SeasonData,
  YearlyData,
  SeasonTrophy,
  IntData,
  IntTrophy,
  SeasonAwards,
  Transfer,
];

function createToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { userId: payload.userId };
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/** Max distinct career seasons / calendar years (independent caps). */
const MAX_DISTINCT_SEASONS = 15;
const MAX_DISTINCT_YEARS = 16;

const SEASON_BODY_ROUTES = new Set([
  "season_data",
  "season_trophies",
  "int_data",
  "int_trophies",
  "season_awards",
  "transfers",
]);

function playerObjectId(userId) {
  try {
    return new mongoose.Types.ObjectId(String(userId));
  } catch {
    return null;
  }
}

async function collectDistinctSeasons(playerId) {
  const pid = playerObjectId(playerId);
  if (!pid) return new Set();
  const parts = await Promise.all([
    SeasonData.distinct("season", { playerId: pid }),
    IntData.distinct("season", { playerId: pid }),
    SeasonTrophy.distinct("season", { playerId: pid }),
    IntTrophy.distinct("season", { playerId: pid }),
    SeasonAwards.distinct("season", { playerId: pid }),
    Transfer.distinct("season", { playerId: pid }),
  ]);
  const set = new Set();
  for (const arr of parts) {
    for (const s of arr) {
      const t = String(s ?? "").trim();
      if (t) set.add(t);
    }
  }
  return set;
}

async function collectDistinctYears(playerId) {
  const pid = playerObjectId(playerId);
  if (!pid) return new Set();
  const years = await YearlyData.distinct("year", { playerId: pid });
  const set = new Set();
  for (const y of years) {
    const t = String(y ?? "").trim();
    if (t) set.add(t);
  }
  return set;
}

function careerHeaderId(req) {
  const h = req.headers["x-career-player-id"];
  if (typeof h !== "string" || !mongoose.Types.ObjectId.isValid(h)) return null;
  return h;
}

/** Resolves `Player` (career) document id for the authenticated user. */
async function resolveCareerPlayerId(req) {
  const userOid = playerObjectId(req.user.userId);
  if (!userOid) return null;
  const header = careerHeaderId(req);
  if (header) {
    const ok = await Player.findOne({ _id: header, playerId: userOid })
      .select("_id")
      .lean();
    if (ok) return new mongoose.Types.ObjectId(header);
  }
  const u = await User.findById(userOid).select("activeCareerPlayerId").lean();
  if (u?.activeCareerPlayerId) {
    const sid = String(u.activeCareerPlayerId);
    const ok = await Player.findOne({ _id: sid, playerId: userOid })
      .select("_id")
      .lean();
    if (ok) return new mongoose.Types.ObjectId(sid);
  }
  const first = await Player.findOne({ playerId: userOid })
    .sort({ _id: 1 })
    .select("_id")
    .lean();
  return first?._id ?? null;
}

async function careerHasData(careerOid) {
  for (const M of CAREER_OWNED_MODELS) {
    const n = await M.countDocuments({ playerId: careerOid });
    if (n > 0) return true;
  }
  return false;
}

/** @returns {Promise<{ status: number, error: string, code: string } | null>} */
async function getPostCapViolation(routeName, careerPlayerId, body) {
  const b = body && typeof body === "object" ? body : {};
  if (routeName === "yearly_data") {
    const year = String(b.year ?? "").trim();
    if (!year) return null;
    const years = await collectDistinctYears(careerPlayerId);
    if (years.size >= MAX_DISTINCT_YEARS && !years.has(year)) {
      return {
        status: 403,
        code: "YEAR_CAP",
        error: `You already have ${MAX_DISTINCT_YEARS} calendar years. Add totals only for a year you already use, or edit/delete an existing yearly row.`,
      };
    }
    return null;
  }
  if (SEASON_BODY_ROUTES.has(routeName)) {
    const season = String(b.season ?? "").trim();
    if (!season) return null;
    const seasons = await collectDistinctSeasons(careerPlayerId);
    if (seasons.size >= MAX_DISTINCT_SEASONS && !seasons.has(season)) {
      return {
        status: 403,
        code: "SEASON_CAP",
        error: `You already have ${MAX_DISTINCT_SEASONS} seasons. Add data only for a season you already use, or edit/delete existing rows.`,
      };
    }
    return null;
  }
  return null;
}

const authRouter = express.Router();

authRouter.post("/auth/register", async (req, res) => {
  try {
    const username = String(req.body?.username || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    const securityQuestion = String(req.body?.securityQuestion || "").trim();
    const securityAnswer = String(req.body?.securityAnswer || "");
    if (!username || password.length < 6) {
      return res
        .status(400)
        .json({
          error:
            "Username is required and password must be at least 6 characters",
        });
    }
    if (!isAllowedQuestion(securityQuestion)) {
      return res.status(400).json({ error: "Choose a valid security question" });
    }
    if (securityAnswer.trim().length < 2) {
      return res
        .status(400)
        .json({ error: "Security answer must be at least 2 characters" });
    }
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const securityAnswerHash = await bcrypt.hash(
      normalizeSecurityAnswer(securityAnswer),
      10,
    );
    const user = await User.create({
      username,
      passwordHash,
      securityQuestion,
      securityAnswerHash,
    });
    const career = await Player.create({
      name: "My career",
      rating: "",
      nationality: "",
      position: "",
      value: 0,
      retired: false,
      playerId: user._id,
    });
    await User.updateOne(
      { _id: user._id },
      { $set: { activeCareerPlayerId: career._id } },
    );
    const token = createToken(String(user._id));
    return res.status(201).json({
      token,
      user: { id: user._id, username: user.username },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

authRouter.post("/auth/login", async (req, res) => {
  try {
    const username = String(req.body?.username || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = createToken(String(user._id));
    return res.json({
      token,
      user: { id: user._id, username: user.username },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** Step 1: username → security question (if recovery is configured). */
authRouter.post("/auth/recovery/question", async (req, res) => {
  try {
    const username = String(req.body?.username || "")
      .trim()
      .toLowerCase();
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const user = await User.findOne({ username }).select(
      "securityQuestion securityAnswerHash",
    );
    const canRecover = Boolean(
      user && user.securityAnswerHash && user.securityQuestion,
    );
    if (!canRecover) {
      return res.json({
        canRecover: false,
        securityQuestion: null,
      });
    }
    return res.json({
      canRecover: true,
      securityQuestion: user.securityQuestion,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/** Step 2: verify answer and set new password. */
authRouter.post("/auth/recovery/reset", async (req, res) => {
  try {
    const username = String(req.body?.username || "")
      .trim()
      .toLowerCase();
    const securityAnswer = String(req.body?.securityAnswer || "");
    const newPassword = String(req.body?.newPassword || "");
    if (!username || !securityAnswer || newPassword.length < 6) {
      return res.status(400).json({
        error:
          "Username, security answer, and a new password (min 6 characters) are required",
      });
    }
    const user = await User.findOne({ username });
    if (!user || !user.securityAnswerHash) {
      return res
        .status(400)
        .json({ error: "Recovery is not available for this account" });
    }
    const match = await bcrypt.compare(
      normalizeSecurityAnswer(securityAnswer),
      user.securityAnswerHash,
    );
    if (!match) {
      return res.status(401).json({ error: "Security answer does not match" });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const router = express.Router();

router.get("/me", async (req, res) => {
  try {
    const u = await User.findById(req.user.userId).select(
      "username securityQuestion securityAnswerHash",
    );
    if (!u) return res.status(404).json({ error: "Not found" });
    res.json({
      username: u.username,
      hasSecurityRecovery: Boolean(u.securityAnswerHash && u.securityQuestion),
      securityQuestion: u.securityQuestion || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/me/password", async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters" });
    }
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "Not found" });
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/me/security", async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const securityQuestion = String(req.body?.securityQuestion || "").trim();
    const securityAnswer = String(req.body?.securityAnswer || "");
    if (!currentPassword) {
      return res.status(400).json({ error: "Current password is required" });
    }
    if (!isAllowedQuestion(securityQuestion)) {
      return res.status(400).json({ error: "Choose a valid security question" });
    }
    if (securityAnswer.trim().length < 2) {
      return res
        .status(400)
        .json({ error: "Security answer must be at least 2 characters" });
    }
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: "Not found" });
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    user.securityQuestion = securityQuestion;
    user.securityAnswerHash = await bcrypt.hash(
      normalizeSecurityAnswer(securityAnswer),
      10,
    );
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/me/active-career", async (req, res) => {
  try {
    const raw = String(req.body?.careerPlayerId ?? "").trim();
    if (!mongoose.Types.ObjectId.isValid(raw)) {
      return res.status(400).json({ error: "Invalid careerPlayerId" });
    }
    const userOid = playerObjectId(req.user.userId);
    const p = await Player.findOne({ _id: raw, playerId: userOid });
    if (!p) return res.status(404).json({ error: "Career not found" });
    await User.updateOne(
      { _id: userOid },
      { $set: { activeCareerPlayerId: p._id } },
    );
    res.json({ ok: true, careerPlayerId: String(p._id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/data_entry_status", async (req, res) => {
  try {
    const careerId = await resolveCareerPlayerId(req);
    if (!careerId) {
      return res.json({
        seasonCount: 0,
        yearCount: 0,
        maxSeasons: MAX_DISTINCT_SEASONS,
        maxYears: MAX_DISTINCT_YEARS,
        seasonCapReached: false,
        yearCapReached: false,
        existingSeasons: [],
      });
    }
    const seasonsSet = await collectDistinctSeasons(careerId);
    const yearsSet = await collectDistinctYears(careerId);
    const existingSeasons = [...seasonsSet].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    res.json({
      seasonCount: seasonsSet.size,
      yearCount: yearsSet.size,
      maxSeasons: MAX_DISTINCT_SEASONS,
      maxYears: MAX_DISTINCT_YEARS,
      seasonCapReached: seasonsSet.size >= MAX_DISTINCT_SEASONS,
      yearCapReached: yearsSet.size >= MAX_DISTINCT_YEARS,
      existingSeasons,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function createCareerCrud(model, routeName) {
  router.post(`/${routeName}`, async (req, res) => {
    try {
      const careerId = await resolveCareerPlayerId(req);
      if (!careerId) {
        return res.status(400).json({
          error:
            "No career profile is available. Create a player profile first, then select it.",
        });
      }
      const violation = await getPostCapViolation(
        routeName,
        careerId,
        req.body,
      );
      if (violation) {
        return res
          .status(violation.status)
          .json({ error: violation.error, code: violation.code });
      }
      const { playerId: _ignore, ...rest } =
        req.body && typeof req.body === "object" ? req.body : {};
      const doc = new model({ ...rest, playerId: careerId });
      await doc.save();
      res.status(201).json(doc);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get(`/${routeName}`, async (req, res) => {
    try {
      const careerId = await resolveCareerPlayerId(req);
      if (!careerId) return res.json([]);
      const docs = await model.find({ playerId: careerId });
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get(`/${routeName}/:id`, async (req, res) => {
    try {
      const careerId = await resolveCareerPlayerId(req);
      if (!careerId) return res.status(404).json({ error: "Not found" });
      const doc = await model.findOne({
        _id: req.params.id,
        playerId: careerId,
      });
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json(doc);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put(`/${routeName}/:id`, async (req, res) => {
    try {
      const careerId = await resolveCareerPlayerId(req);
      if (!careerId) {
        return res.status(400).json({ error: "No active career profile selected." });
      }
      const { playerId: _ignore, ...rest } =
        req.body && typeof req.body === "object" ? req.body : {};
      const doc = await model.findOneAndUpdate(
        { _id: req.params.id, playerId: careerId },
        { ...rest, playerId: careerId },
        { new: true },
      );
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json(doc);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete(`/${routeName}/:id`, async (req, res) => {
    try {
      const careerId = await resolveCareerPlayerId(req);
      if (!careerId) return res.status(404).json({ error: "Not found" });
      const doc = await model.findOneAndDelete({
        _id: req.params.id,
        playerId: careerId,
      });
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json({ message: "Deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

const userOid = (req) => playerObjectId(req.user.userId);

router.get("/players", async (req, res) => {
  try {
    const oid = userOid(req);
    if (!oid) return res.json([]);
    const list = await Player.find({ playerId: oid }).sort({ _id: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/players", async (req, res) => {
  try {
    const oid = userOid(req);
    if (!oid) return res.status(400).json({ error: "Invalid user" });
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const {
      playerId: _a,
      _id: _b,
      name,
      rating,
      nationality,
      position,
      value,
      retired,
    } = b;
    const doc = await Player.create({
      name: name != null && String(name).trim() ? String(name).trim() : "New career",
      rating: rating != null ? String(rating) : "",
      nationality: nationality != null ? String(nationality) : "",
      position: position != null ? String(position) : "",
      value: value != null && !Number.isNaN(Number(value)) ? Number(value) : 0,
      retired: Boolean(retired),
      playerId: oid,
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/players/:id", async (req, res) => {
  try {
    const oid = userOid(req);
    const doc = await Player.findOne({ _id: req.params.id, playerId: oid });
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      ensureAvatarDir();
      cb(null, AVATAR_DIR);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const safe = allowed.includes(ext) ? ext : ".jpg";
    cb(null, `${req.params.id}-${Date.now()}${safe}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image uploads are allowed"));
  },
});

function runAvatarUpload(req, res, next) {
  avatarUpload.single("avatar")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed" });
    }
    next();
  });
}

router.post("/players/:id/avatar", runAvatarUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Missing image file (form field name: avatar)" });
    }
    const oid = userOid(req);
    const careerOid = playerObjectId(req.params.id);
    if (!careerOid) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Invalid player id" });
    }
    const p = await Player.findOne({ _id: careerOid, playerId: oid });
    if (!p) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Not found" });
    }
    const publicPath = `/uploads/avatars/${req.file.filename}`;
    unlinkAvatarFile(p.avatarUrl);
    p.avatarUrl = publicPath;
    await p.save();
    res.json(p);
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete("/players/:id/avatar", async (req, res) => {
  try {
    const oid = userOid(req);
    const careerOid = playerObjectId(req.params.id);
    const p = await Player.findOne({ _id: careerOid, playerId: oid });
    if (!p) return res.status(404).json({ error: "Not found" });
    unlinkAvatarFile(p.avatarUrl);
    p.avatarUrl = "";
    await p.save();
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/players/:id", async (req, res) => {
  try {
    const oid = userOid(req);
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const { playerId: _a, _id: _b, avatarUrl: _av, ...rest } = b;
    const doc = await Player.findOneAndUpdate(
      { _id: req.params.id, playerId: oid },
      { ...rest, playerId: oid },
      { new: true },
    );
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/players/:id", async (req, res) => {
  try {
    const oid = userOid(req);
    const careerOid = playerObjectId(req.params.id);
    if (!careerOid) return res.status(400).json({ error: "Invalid id" });
    const p = await Player.findOne({ _id: careerOid, playerId: oid });
    if (!p) return res.status(404).json({ error: "Not found" });
    if (await careerHasData(careerOid)) {
      return res.status(409).json({
        error:
          "This career has season stats, trophies, or transfers. Remove that data first, or keep the profile.",
      });
    }
    unlinkAvatarFile(p.avatarUrl);
    await Player.findOneAndDelete({ _id: careerOid, playerId: oid });
    const u = await User.findById(oid).select("activeCareerPlayerId");
    if (u && String(u.activeCareerPlayerId) === String(careerOid)) {
      const next = await Player.findOne({ playerId: oid })
        .sort({ _id: 1 })
        .select("_id");
      await User.updateOne(
        { _id: oid },
        { $set: { activeCareerPlayerId: next ? next._id : null } },
      );
    }
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

createCareerCrud(SeasonData, "season_data");
createCareerCrud(YearlyData, "yearly_data");
createCareerCrud(SeasonTrophy, "season_trophies");
createCareerCrud(IntData, "int_data");
createCareerCrud(IntTrophy, "int_trophies");
createCareerCrud(SeasonAwards, "season_awards");
createCareerCrud(Transfer, "transfers");
app.use("/api", authRouter);
app.use("/api", authMiddleware, router);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
