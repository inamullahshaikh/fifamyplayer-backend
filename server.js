const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = express();

dotenv.config();

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
    },
    { timestamps: true }
  ),
  "users"
);

// ✅ Add collection name as 3rd argument to avoid Mongoose pluralizing incorrectly
const Player = mongoose.model(
  "Player",
  new Schema({
    name: String,
    rating: String,
    nationality: String,
    position: String,
    value: Number,
    retired: { type: Boolean, default: false },
    playerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  }),
  "players"
);

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
    playerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  }),
  "seasondatas"
);

const YearlyData = mongoose.model(
  "YearlyData",
  new Schema({
    year: String,
    goals: Number,
    assists: Number,
    playerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  }),
  "yearlydatas"
);

const SeasonTrophy = mongoose.model(
  "SeasonTrophy",
  new Schema({
    season: String,
    competition: String,
    playerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  }),
  "seasontrophies"
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
    playerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  }),
  "intdatas"
);

const IntTrophy = mongoose.model(
  "IntTrophy",
  new Schema({
    season: String,
    competition: String,
    playerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  }),
  "inttrophies"
);

const SeasonAwards = mongoose.model(
  "SeasonAwards",
  new Schema({
    season: String,
    award: String,
    quantity: Number,
    playerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  }),
  "seasonawards"
);

const Transfer = mongoose.model(
  "Transfer",
  new Schema({
    season: String,
    from: String,
    to: String,
    value: String,
    playerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  }),
  "transfers"
);

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

const authRouter = express.Router();

authRouter.post("/auth/register", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!username || password.length < 6) {
      return res
        .status(400)
        .json({ error: "Username is required and password must be at least 6 characters" });
    }
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash });
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
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
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

const router = express.Router();

function createCrudRoutes(model, routeName) {
  router.post(`/${routeName}`, async (req, res) => {
    try {
      const doc = new model({ ...req.body, playerId: req.user.userId });
      await doc.save();
      res.status(201).json(doc);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get(`/${routeName}`, async (req, res) => {
    try {
      const docs = await model.find({ playerId: req.user.userId });
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get(`/${routeName}/:id`, async (req, res) => {
    try {
      const doc = await model.findOne({
        _id: req.params.id,
        playerId: req.user.userId,
      });
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json(doc);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put(`/${routeName}/:id`, async (req, res) => {
    try {
      const doc = await model.findOneAndUpdate(
        {
          _id: req.params.id,
          playerId: req.user.userId,
        },
        { ...req.body, playerId: req.user.userId },
        {
        new: true,
        }
      );
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json(doc);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete(`/${routeName}/:id`, async (req, res) => {
    try {
      const doc = await model.findOneAndDelete({
        _id: req.params.id,
        playerId: req.user.userId,
      });
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json({ message: "Deleted successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// ✅ Register API endpoints
createCrudRoutes(Player, "players");
createCrudRoutes(SeasonData, "season_data");
createCrudRoutes(YearlyData, "yearly_data");
createCrudRoutes(SeasonTrophy, "season_trophies");
createCrudRoutes(IntData, "int_data");
createCrudRoutes(IntTrophy, "int_trophies");
createCrudRoutes(SeasonAwards, "season_awards");
createCrudRoutes(Transfer, "transfers");
app.use("/api", authRouter);
app.use("/api", authMiddleware, router);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
