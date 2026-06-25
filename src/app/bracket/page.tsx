"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { GitMerge, Trophy, ZoomIn, ZoomOut, Maximize2, X, Play, Award, CheckCircle } from "lucide-react";

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

  // Render a Single Match Card
  const renderMatchCard = (match: Match, side: "left" | "right" | "center") => {
    const isWinnerA = match.status === "completed" && match.scoreA !== null && match.scoreB !== null && match.scoreA > match.scoreB;
    const isWinnerB = match.status === "completed" && match.scoreA !== null && match.scoreB !== null && match.scoreB > match.scoreA;

    const hasTeamA = !!match.teamA;
    const hasTeamB = !!match.teamB;

    // Check if it's the top or bottom branch of a pair (to draw connectors)
    const isTopBranch = match.position % 2 !== 0;

    return (
      <div key={match._id} className="relative py-6 flex flex-col justify-center items-center">
        {/* Connector Line out of the card (except for Grand Final in the center) */}
        {side !== "center" && (
          <>
            {side === "left" ? (
              // Left side flows Left-to-Right (connector goes right)
              <div
                className={`absolute w-8 right-[-32px] border-r-2 border-slate-700
                  ${isTopBranch ? "top-[50%] h-[50%] border-t-2 rounded-tr-xl" : "bottom-[50%] h-[50%] border-b-2 rounded-br-xl"}
                `}
              />
            ) : (
              // Right side flows Right-to-Left (connector goes left)
              <div
                className={`absolute w-8 left-[-32px] border-l-2 border-slate-700
                  ${isTopBranch ? "top-[50%] h-[50%] border-t-2 rounded-tl-xl" : "bottom-[50%] h-[50%] border-b-2 rounded-bl-xl"}
                `}
              />
            )}
          </>
        )}

        {/* Match Card Container */}
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
          {/* Header */}
          <div className="bg-slate-950/75 px-3 py-1.5 text-[9px] text-slate-450 font-bold flex justify-between border-b border-slate-800/60">
            <span>MATCH #{match.matchNumber}</span>
            <span
              className={`uppercase tracking-widest font-black ${
                match.status === "completed"
                  ? "text-emerald-400"
                  : match.status === "ongoing"
                  ? "text-amber-400"
                  : "text-slate-500"
              }`}
            >
              {match.status}
            </span>
          </div>

          {/* Slots */}
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
                      renderLogoPlaceholder(match.teamB.name)
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
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 h-screen flex flex-col overflow-hidden">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 pt-4 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Knockout <span className="text-gradient">Bracket Board</span>
          </h1>
          <p className="text-slate-400 text-xs">
            Drag to pan, pinch/scroll to zoom. Click any match card to edit scores or assign teams directly!
          </p>
        </div>

        {/* Canvas Toolbar Controls */}
        <div className="flex gap-1 bg-slate-800/60 border border-slate-700/50 p-1 rounded-xl shrink-0">
          <button
            onClick={zoomIn}
            className="btn-control p-2 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={zoomOut}
            className="btn-control p-2 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetZoom}
            className="btn-control p-2 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold px-3"
            title="Reset Canvas View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Fit View</span>
          </button>
        </div>
      </div>

      {/* CANVAS CONTAINER */}
      <div
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex-1 relative overflow-hidden bg-slate-950/80 border border-slate-800/80 rounded-2xl mx-6 mb-6 shadow-2xl cursor-grab ${
          isDragging ? "cursor-grabbing" : ""
        }`}
        style={{
          backgroundImage: `radial-gradient(rgba(100, 116, 139, 0.1) 1.5px, transparent 1.5px)`,
          backgroundSize: "24px 24px",
        }}
      >
        {matchesLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="text-slate-400 text-sm">Building tournament layout...</p>
          </div>
        ) : roundKeys.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
            <GitMerge className="h-16 w-16 text-slate-750 mb-3" />
            <p className="font-semibold text-sm">No Bracket Generated</p>
            <p className="text-xs mt-1 text-slate-600">Please generate the bracket from the Admin Panel first.</p>
          </div>
        ) : (
          /* ZOOM & TRANSLATE LAYER */
          <div
            className="absolute origin-center transition-transform duration-75"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              left: "50%",
              top: "50%",
              // Offset by 50% to make center alignment around parent easier
              marginLeft: `-${(totalRounds * 2 + 1) * 150}px`,
              marginTop: "-300px",
              width: `${(totalRounds * 2 + 1) * 300}px`,
              height: "600px",
            }}
          >
            <div className="flex h-full items-stretch justify-center relative select-none">
              
              {/* 1. LEFT WING: Round 1 up to Round R-1 */}
              {Array.from({ length: totalRounds - 1 }).map((_, i) => {
                const roundIndex = i + 1;
                const matchesInRound = rounds[roundIndex] || [];
                const leftMatches = matchesInRound
                  .filter((m) => m.position <= matchesInRound.length / 2)
                  .sort((a, b) => a.position - b.position);

                return (
                  <div key={`left-round-${roundIndex}`} className="flex flex-col justify-around w-72 relative py-8 px-4">
                    {/* Header */}
                    <div className="absolute top-2 left-0 right-0 text-center font-black text-slate-400 uppercase tracking-widest text-[9px] pointer-events-none">
                      Round {roundIndex} (Left)
                    </div>
                    {leftMatches.map((match) => renderMatchCard(match, "left"))}
                  </div>
                );
              })}

              {/* 2. CENTER WING: Grand Final (Round R) */}
              <div className="flex flex-col justify-center items-center w-80 relative py-8 px-4 border-x border-slate-900/40 bg-slate-950/20">
                <div className="absolute top-2 left-0 right-0 text-center font-black text-gradient uppercase tracking-widest text-[10px] pointer-events-none flex items-center justify-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-yellow-500" /> Grand Final
                </div>

                {rounds[totalRounds]?.map((match) => renderMatchCard(match, "center"))}
              </div>

              {/* 3. RIGHT WING: Round R-1 down to Round 1 (Reversed visual layout) */}
              {Array.from({ length: totalRounds - 1 })
                .map((_, i) => totalRounds - 1 - i) // Reverses round order (R-1 down to 1)
                .map((roundIndex) => {
                  const matchesInRound = rounds[roundIndex] || [];
                  const rightMatches = matchesInRound
                    .filter((m) => m.position > matchesInRound.length / 2)
                    .sort((a, b) => a.position - b.position);

                  return (
                    <div key={`right-round-${roundIndex}`} className="flex flex-col justify-around w-72 relative py-8 px-4">
                      {/* Header */}
                      <div className="absolute top-2 left-0 right-0 text-center font-black text-slate-400 uppercase tracking-widest text-[9px] pointer-events-none">
                        Round {roundIndex} (Right)
                      </div>
                      {rightMatches.map((match) => renderMatchCard(match, "right"))}
                    </div>
                  );
                })}

            </div>
          </div>
        )}
      </div>

      {/* INLINE EDIT MODAL */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass-panel p-6 rounded-2xl border border-slate-700 max-w-md w-full mx-4 shadow-2xl relative animate-in scale-in duration-300">
            <button
              onClick={() => setEditingMatch(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-white">
              <GitMerge className="w-5 h-5 text-blue-400" /> Manage Match #{editingMatch.matchNumber}
            </h3>

            <form onSubmit={handleSaveMatch} className="space-y-4">
              
              {/* TEAM A DROPDOWN & SCORE */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase">Team A (Top)</label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    value={selectedTeamA}
                    onChange={(e) => setSelectedTeamA(e.target.value)}
                  >
                    <option value="">-- Bye / Empty --</option>
                    {teams.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} (Draw #{t.drawNumber})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    placeholder="Score"
                    className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-center text-xs font-bold font-mono text-white focus:outline-none"
                    value={scoreA}
                    onChange={(e) => setScoreA(e.target.value)}
                  />
                </div>
              </div>

              {/* TEAM B DROPDOWN & SCORE */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase">Team B (Bottom)</label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    value={selectedTeamB}
                    onChange={(e) => setSelectedTeamB(e.target.value)}
                  >
                    <option value="">-- Bye / Empty --</option>
                    {teams.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} (Draw #{t.drawNumber})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    placeholder="Score"
                    className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-center text-xs font-bold font-mono text-white focus:outline-none"
                    value={scoreB}
                    onChange={(e) => setScoreB(e.target.value)}
                  />
                </div>
              </div>

              {/* STATUS SELECTOR */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-400 uppercase">Match Status</label>
                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  value={matchStatus}
                  onChange={(e) => setMatchStatus(e.target.value as any)}
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="ongoing">🟢 Live / Ongoing</option>
                  <option value="completed">🏆 Completed (Save updates standing & advances winner)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-800 pt-4 mt-3">
                <button
                  type="button"
                  onClick={() => setEditingMatch(null)}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs px-4 py-2.5 rounded-lg font-bold transition-colors text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 text-xs px-5 py-2.5 rounded-lg font-bold text-white transition-colors"
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
