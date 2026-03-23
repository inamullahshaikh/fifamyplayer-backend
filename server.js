const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const app = express();

dotenv.config();

app.use(express.json());
app.use(cors());

// ✅ MongoDB connection — fix dbName here
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const Schema = mongoose.Schema;

// ✅ Add collection name as 3rd argument to avoid Mongoose pluralizing incorrectly
const Player = mongoose.model(
  "Player",
  new Schema({
    name: String,
    rating: String,
    nationality: String,
    position: String,
    value: Number,
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
  }),
  "seasondatas"
);

const YearlyData = mongoose.model(
  "YearlyData",
  new Schema({
    year: String,
    goals: Number,
    assists: Number,
  }),
  "yearlydatas"
);

const SeasonTrophy = mongoose.model(
  "SeasonTrophy",
  new Schema({
    season: String,
    competition: String,
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
  }),
  "intdatas"
);

const IntTrophy = mongoose.model(
  "IntTrophy",
  new Schema({
    season: String,
    competition: String,
  }),
  "inttrophies"
);

const SeasonAwards = mongoose.model(
  "SeasonAwards",
  new Schema({
    season: String,
    award: String,
    quantity: Number,
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
  }),
  "transfers"
);

// ========= CRUD Generator ==========
const router = express.Router();

function createCrudRoutes(model, routeName) {
  router.post(`/${routeName}`, async (req, res) => {
    try {
      const doc = new model(req.body);
      await doc.save();
      res.status(201).json(doc);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get(`/${routeName}`, async (req, res) => {
    try {
      const docs = await model.find({});
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get(`/${routeName}/:id`, async (req, res) => {
    try {
      const doc = await model.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json(doc);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put(`/${routeName}/:id`, async (req, res) => {
    try {
      const doc = await model.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!doc) return res.status(404).json({ error: "Not found" });
      res.json(doc);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete(`/${routeName}/:id`, async (req, res) => {
    try {
      const doc = await model.findByIdAndDelete(req.params.id);
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
app.use("/api", router);

// Production UI: Vite build output (see Render build: cd fifamyplayer-frontend && npm run build)
const distDir = path.join(__dirname, "..", "fifamyplayer-frontend", "dist");
app.use(express.static(distDir));
// Express 5 / path-to-regexp v8: bare "*" is invalid — use middleware after static
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) next(err);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
