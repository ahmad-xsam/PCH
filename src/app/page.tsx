"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import {
  Trophy,
  Medal,
  Users,
  Activity,
  Calendar,
  GitMerge,
  MapPin,
  Clock,
  ZoomIn,
  ZoomOut,
  Maximize2,
  List,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Team {
  _id: string;
  name: string;
  logoUrl: string;
  drawNumber?: number;
  wins: number;
  losses: number;
  points: number;
}

interface Match {
  _id: string;
  teamA?: Team;
  teamB?: Team;
  scoreA: number | null;
  scoreB: number | null;
  status: "scheduled" | "ongoing" | "completed";
  round: number;
  matchNumber: number;
  position: number;
}

interface Config {
  tournamentType: "round-robin" | "single-elimination";
  tournamentName: string;
}

export default function StandingsPage() {
  const { data: teamsData, error: teamsError, isLoading: teamsLoading } = useSWR("/api/teams", fetcher, { refreshInterval: 5000 });
  const { data: matchesData, error: matchesError, isLoading: matchesLoading } = useSWR("/api/matches", fetcher, { refreshInterval: 5000 });
  const { data: configData } = useSWR("/api/config", fetcher, { refreshInterval: 10000 });

  // Home Page View Tab
  const [activeTab, setActiveTab] = useState<"leaderboard" | "schedule">("leaderboard");

  // Pan & Zoom state for public bracket viewer (if single elimination)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.85);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  if (teamsError || matchesError) {
    return <div className="text-red-500 p-4 text-center glass-panel rounded-xl">Failed to load live data</div>;
  }

  const teams: Team[] = teamsData?.data || [];
  const matches: Match[] = matchesData?.data || [];
  
  const config: Config = configData?.data || {
    tournamentType: "single-elimination",
    tournamentName: "PCH Cup Tournament"
  };

  const ongoingMatches = matches.filter((m) => m.status === "ongoing");
  const upcomingMatches = matches.filter((m) => m.status === "scheduled" && m.teamA && m.teamB).slice(0, 3);

  // Group matches by round
  const rounds: { [key: number]: Match[] } = {};
  matches.forEach((match: Match) => {
    if (!rounds[match.round]) rounds[match.round] = [];
    rounds[match.round].push(match);
  });
  const roundKeys = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const totalRounds = roundKeys.length;

  // Handle Dragging for Bracket View
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".match-card") || (e.target as HTMLElement).closest(".btn-control")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const zoomIn = () => setScale((s) => Math.min(s + 0.1, 1.5));
  const zoomOut = () => setScale((s) => Math.max(s - 0.1, 0.4));
  const resetZoom = () => {
    setScale(0.85);
    setPan({ x: 0, y: 0 });
  };

  // Render SVG initials placeholder
  const renderLogoPlaceholder = (name: string, size = "w-8 h-8 text-[10px]") => {
    const initials = name ? name.substring(0, 2).toUpperCase() : "VS";
    return (
      <div className={`${size} rounded-full bg-slate-700 flex items-center justify-center font-bold text-white border border-slate-600 shrink-0`}>
        {initials}
      </div>
    );
  };

  // Render Bracket Match Card (Public View, Read Only)
  const renderBracketMatchCard = (match: Match, side: "left" | "right" | "center") => {
    const isWinnerA = match.status === "completed" && match.scoreA !== null && match.scoreB !== null && match.scoreA > match.scoreB;
    const isWinnerB = match.status === "completed" && match.scoreA !== null && match.scoreB !== null && match.scoreB > match.scoreA;
    const hasTeamA = !!match.teamA;
    const hasTeamB = !!match.teamB;
    const isTopBranch = match.position % 2 !== 0;

    return (
      <div key={match._id} className="relative py-6 flex flex-col justify-center items-center">
        {side !== "center" && (
          <>
            {side === "left" ? (
              <div
                className={`absolute w-8 right-[-32px] border-r-2 border-slate-700
                  ${isTopBranch ? "top-[50%] h-[50%] border-t-2 rounded-tr-xl" : "bottom-[50%] h-[50%] border-b-2 rounded-br-xl"}
                `}
              />
            ) : (
              <div
                className={`absolute w-8 left-[-32px] border-l-2 border-slate-700
                  ${isTopBranch ? "top-[50%] h-[50%] border-t-2 rounded-tl-xl" : "bottom-[50%] h-[50%] border-b-2 rounded-bl-xl"}
                `}
              />
            )}
          </>
        )}

        <div
          className={`match-card w-64 bg-slate-900/90 border transition-all duration-300 rounded-2xl overflow-hidden shadow-xl ${
            match.status === "ongoing"
              ? "border-amber-500/50 shadow-amber-550/15 animate-pulse-glow"
              : "border-slate-800/80"
          }`}
        >
          <div className="bg-slate-950/75 px-3 py-1.5 text-[9px] text-slate-450 font-bold flex justify-between border-b border-slate-800/60">
            <span>MATCH #{match.matchNumber}</span>
            <span
              className={`uppercase tracking-widest font-black ${
                match.status === "completed"
                  ? "text-emerald-450"
                  : match.status === "ongoing"
                  ? "text-amber-450"
                  : "text-slate-550"
              }`}
            >
              {match.status}
            </span>
          </div>

          <div className="flex flex-col">
            {/* Team A */}
            <div
              className={`flex justify-between items-center px-3 py-2.5 border-b border-slate-850/60 transition-colors ${
                isWinnerA ? "bg-blue-500/5" : ""
              } ${!hasTeamA ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-2 truncate pr-2">
                {match.teamA ? (
                  <>
                    {match.teamA.logoUrl ? (
                      <img src={match.teamA.logoUrl} alt={match.teamA.name} className="w-6 h-6 rounded-full object-cover border border-slate-750" />
                    ) : (
                      renderLogoPlaceholder(match.teamA.name, "w-6 h-6 text-[8px]")
                    )}
                    <span className={`text-xs truncate font-semibold ${isWinnerA ? "text-white font-black" : "text-slate-350"}`}>
                      {match.teamA.name}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-full bg-slate-850 border border-dashed border-slate-700 flex items-center justify-center text-slate-650 font-bold text-[8px]">BYE</div>
                    <span className="text-xs text-slate-550 font-semibold italic">Bye/TBD</span>
                  </>
                )}
              </div>
              <span className={`text-xs font-bold font-mono ${isWinnerA ? "text-blue-400" : "text-slate-550"}`}>
                {match.scoreA !== null ? match.scoreA : "-"}
              </span>
            </div>

            {/* Team B */}
            <div
              className={`flex justify-between items-center px-3 py-2.5 transition-colors ${
                isWinnerB ? "bg-blue-500/5" : ""
              } ${!hasTeamB ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-2 truncate pr-2">
                {match.teamB ? (
                  <>
                    {match.teamB.logoUrl ? (
                      <img src={match.teamB.logoUrl} alt={match.teamB.name} className="w-6 h-6 rounded-full object-cover border border-slate-750" />
                    ) : (
                      renderLogoPlaceholder(match.teamB.name, "w-6 h-6 text-[8px]")
                    )}
                    <span className={`text-xs truncate font-semibold ${isWinnerB ? "text-white font-black" : "text-slate-350"}`}>
                      {match.teamB.name}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-full bg-slate-850 border border-dashed border-slate-700 flex items-center justify-center text-slate-650 font-bold text-[8px]">BYE</div>
                    <span className="text-xs text-slate-550 font-semibold italic">Bye/TBD</span>
                  </>
                )}
              </div>
              <span className={`text-xs font-bold font-mono ${isWinnerB ? "text-blue-400" : "text-slate-550"}`}>
                {match.scoreB !== null ? match.scoreB : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 h-full flex flex-col">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-2 shrink-0">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            {config.tournamentName} <span className="text-gradient">Arena</span>
          </h1>
          <p className="mt-2 text-slate-400 text-sm">
            Live tournament standings and dynamic match schedule generated in format:{" "}
            <span className="text-blue-400 font-bold capitalize">{config.tournamentType.replace("-", " ")}</span>
          </p>
        </div>

        {/* Tab switch navigation */}
        <div className="flex border-b border-slate-800/60 w-fit gap-1 bg-slate-900/60 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "leaderboard" ? "bg-blue-650 text-white shadow-lg shadow-blue-500/10" : "text-slate-400 hover:text-slate-205"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Leaderboard</span>
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "schedule" ? "bg-blue-650 text-white shadow-lg shadow-blue-500/10" : "text-slate-400 hover:text-slate-205"
            }`}
          >
            {config.tournamentType === "round-robin" ? <List className="w-3.5 h-3.5" /> : <GitMerge className="w-3.5 h-3.5" />}
            <span>{config.tournamentType === "round-robin" ? "Schedule & Results" : "Tournament Bracket"}</span>
          </button>
        </div>
      </div>

      {/* REAL-TIME MATCH TICKER SECTION */}
      {ongoingMatches.length > 0 && (
        <div className="space-y-4 px-2 shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2 text-red-400">
            <Activity className="w-5 h-5 text-red-550 animate-pulse" /> Live Matches Now
          </h2>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ongoingMatches.map((match) => (
              <div 
                key={match._id} 
                className="relative overflow-hidden rounded-2xl border border-red-500/35 bg-red-950/10 p-5 shadow-lg animate-pulse-glow"
              >
                <div className="flex justify-between items-center text-[10px] font-semibold text-slate-450 border-b border-red-950/40 pb-2 mb-3">
                  <span>Match #{match.matchNumber} (Round {match.round})</span>
                  <span className="flex items-center gap-1 bg-red-500/10 text-red-450 px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold text-[9px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                    Live
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 flex flex-col items-center text-center">
                    {match.teamA?.logoUrl ? (
                      <img src={match.teamA.logoUrl} alt={match.teamA.name} className="w-12 h-12 rounded-full object-cover border border-slate-700" />
                    ) : (
                      renderLogoPlaceholder(match.teamA?.name || "TBD", "w-12 h-12 text-sm")
                    )}
                    <span className="mt-2 text-xs font-bold text-slate-100 truncate w-full">{match.teamA?.name || "TBD"}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black font-mono text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
                      {match.scoreA !== null ? match.scoreA : 0}
                    </span>
                    <span className="text-slate-500 font-bold">:</span>
                    <span className="text-3xl font-black font-mono text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
                      {match.scoreB !== null ? match.scoreB : 0}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col items-center text-center">
                    {match.teamB?.logoUrl ? (
                      <img src={match.teamB.logoUrl} alt={match.teamB.name} className="w-12 h-12 rounded-full object-cover border border-slate-700" />
                    ) : (
                      renderLogoPlaceholder(match.teamB?.name || "TBD", "w-12 h-12 text-sm")
                    )}
                    <span className="mt-2 text-xs font-bold text-slate-100 truncate w-full">{match.teamB?.name || "TBD"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- MAIN TAB BODY --- */}
      <div className="flex-1 overflow-hidden min-h-[400px] flex flex-col">
        
        {/* TAB 1: LEADERBOARD STANDINGS */}
        {activeTab === "leaderboard" && (
          <div className="space-y-4 px-2 flex-1 overflow-y-auto pr-1">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-450" /> Live Standings
            </h2>

            <div className="glass-panel overflow-hidden rounded-2xl border border-slate-700/50 shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-800/60 text-xs uppercase text-slate-400 border-b border-slate-700/50">
                    <tr>
                      <th scope="col" className="px-6 py-4 font-semibold w-16 text-center">Pos</th>
                      <th scope="col" className="px-6 py-4 font-semibold">Team</th>
                      <th scope="col" className="px-6 py-4 font-semibold text-center w-24">Draw #</th>
                      <th scope="col" className="px-6 py-4 font-semibold text-center w-24">W</th>
                      <th scope="col" className="px-6 py-4 font-semibold text-center w-24">L</th>
                      <th scope="col" className="px-6 py-4 font-semibold text-center w-24">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {teamsLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="animate-pulse bg-slate-800/10">
                          <td className="px-6 py-5"><div className="mx-auto h-4 w-4 rounded bg-slate-800"></div></td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-slate-800"></div>
                              <div className="h-4 w-32 rounded bg-slate-800"></div>
                            </div>
                          </td>
                          <td className="px-6 py-5"><div className="mx-auto h-4 w-8 rounded bg-slate-800"></div></td>
                          <td className="px-6 py-5"><div className="mx-auto h-4 w-8 rounded bg-slate-800"></div></td>
                          <td className="px-6 py-5"><div className="mx-auto h-4 w-8 rounded bg-slate-800"></div></td>
                          <td className="px-6 py-5"><div className="mx-auto h-4 w-8 rounded bg-slate-800"></div></td>
                        </tr>
                      ))
                    ) : teams.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                          <Users className="mx-auto h-12 w-12 text-slate-750 mb-3" />
                          No teams registered yet.
                        </td>
                      </tr>
                    ) : (
                      teams.map((team: Team, index: number) => (
                        <tr key={team._id} className="group transition-colors hover:bg-slate-800/30">
                          <td className="px-6 py-4 text-center font-bold">
                            {index === 0 ? (
                              <div className="flex justify-center"><Medal className="h-6 w-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" /></div>
                            ) : index === 1 ? (
                              <div className="flex justify-center"><Medal className="h-6 w-6 text-slate-350" /></div>
                            ) : index === 2 ? (
                              <div className="flex justify-center"><Medal className="h-6 w-6 text-amber-600" /></div>
                            ) : (
                              <span className="font-semibold text-slate-550 font-mono">{index + 1}</span>
                            )}
                          </td>

                          <td className="px-6 py-4 font-semibold text-white group-hover:text-blue-450 transition-colors">
                            <div className="flex items-center gap-3">
                              {team.logoUrl ? (
                                <img src={team.logoUrl} alt={team.name} className="w-8 h-8 rounded-full object-cover border border-slate-700" />
                              ) : (
                                renderLogoPlaceholder(team.name)
                              )}
                              <span className="truncate max-w-[180px] md:max-w-none">{team.name}</span>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-center text-slate-400 font-mono font-bold text-xs">
                            {team.drawNumber || '-'}
                          </td>

                          <td className="px-6 py-4 text-center font-bold font-mono text-emerald-400">{team.wins}</td>
                          <td className="px-6 py-4 text-center font-bold font-mono text-red-400">{team.losses}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center justify-center rounded-full bg-blue-500/10 px-3 py-1 font-extrabold text-blue-405 ring-1 ring-blue-500/20 text-xs font-mono shadow-sm">
                              {team.points}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ROUND ROBIN SCHEDULE */}
        {activeTab === "schedule" && config.tournamentType === "round-robin" && (
          <div className="space-y-6 px-2 flex-1 overflow-y-auto pr-1">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-450" /> Round Robin Match Schedule
            </h2>

            {matches.length === 0 ? (
              <div className="glass-panel p-16 text-center text-slate-550 border border-slate-800 rounded-2xl">
                <Calendar className="mx-auto h-12 w-12 text-slate-850 mb-3" />
                No match schedule generated. Please generate the schedule from the Admin Panel.
              </div>
            ) : (
              <div className="space-y-8 pb-8">
                {roundKeys.map((roundNum) => {
                  const roundMatches = rounds[roundNum] || [];

                  return (
                    <div key={`round-${roundNum}`} className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
                        <span className="bg-blue-650 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full">
                          Round {roundNum}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">({roundMatches.length} Matches)</span>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {roundMatches.map((match) => {
                          const isWinnerA = match.status === "completed" && match.scoreA !== null && match.scoreB !== null && match.scoreA > match.scoreB;
                          const isWinnerB = match.status === "completed" && match.scoreA !== null && match.scoreB !== null && match.scoreB > match.scoreA;

                          return (
                            <div
                              key={match._id}
                              className={`glass-panel p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                                match.status === "ongoing"
                                  ? "border-amber-500/50 bg-amber-950/5 shadow-amber-550/5 animate-pulse-glow"
                                  : "border-slate-800/60 bg-slate-900/10 hover:border-slate-700/50"
                              }`}
                            >
                              <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold border-b border-slate-850/50 pb-2 mb-3">
                                <span>MATCH #{match.matchNumber}</span>
                                <span
                                  className={`uppercase px-2 py-0.5 rounded tracking-widest font-black ${
                                    match.status === "completed"
                                      ? "text-emerald-450 bg-emerald-500/5"
                                      : match.status === "ongoing"
                                      ? "text-amber-450 bg-amber-500/5"
                                      : "text-slate-500 bg-slate-800"
                                  }`}
                                >
                                  {match.status}
                                </span>
                              </div>

                              <div className="space-y-2">
                                {/* Team A */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 truncate pr-2">
                                    {match.teamA?.logoUrl ? (
                                      <img src={match.teamA.logoUrl} alt={match.teamA.name} className="w-6 h-6 rounded-full object-cover border border-slate-750" />
                                    ) : (
                                      renderLogoPlaceholder(match.teamA?.name || "TBD", "w-6 h-6 text-[8px]")
                                    )}
                                    <span className={`text-xs truncate font-semibold ${isWinnerA ? "text-white font-black" : "text-slate-350"}`}>
                                      {match.teamA?.name}
                                    </span>
                                  </div>
                                  <span className={`text-xs font-mono font-bold ${isWinnerA ? "text-blue-450" : "text-slate-550"}`}>
                                    {match.scoreA !== null ? match.scoreA : "-"}
                                  </span>
                                </div>

                                {/* Team B */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 truncate pr-2">
                                    {match.teamB?.logoUrl ? (
                                      <img src={match.teamB.logoUrl} alt={match.teamB.name} className="w-6 h-6 rounded-full object-cover border border-slate-750" />
                                    ) : (
                                      renderLogoPlaceholder(match.teamB?.name || "TBD", "w-6 h-6 text-[8px]")
                                    )}
                                    <span className={`text-xs truncate font-semibold ${isWinnerB ? "text-white font-black" : "text-slate-350"}`}>
                                      {match.teamB?.name}
                                    </span>
                                  </div>
                                  <span className={`text-xs font-mono font-bold ${isWinnerB ? "text-blue-450" : "text-slate-550"}`}>
                                    {match.scoreB !== null ? match.scoreB : "-"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SINGLE ELIMINATION BRACKET */}
        {activeTab === "schedule" && config.tournamentType === "single-elimination" && (
          <div className="flex-1 flex flex-col overflow-hidden relative min-h-[500px]">
            {/* Toolbar */}
            <div className="absolute top-2 right-4 z-10 flex gap-1 bg-slate-800/80 border border-slate-700/50 p-1 rounded-xl shadow-lg shrink-0">
              <button onClick={zoomIn} className="btn-control p-2 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"><ZoomIn className="w-4 h-4" /></button>
              <button onClick={zoomOut} className="btn-control p-2 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"><ZoomOut className="w-4 h-4" /></button>
              <button onClick={resetZoom} className="btn-control p-2 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold px-3"><Maximize2 className="w-3.5 h-3.5" /><span>Fit</span></button>
            </div>

            {/* Canvas */}
            <div
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`flex-1 relative overflow-hidden bg-slate-950/80 border border-slate-800/85 rounded-2xl shadow-inner cursor-grab ${
                isDragging ? "cursor-grabbing" : ""
              }`}
              style={{
                backgroundImage: `radial-gradient(rgba(100, 116, 139, 0.1) 1.5px, transparent 1.5px)`,
                backgroundSize: "24px 24px",
              }}
            >
              {matches.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-550">
                  <GitMerge className="h-12 w-12 text-slate-800 mb-2" />
                  <span className="text-xs">No bracket created. Please generate the bracket from the Admin Panel.</span>
                </div>
              ) : (
                <div
                  className="absolute origin-center transition-transform duration-75"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                    left: "50%",
                    top: "50%",
                    marginLeft: `-${(totalRounds * 2 + 1) * 150}px`,
                    marginTop: "-300px",
                    width: `${(totalRounds * 2 + 1) * 300}px`,
                    height: "600px",
                  }}
                >
                  <div className="flex h-full items-stretch justify-center relative select-none">
                    {/* Left Wing */}
                    {Array.from({ length: totalRounds - 1 }).map((_, i) => {
                      const roundIndex = i + 1;
                      const matchesInRound = rounds[roundIndex] || [];
                      const leftMatches = matchesInRound
                        .filter((m) => m.position <= matchesInRound.length / 2)
                        .sort((a, b) => a.position - b.position);

                      return (
                        <div key={`left-round-${roundIndex}`} className="flex flex-col justify-around w-72 relative py-8 px-4">
                          <div className="absolute top-2 left-0 right-0 text-center font-black text-slate-400 uppercase tracking-widest text-[9px]">Round {roundIndex}</div>
                          {leftMatches.map((m) => renderBracketMatchCard(m, "left"))}
                        </div>
                      );
                    })}

                    {/* Center Final */}
                    <div className="flex flex-col justify-center items-center w-80 relative py-8 px-4 border-x border-slate-900/40 bg-slate-950/20">
                      <div className="absolute top-2 left-0 right-0 text-center font-black text-gradient uppercase tracking-widest text-[10px] flex items-center justify-center gap-1">
                        <Trophy className="w-3.5 h-3.5 text-yellow-500" /> Grand Final
                      </div>
                      {rounds[totalRounds]?.map((m) => renderBracketMatchCard(m, "center"))}
                    </div>

                    {/* Right Wing (Reversed) */}
                    {Array.from({ length: totalRounds - 1 })
                      .map((_, i) => totalRounds - 1 - i)
                      .map((roundIndex) => {
                        const matchesInRound = rounds[roundIndex] || [];
                        const rightMatches = matchesInRound
                          .filter((m) => m.position > matchesInRound.length / 2)
                          .sort((a, b) => a.position - b.position);

                        return (
                          <div key={`right-round-${roundIndex}`} className="flex flex-col justify-around w-72 relative py-8 px-4">
                            <div className="absolute top-2 left-0 right-0 text-center font-black text-slate-400 uppercase tracking-widest text-[9px]">Round {roundIndex}</div>
                            {rightMatches.map((m) => renderBracketMatchCard(m, "right"))}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
