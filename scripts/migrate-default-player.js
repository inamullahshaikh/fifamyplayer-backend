const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error("MONGO_URI is required");
}

const DEFAULT_USERNAME = process.env.DEFAULT_PLAYER_USERNAME || "default_player";
const DEFAULT_PASSWORD = process.env.DEFAULT_PLAYER_PASSWORD || "ChangeMe123!";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

const ownedDataSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  },
  { strict: false }
);

const User = mongoose.model("User", userSchema, "users");

const MODELS = [
  mongoose.model("Player", ownedDataSchema, "players"),
  mongoose.model("SeasonData", ownedDataSchema, "seasondatas"),
  mongoose.model("YearlyData", ownedDataSchema, "yearlydatas"),
  mongoose.model("SeasonTrophy", ownedDataSchema, "seasontrophies"),
  mongoose.model("IntData", ownedDataSchema, "intdatas"),
  mongoose.model("IntTrophy", ownedDataSchema, "inttrophies"),
  mongoose.model("SeasonAwards", ownedDataSchema, "seasonawards"),
  mongoose.model("Transfer", ownedDataSchema, "transfers"),
];

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const username = DEFAULT_USERNAME.trim().toLowerCase();
  let user = await User.findOne({ username });
  if (!user) {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    user = await User.create({ username, passwordHash });
    console.log(`Created default user: ${username}`);
  } else {
    console.log(`Using existing default user: ${username}`);
  }

  for (const Model of MODELS) {
    const result = await Model.updateMany(
      { $or: [{ playerId: { $exists: false } }, { playerId: null }] },
      { $set: { playerId: user._id } }
    );
    console.log(`${Model.collection.collectionName}: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
  }
}

run()
  .then(async () => {
    await mongoose.disconnect();
    console.log("Migration complete");
  })
  .catch(async (err) => {
    console.error("Migration failed:", err);
    try {
      await mongoose.disconnect();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  });

