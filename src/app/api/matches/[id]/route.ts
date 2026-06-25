import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Match from '@/models/Match';
import Team from '@/models/Team';

export const dynamic = 'force-dynamic';

async function recalculateTeamStats() {
  // 1. Reset all teams to 0
  await Team.updateMany({}, { wins: 0, losses: 0, points: 0 });

  // 2. Fetch all completed matches
  const completedMatches = await Match.find({ status: 'completed' });

  // 3. Update stats for each completed match
  for (const match of completedMatches) {
    if (match.teamA && match.teamB) {
      if (match.scoreA !== null && match.scoreB !== null) {
        if (match.scoreA > match.scoreB) {
          await Team.findByIdAndUpdate(match.teamA, { $inc: { wins: 1, points: 3 } });
          await Team.findByIdAndUpdate(match.teamB, { $inc: { losses: 1 } });
        } else if (match.scoreB > match.scoreA) {
          await Team.findByIdAndUpdate(match.teamB, { $inc: { wins: 1, points: 3 } });
          await Team.findByIdAndUpdate(match.teamA, { $inc: { losses: 1 } });
        }
      }
    }
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const id = (await params).id;
    const body = await request.json();
    
    const match = await Match.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!match) return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 });

    let winnerId = null;
    if (match.status === 'completed') {
      if (match.teamA && match.teamB && match.scoreA !== null && match.scoreB !== null) {
        if (match.scoreA > match.scoreB) {
          winnerId = match.teamA.toString();
        } else if (match.scoreB > match.scoreA) {
          winnerId = match.teamB.toString();
        }
      } else if (match.teamA && !match.teamB) {
        winnerId = match.teamA.toString();
      } else if (match.teamB && !match.teamA) {
        winnerId = match.teamB.toString();
      }

      // Advance winner to next match if single elimination
      if (winnerId && match.nextMatchId) {
        const nextMatch = await Match.findById(match.nextMatchId);
        if (nextMatch) {
          const isTopBranch = match.position % 2 !== 0;
          if (isTopBranch) {
            nextMatch.teamA = winnerId;
          } else {
            nextMatch.teamB = winnerId;
          }
          await nextMatch.save();
        }
      }
    }

    // Recalculate stats globally for all teams to keep everything in sync
    await recalculateTeamStats();

    return NextResponse.json({ success: true, data: match });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const id = (await params).id;
    const deletedMatch = await Match.findByIdAndDelete(id);
    if (!deletedMatch) return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 });
    
    await recalculateTeamStats();
    return NextResponse.json({ success: true, data: {} });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
