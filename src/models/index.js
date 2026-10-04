import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  usernameDisplay: String,
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  managerName: { type: String, trim: true, default: '' },
  continent: { type: String, default: '' },
  country: { type: String, default: '' },
  clubId: { type: ObjectId, ref: 'Club', default: null },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  onboarding: {
    step: { type: String, enum: ['club', 'manager', 'league', 'waitlist', 'done'], default: 'club' },
    templateKey: String,
    waitTier: Number,
  },
  resetTokenHash: String,
  resetExpires: Date,
}, { timestamps: true });

const ClubSchema = new Schema({
  templateKey: { type: String, required: true },
  name: String,
  displayName: String,
  short: String,
  leagueTier: { type: Number, enum: [1, 2], index: true },
  isAI: { type: Boolean, default: true, index: true },
  manager: { type: ObjectId, ref: 'User', default: null },
  managerName: String,
  crestColors: [String],
  stadiumName: String,
  kit: { shirt: String, shorts: String, number: String },
  fans: { type: Number, default: 10000 },
  seasonForm: [String],
  forfeited: { type: Boolean, default: false },
  tactics: {
    formation: { type: String, default: '4-3-3' },
    style: { type: String, default: 'balanced' },
    lineup: [{ type: ObjectId, ref: 'Player' }],
    bench: [{ type: ObjectId, ref: 'Player' }],
    captain: { type: ObjectId, ref: 'Player', default: null },
  },
}, { timestamps: true });

const PlayerSchema = new Schema({
  club: { type: ObjectId, ref: 'Club', index: true },
  name: String, position: String, number: Number,
  ovr: Number, pace: Number, shooting: Number, passing: Number, dribbling: Number, defending: Number, physical: Number,
  stamina: Number, stars: Number, skillMoves: Number, country: String, countryCode: String, foot: String,
  age: Number, heightCm: Number, weightKg: Number, portraitSeed: Number,
  injuredFor: { type: Number, default: 0 }, suspendedFor: { type: Number, default: 0 },
  form: [Number], apps: { type: Number, default: 0 },
});

const FixtureSchema = new Schema({
  season: { type: Number, index: true },
  leagueTier: { type: Number, index: true },
  gameweek: Number,
  kickoffAt: { type: Date, index: true },
  home: { type: ObjectId, ref: 'Club', index: true },
  away: { type: ObjectId, ref: 'Club', index: true },
  status: { type: String, enum: ['scheduled', 'starting', 'live', 'finished', 'forfeit', 'void'], default: 'scheduled', index: true },
  ready: { h: { type: Boolean, default: false }, a: { type: Boolean, default: false } },
  autoReady: { h: { type: Boolean, default: false }, a: { type: Boolean, default: false } },
  result: { h: Number, a: Number, forfeitBy: { type: ObjectId, default: null }, noShow: Boolean, forced: Boolean },
  setup: Schema.Types.Mixed,
  eventLog: [Schema.Types.Mixed],
  stats: Schema.Types.Mixed,
  goals: [Schema.Types.Mixed],
  cards: [Schema.Types.Mixed],
  endedAt: Date,
});
FixtureSchema.index({ season: 1, leagueTier: 1, gameweek: 1 });

const StandingSchema = new Schema({
  season: Number, leagueTier: Number, club: { type: ObjectId, ref: 'Club' },
  played: { type: Number, default: 0 }, won: { type: Number, default: 0 }, drawn: { type: Number, default: 0 }, lost: { type: Number, default: 0 },
  gf: { type: Number, default: 0 }, ga: { type: Number, default: 0 }, pts: { type: Number, default: 0 },
});
StandingSchema.index({ season: 1, leagueTier: 1, club: 1 }, { unique: true });

const SeasonSchema = new Schema({
  number: { type: Number, unique: true },
  startsAt: Date, endsAt: Date, breakUntil: Date,
  status: { type: String, enum: ['scheduled', 'active', 'archived'], default: 'scheduled' },
  archive: Schema.Types.Mixed,
});

const NotificationSchema = new Schema({
  user: { type: ObjectId, index: true }, type: String, title: String, body: String, link: String,
  dedupeKey: String, readAt: Date,
}, { timestamps: true });
NotificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true, sparse: true });

const PostSchema = new Schema({ user: ObjectId, author: String, clubName: String, text: String }, { timestamps: true });
const SettingSchema = new Schema({ key: { type: String, unique: true }, value: String });

export const User = model('User', UserSchema);
export const Club = model('Club', ClubSchema);
export const Player = model('Player', PlayerSchema);
export const Fixture = model('Fixture', FixtureSchema);
export const Standing = model('Standing', StandingSchema);
export const Season = model('Season', SeasonSchema);
export const Notification = model('Notification', NotificationSchema);
export const Post = model('Post', PostSchema);
export const Setting = model('Setting', SettingSchema);
