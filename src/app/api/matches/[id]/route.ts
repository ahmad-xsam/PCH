import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Match from '@/models/Match';
import Team from '@/models/Team';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const id = (await params).id;
    const body = await request.json();
    const match = await Match.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    
    if (!match) return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 });

    // Logic to update team stats and advance winner to next match if completed
    if (match.status === 'completed') {
      const teamA = await Team.findById(match.teamA);
      const teamB = await Team.findById(match.teamB);
      
      let winnerId = null;

      if (teamA && teamB) {
        // Simple win detection based on score
        if (match.scoreA > match.scoreB) {
          winnerId = teamA._id;
          teamA.wins += 1;
          teamA.points += 3;
          teamB.losses += 1;
        } else if (match.scoreB > match.scoreA) {
          winnerId = teamB._id;
          teamB.wins += 1;
          teamB.points += 3;
          teamA.losses += 1;
        }
        await teamA.save();
        await teamB.save();
      } else if (teamA && !teamB) {
         // Walkover for Team A
         winnerId = teamA._id;
      } else if (teamB && !teamA) {
         // Walkover for Team B
         winnerId = teamB._id;
      }

      // Advance winner to next match
      if (winnerId && match.nextMatchId) {
        const nextMatch = await Match.findById(match.nextMatchId);
        if (nextMatch) {
          // If position is odd, winner goes to teamA. If even, winner goes to teamB.
          // Or we can check which slot is empty.
          if (!nextMatch.teamA || nextMatch.teamA.toString() === winnerId.toString() || (match.position % 2 !== 0)) {
             nextMatch.teamA = winnerId;
          } else {
             nextMatch.teamB = winnerId;
          }
          await nextMatch.save();
        }
      }
    }

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
    return NextResponse.json({ success: true, data: {} });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
