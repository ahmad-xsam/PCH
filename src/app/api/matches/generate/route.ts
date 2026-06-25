import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Match from '@/models/Match';
import Team from '@/models/Team';

export async function POST() {
  try {
    await dbConnect();
    
    // Clear existing matches
    await Match.deleteMany({});
    
    const teams = await Team.find({}).sort({ drawNumber: 1 });
    if (teams.length < 2) {
      return NextResponse.json({ success: false, error: 'At least 2 teams are required to generate a bracket' }, { status: 400 });
    }

    // Find next power of 2
    const numTeams = teams.length;
    let powerOf2 = 2;
    while (powerOf2 < numTeams) {
      powerOf2 *= 2;
    }

    const totalRounds = Math.log2(powerOf2);
    
    // Create matches layer by layer, from Final (root) to Round 1 (leaves)
    // We will store them in a 2D array: matches[roundIndex][positionIndex]
    const bracket: any[][] = [];
    
    let matchCounter = 1;
    
    // Generate empty structure
    for (let r = 1; r <= totalRounds; r++) {
      const matchesInRound = Math.pow(2, totalRounds - r);
      const roundMatches = [];
      for (let pos = 1; pos <= matchesInRound; pos++) {
        // We just prepare objects
        roundMatches.push({
          round: r,
          position: pos,
          matchNumber: 0, // will assign later
          teamA: null,
          teamB: null,
          nextMatchId: null,
          status: 'scheduled'
        });
      }
      bracket.push(roundMatches);
    }
    
    // Assign match numbers sequentially across the tournament (e.g. 1 to N)
    for (let r = 0; r < bracket.length; r++) {
      for (let m = 0; m < bracket[r].length; m++) {
        bracket[r][m].matchNumber = matchCounter++;
      }
    }

    // Now insert them into DB to get ObjectIds.
    // We insert from Final down to Round 1 so we can get nextMatchId for the earlier rounds.
    // bracket array is 0-indexed: 0 is Round 1, bracket.length-1 is Final.
    
    for (let r = bracket.length - 1; r >= 0; r--) {
      for (let m = 0; m < bracket[r].length; m++) {
        const matchData = bracket[r][m];
        
        // Link to next match if not final
        if (r < bracket.length - 1) {
          const nextMatchPos = Math.floor(m / 2);
          const nextMatch = bracket[r+1][nextMatchPos];
          matchData.nextMatchId = nextMatch._id;
        }

        // Create in DB
        const createdMatch = await Match.create(matchData);
        bracket[r][m]._id = createdMatch._id; // save ID for parent references
      }
    }

    // Now populate Round 1 with teams
    // Pad teams with nulls to reach powerOf2
    const paddedTeams = [...teams];
    while(paddedTeams.length < powerOf2) {
      paddedTeams.push(null);
    }

    // Distribute teams into Round 1 (bracket[0])
    let teamIndex = 0;
    for (let m = 0; m < bracket[0].length; m++) {
      const matchDoc = await Match.findById(bracket[0][m]._id);
      if (matchDoc) {
        matchDoc.teamA = paddedTeams[teamIndex++]?._id || null;
        matchDoc.teamB = paddedTeams[teamIndex++]?._id || null;
        
        // Auto-advance if someone gets a "bye" (null team opponent)
        if (matchDoc.teamA && !matchDoc.teamB) {
            matchDoc.scoreA = 1;
            matchDoc.scoreB = 0;
            matchDoc.status = 'completed';
            // Simple logic to advance if bye
            if (matchDoc.nextMatchId) {
                const nextMatch = await Match.findById(matchDoc.nextMatchId);
                if (m % 2 === 0) nextMatch.teamA = matchDoc.teamA;
                else nextMatch.teamB = matchDoc.teamA;
                await nextMatch.save();
            }
        } else if (!matchDoc.teamA && matchDoc.teamB) {
            matchDoc.scoreA = 0;
            matchDoc.scoreB = 1;
            matchDoc.status = 'completed';
            if (matchDoc.nextMatchId) {
                const nextMatch = await Match.findById(matchDoc.nextMatchId);
                if (m % 2 === 0) nextMatch.teamA = matchDoc.teamB;
                else nextMatch.teamB = matchDoc.teamB;
                await nextMatch.save();
            }
        }
        await matchDoc.save();
      }
    }

    return NextResponse.json({ success: true, message: 'Bracket generated successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
