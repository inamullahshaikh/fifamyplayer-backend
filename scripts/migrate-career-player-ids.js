/**
 * One-time migration: stats collections used `playerId` = User._id.
 * They now use `playerId` = Player._id (career profile).
 *
 * For each user: ensure at least one Player row, then rewrite all
 * seasondatas, yearlydatas, etc. from user id → that Player._id.
 *
 * Run: node scripts/migrate-career-player-ids.js
 */
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error("MONGO_URI is required");
}

const ownedByUser = {
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
};

const User = mongoose.model(
  "User",
  new mongoose.Schema(
    {
      username: String,
      passwordHash: String,
      activeCareerPlayerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Player",
        default: null,
      },
    },
    { strict: false, timestamps: true },
  ),
  "users",
);

const Player = mongoose.model(
  "Player",
  new mongoose.Schema(
    {
      name: String,
      rating: String,
      nationality: String,
      position: String,
      value: Number,
      retired: Boolean,
      playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    },
    { strict: false, timestamps: true },
  ),
  "players",
);

const MODELS = [
  mongoose.model("SeasonData", new mongoose.Schema(ownedByUser, { strict: false }), "seasondatas"),
  mongoose.model("YearlyData", new mongoose.Schema(ownedByUser, { strict: false }), "yearlydatas"),
  mongoose.model("SeasonTrophy", new mongoose.Schema(ownedByUser, { strict: false }), "seasontrophies"),
  mongoose.model("IntData", new mongoose.Schema(ownedByUser, { strict: false }), "intdatas"),
  mongoose.model("IntTrophy", new mongoose.Schema(ownedByUser, { strict: false }), "inttrophies"),
  mongoose.model("SeasonAwards", new mongoose.Schema(ownedByUser, { strict: false }), "seasonawards"),
  mongoose.model("Transfer", new mongoose.Schema(ownedByUser, { strict: false }), "transfers"),
];

async function primaryCareerForUser(userId) {
  const uid = new mongoose.Types.ObjectId(String(userId));
  let list = await Player.find({ playerId: uid }).sort({ _id: 1 });
  if (list.length === 0) {
    const created = await Player.create({
      name: "My career",
      rating: "",
      nationality: "",
      position: "",
      value: 0,
      retired: false,
      playerId: uid,
    });
    list = [created];
    console.log(`  Created default Player for user ${uid}`);
  }
  return list[0]._id;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const users = await User.find({}).select("_id activeCareerPlayerId").lean();
  console.log(`Found ${users.length} users`);

  for (const u of users) {
    const uid = u._id;
    const careerId = await primaryCareerForUser(uid);
    const extraPlayers = await Player.find({ playerId: uid, _id: { $ne: careerId } })
      .select("_id name")
      .lean();
    if (extraPlayers.length > 0) {
      console.log(
        `  User ${uid}: ${1 + extraPlayers.length} career profile(s); attaching legacy data to ${careerId}`,
      );
    }

    for (const Model of MODELS) {
      const r = await Model.updateMany(
        { playerId: uid },
        { $set: { playerId: careerId } },
      );
      if (r.modifiedCount > 0) {
        console.log(
          `  ${Model.collection.collectionName}: ${r.modifiedCount} docs user→career`,
        );
      }
    }

    const activeOk =
      u.activeCareerPlayerId &&
      (await Player.exists({ _id: u.activeCareerPlayerId, playerId: uid }));
    if (!activeOk) {
      await User.updateOne({ _id: uid }, { $set: { activeCareerPlayerId: careerId } });
      console.log(`  Set activeCareerPlayerId for user ${uid}`);
    }
  }

  console.log("Done.");
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    try {
      await mongoose.disconnect();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  });
