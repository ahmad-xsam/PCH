import mongoose from 'mongoose';

const MatchSchema = new mongoose.Schema({
  teamA: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  teamB: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  scoreA: { type: Number, default: null },
  scoreB: { type: Number, default: null },
  status: { type: String, enum: ['scheduled', 'ongoing', 'completed'], default: 'scheduled' },
  round: { type: Number, default: 1 },
  matchNumber: { type: Number, required: true },
  position: { type: Number, default: 1 }, // Used for bracket ordering within a round
  nextMatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', default: null } // The match the winner advances to
}, { timestamps: true });

export default mongoose.models.Match || mongoose.model('Match', MatchSchema);
