import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Match from '@/models/Match';
import Team from '@/models/Team';
import Config from '@/models/Config';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await dbConnect();
    
    // Clear existing matches
    await Match.deleteMany({});
    
    // Reset team match stats
    await Team.updateMany({}, { wins: 0, losses: 0, points: 0 });

    // Fetch tournament configuration
    const configDoc = await Config.findOne({ key: 'tournamentType' });
    const tournamentType = configDoc ? configDoc.value : 'single-elimination';

    const teams = await Team.find({}).sort({ name: 1 });
    if (teams.length < 2) {
      return NextResponse.json(
        { success: false, error: 'At least 2 teams are required to generate schedules' },
        { status: 400 }
      );
    }

    // --- ROUND ROBIN GENERATION ---
    if (tournamentType === 'round-robin') {
      const list = [...teams];
      const isOdd = list.length % 2 !== 0;
      if (isOdd) {
        // We push a dummy null to represent a bye
        list.push(null as any);
      }
      
      const N = list.length;
      const roundsCount = N - 1;
      const matchesPerRound = N / 2;
      let matchCounter = 1;

      for (let r = 1; r <= roundsCount; r++) {
        for (let i = 0; i < matchesPerRound; i++) {
          const teamA = list[i];
          const teamB = list[N - 1 - i];

          // If it is not a bye match
          if (teamA && teamB) {
            await Match.create({
              round: r,
              position: i + 1,
              matchNumber: matchCounter++,
              teamA: teamA._id,
              teamB: teamB._id,
              scoreA: null,
              scoreB: null,
              status: 'scheduled',
              nextMatchId: null
            });
          }
        }
        // Rotate teams (Circle Method)
        // Shift last item to the second position
        const rotated = [list[0], list[N - 1], ...list.slice(1, N - 1)];
        for (let idx = 0; idx < N; idx++) {
          list[idx] = rotated[idx];
        }
      }

      return NextResponse.json({ success: true, message: 'Round Robin league schedule generated successfully!' });
    }

    // --- SINGLE ELIMINATION BRACKET GENERATION ---
    // Sort teams by drawNumber
    const bracketTeams = await Team.find({}).sort({ drawNumber: 1 });
    const missingDraw = bracketTeams.some(t => t.drawNumber === null || t.drawNumber === undefined);
    if (missingDraw) {
      return NextResponse.json(
        { success: false, error: 'Please perform the Random Draw in the Draw page before generating the bracket.' },
        { status: 400 }
      );
    }

    const numTeams = bracketTeams.length;
    
    // Find next power of 2 (P)
    let powerOf2 = 2;
    while (powerOf2 < numTeams) {
      powerOf2 *= 2;
    }

    const totalRounds = Math.log2(powerOf2);
    const bracket: any[][] = [];
    let matchCounter = 1;
    
    // 1. Generate empty bracket layers
    for (let r = 1; r <= totalRounds; r++) {
      const matchesInRound = Math.pow(2, totalRounds - r);
      const roundMatches = [];
      for (let pos = 1; pos <= matchesInRound; pos++) {
        roundMatches.push({
          round: r,
          position: pos,
          matchNumber: 0,
          teamA: null,
          teamB: null,
          scoreA: null,
          scoreB: null,
          nextMatchId: null,
          status: 'scheduled'
        });
      }
      bracket.push(roundMatches);
    }
    
    // 2. Assign match numbers sequentially
    for (let r = 0; r < bracket.length; r++) {
      for (let m = 0; m < bracket[r].length; m++) {
        bracket[r][m].matchNumber = matchCounter++;
      }
    }

    // 3. Save matches to DB from Final (root) to Round 1 (leaves)
    for (let r = bracket.length - 1; r >= 0; r--) {
      for (let m = 0; m < bracket[r].length; m++) {
        const matchData = bracket[r][m];
        if (r < bracket.length - 1) {
          const nextMatchPos = Math.floor(m / 2);
          const nextMatch = bracket[r + 1][nextMatchPos];
          matchData.nextMatchId = nextMatch._id;
        }

        const createdMatch = await Match.create(matchData);
        bracket[r][m]._id = createdMatch._id;
      }
    }

    // 4. Distribute Teams into Round 1
    const M = bracket[0].length;
    const B = powerOf2 - numTeams;

    const byeMatchIndices = new Set<number>();
    if (B > 0) {
      for (let i = 0; i < B; i++) {
        const index = Math.floor((i * M) / B);
        byeMatchIndices.add(index);
      }
    }

    let teamIndex = 0;
    for (let m = 0; m < M; m++) {
      const matchDoc = await Match.findById(bracket[0][m]._id);
      if (matchDoc) {
        const hasBye = byeMatchIndices.has(m);

        if (hasBye) {
          matchDoc.teamA = bracketTeams[teamIndex++]?._id || null;
          matchDoc.teamB = null;
          matchDoc.scoreA = 1;
          matchDoc.scoreB = 0;
          matchDoc.status = 'completed';
        } else {
          matchDoc.teamA = bracketTeams[teamIndex++]?._id || null;
          matchDoc.teamB = bracketTeams[teamIndex++]?._id || null;
          matchDoc.scoreA = null;
          matchDoc.scoreB = null;
          matchDoc.status = 'scheduled';
        }

        await matchDoc.save();

        if (matchDoc.status === 'completed' && matchDoc.teamA && matchDoc.nextMatchId) {
          const nextMatch = await Match.findById(matchDoc.nextMatchId);
          if (nextMatch) {
            if (m % 2 === 0) {
              nextMatch.teamA = matchDoc.teamA;
            } else {
              nextMatch.teamB = matchDoc.teamA;
            }
            await nextMatch.save();
          }
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Single Elimination knockout bracket generated successfully!' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
