"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { GitMerge, Trophy, ZoomIn, ZoomOut, Maximize2, X, Play, Award, CheckCircle, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Team {
  _id: string;
  name: string;
  logoUrl: string;
  drawNumber?: number;
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

export default function BracketPage() {
  const { data: matchesData, mutate: mutateMatches, isLoading: matchesLoading } = useSWR("/api/matches", fetcher);
  const { data: teamsData, mutate: mutateTeams } = useSWR("/api/teams", fetcher);
  const { data: configData } = useSWR("/api/config", fetcher);

  // Pan & Zoom state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.85);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Modal Editor state
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [selectedTeamA, setSelectedTeamA] = useState("");
  const [selectedTeamB, setSelectedTeamB] = useState("");
  const [scoreA, setScoreA] = useState<string>("");
  const [scoreB, setScoreB] = useState<string>("");
  const [matchStatus, setMatchStatus] = useState<"scheduled" | "ongoing" | "completed">("scheduled");
  const [isSaving, setIsSaving] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  const teams: Team[] = teamsData?.data || [];
  const matches: Match[] = matchesData?.data || [];
  const config = configData?.data || { tournamentType: "single-elimination", tournamentName: "PCH Cup Tournament" };

  // Group matches by round
  const rounds: { [key: number]: Match[] } = {};
  matches.forEach((match: Match) => {
    if (!rounds[match.round]) rounds[match.round] = [];
    rounds[match.round].push(match);
  });

  const roundKeys = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const totalRounds = roundKeys.length;

  // Handle Dragging
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

  // Zoom controls
  const zoomIn = () => setScale((s) => Math.min(s + 0.1, 1.5));
  const zoomOut = () => setScale((s) => Math.max(s - 0.1, 0.4));
  const resetZoom = () => {
    setScale(0.85);
    setPan({ x: 0, y: 0 });
  };

  // Open Edit Modal
  const openEditor = (match: Match) => {
    setEditingMatch(match);
    setSelectedTeamA(match.teamA?._id || "");
    setSelectedTeamB(match.teamB?._id || "");
    setScoreA(match.scoreA !== null ? match.scoreA.toString() : "");
    setScoreB(match.scoreB !== null ? match.scoreB.toString() : "");
    setMatchStatus(match.status);
  };

  const handleSaveMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMatch) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/matches/${editingMatch._id}`, {
        method: "PUT",
        body: JSON.stringify({
          teamA: selectedTeamA || null,
          teamB: selectedTeamB || null,
          scoreA: scoreA === "" ? null : parseInt(scoreA),
          scoreB: scoreB === "" ? null : parseInt(scoreB),
          status: matchStatus,
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        setEditingMatch(null);
        mutateMatches();
        mutateTeams();
      } else {
        alert("Failed to update match.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderLogoPlaceholder = (name: string, size = "w-6 h-6 text-[8px]") => {
    const initials = name ? name.substring(0, 2).toUpperCase() : "VS";
    return (
      <div className={`${size} rounded-full bg-slate-700 flex items-center justify-center font-bold text-white border border-slate-600 shrink-0`}>
        {initials}
      </div>
    );
  };

  const renderMatchCard = (match: Match, side: "left" | "right" | "center") => {
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
          onClick={() => openEditor(match)}
          className={`match-card w-64 bg-slate-900/90 hover:bg-slate-800/80 hover:scale-[1.02] border transition-all duration-300 rounded-2xl overflow-hidden shadow-xl cursor-pointer ${
            match.status === "ongoing"
              ? "border-amber-500/50 shadow-amber-550/15 animate-pulse-glow"
              : match.status === "completed"
              ? "border-slate-800"
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
                  : "text-slate-500"
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
                      renderLogoPlaceholder(match.teamA.name)
                    )}
                    <span className={`text-xs truncate font-semibold ${isWinnerA ? "text-white font-black" : "text-slate-350"}`}>
                      {match.teamA.name}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-full bg-slate-850 border border-dashed border-slate-750 flex items-center justify-center text-slate-650 font-bold text-[8px]">BYE</div>
                    <span className="text-xs text-slate-550 font-semibold italic">Bye / Pending</span>
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
                      renderLogoPlaceholder(match.teamB.name)
                    )}
                    <span className={`text-xs truncate font-semibold ${isWinnerB ? "text-white font-black" : "text-slate-350"}`}>
                      {match.teamB.name}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-full bg-slate-850 border border-dashed border-slate-750 flex items-center justify-center text-slate-650 font-bold text-[8px]">BYE</div>
                    <span className="text-xs text-slate-550 font-semibold italic">Bye / Pending</span>
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

  // Render notice if configuration is Round Robin
  if (config.tournamentType === "round-robin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 max-w-xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center text-blue-400 shadow-lg shadow-blue-500/5">
          <Calendar className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-white">Round Robin League Format</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            This tournament is currently configured as a <strong>Round Robin League</strong>. In this format, matches are structured in rounds rather than a bracket tree.
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 bg-blue-650 text-white font-extrabold px-6 py-3 rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/10 text-sm"
        >
          <span>View Matches & Standings</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col overflow-hidden animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex justify-between items-center px-2 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-2.5">
            <GitMerge className="w-7 h-7 text-blue-450" /> Interactive Bracket Board
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Drag to pan, scroll to zoom. Click matches to enter scores and manage details.
          </p>
        </div>
        <div className="flex gap-1 bg-slate-800/80 border border-slate-700/50 p-1 rounded-xl shadow-lg">
          <button onClick={zoomIn} className="btn-control p-2 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={zoomOut} className="btn-control p-2 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"><ZoomOut className="w-4 h-4" /></button>
          <button onClick={resetZoom} className="btn-control p-2 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold px-3"><Maximize2 className="w-3.5 h-3.5" /><span>Fit</span></button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex-1 relative overflow-hidden bg-slate-950/80 border border-slate-800/85 rounded-3xl shadow-inner min-h-[500px] cursor-grab ${
          isDragging ? "cursor-grabbing" : ""
        }`}
        style={{
          backgroundImage: `radial-gradient(rgba(100, 116, 139, 0.15) 1.5px, transparent 1.5px)`,
          backgroundSize: "24px 24px",
        }}
      >
        {matches.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-550">
            <GitMerge className="h-16 w-16 text-slate-800 mb-2" />
            <span className="text-xs">No bracket created. Please generate from the Admin Panel.</span>
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
                    <div className="absolute top-2 left-0 right-0 text-center font-black text-slate-500 uppercase tracking-widest text-[9px]">Round {roundIndex}</div>
                    {leftMatches.map((m) => renderMatchCard(m, "left"))}
                  </div>
                );
              })}

              {/* Center Final */}
              <div className="flex flex-col justify-center items-center w-80 relative py-8 px-4 border-x border-slate-900/40 bg-slate-950/20">
                <div className="absolute top-2 left-0 right-0 text-center font-black text-gradient uppercase tracking-widest text-[10px] flex items-center justify-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-yellow-500" /> Grand Final
                </div>
                {rounds[totalRounds]?.map((m) => renderMatchCard(m, "center"))}
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
                      <div className="absolute top-2 left-0 right-0 text-center font-black text-slate-500 uppercase tracking-widest text-[9px]">Round {roundIndex}</div>
                      {rightMatches.map((m) => renderMatchCard(m, "right"))}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* --- INLINE EDIT MODAL --- */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-950/60 px-6 py-4 flex justify-between items-center border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-white text-md">Edit Match #{editingMatch.matchNumber}</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Round {editingMatch.round} • Position {editingMatch.position}</p>
              </div>
              <button onClick={() => setEditingMatch(null)} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMatch} className="p-6 space-y-5">
              {/* Teams & Scores Editor */}
              <div className="space-y-4">
                {/* Team A Selection & Score */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Team A (Top)</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedTeamA}
                      onChange={(e) => setSelectedTeamA(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Bye / TBD --</option>
                      {teams.map((t) => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Score"
                      value={scoreA}
                      onChange={(e) => setScoreA(e.target.value)}
                      className="w-20 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-center text-xs font-bold font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Team B Selection & Score */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Team B (Bottom)</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedTeamB}
                      onChange={(e) => setSelectedTeamB(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Bye / TBD --</option>
                      {teams.map((t) => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Score"
                      value={scoreB}
                      onChange={(e) => setScoreB(e.target.value)}
                      className="w-20 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-center text-xs font-bold font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Match Status</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 border border-slate-800 rounded-xl">
                  {(["scheduled", "ongoing", "completed"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setMatchStatus(status)}
                      className={`py-1.5 text-[10px] font-bold uppercase rounded-lg tracking-wider transition-all ${
                        matchStatus === status
                          ? status === "completed"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                            : status === "ongoing"
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                            : "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMatch(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-extrabold py-2.5 rounded-xl transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-blue-650 hover:bg-blue-600 text-white font-extrabold py-2.5 rounded-xl transition-all disabled:opacity-50 text-xs shadow-lg shadow-blue-500/10"
                >
                  {isSaving ? "Saving..." : "Save Match"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
