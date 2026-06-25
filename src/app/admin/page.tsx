"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import {
  Trophy,
  Users,
  Settings,
  GitMerge,
  Trash2,
  Edit,
  Plus,
  X,
  Play,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Calendar,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Activity,
  Layers,
  Save,
  AlertTriangle
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Team {
  _id: string;
  name: string;
  logoUrl: string;
  drawNumber?: number | null;
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
  nextMatchId?: string | null;
}

export default function AdminDashboard() {
  const { data: teamsData, mutate: mutateTeams } = useSWR("/api/teams", fetcher);
  const { data: matchesData, mutate: mutateMatches } = useSWR("/api/matches", fetcher);
  const { data: configData, mutate: mutateConfig } = useSWR("/api/config", fetcher);

  const teams: Team[] = teamsData?.data || [];
  const matches: Match[] = matchesData?.data || [];
  const config = configData?.data || { tournamentType: "single-elimination", tournamentName: "PCH Cup Tournament" };

  // Tab State: 'teams' | 'draw' | 'matches' | 'settings'
  const [activeTab, setActiveTab] = useState<"teams" | "draw" | "matches" | "settings">("teams");

  // Teams CRUD State
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamLogo, setNewTeamLogo] = useState("");
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editName, setEditName] = useState("");
  const [editLogo, setEditLogo] = useState("");

  // Draw State
  const [isDrawing, setIsDrawing] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [drawError, setDrawError] = useState("");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  // Settings & Config State
  const [tempType, setTempType] = useState<"round-robin" | "single-elimination">("single-elimination");
  const [tempName, setTempName] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Pan & Zoom State for Bracket View (if single-elimination matches controller)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.85);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Match Editor State
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [selectedTeamA, setSelectedTeamA] = useState("");
  const [selectedTeamB, setSelectedTeamB] = useState("");
  const [scoreA, setScoreA] = useState<string>("");
  const [scoreB, setScoreB] = useState<string>("");
  const [matchStatus, setMatchStatus] = useState<"scheduled" | "ongoing" | "completed">("scheduled");
  const [isSavingMatch, setIsSavingMatch] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Sync settings when configData is fetched
  useEffect(() => {
    if (configData?.data) {
      setTempType(configData.data.tournamentType);
      setTempName(configData.data.tournamentName);
    }
  }, [configData]);

  // Sync draw reveals when teams reload
  useEffect(() => {
    if (teams.length > 0) {
      const alreadyDrawn = teams.filter((t) => t.drawNumber !== null && t.drawNumber !== undefined);
      if (alreadyDrawn.length > 0) {
        setRevealedIds(new Set(alreadyDrawn.map((t) => t._id)));
      }
    }
  }, [teamsData]);

  // --- LOGO FILE UPLOADING ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert("Logo size must be under 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) {
        setEditLogo(reader.result as string);
      } else {
        setNewTeamLogo(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // --- TEAM CRUD ACTIONS ---
  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    await fetch("/api/teams", {
      method: "POST",
      body: JSON.stringify({ name: newTeamName, logoUrl: newTeamLogo }),
      headers: { "Content-Type": "application/json" },
    });

    setNewTeamName("");
    setNewTeamLogo("");
    mutateTeams();
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm("Are you sure you want to delete this team?")) return;
    await fetch(`/api/teams/${id}`, { method: "DELETE" });
    mutateTeams();
    mutateMatches();
  };

  const openTeamEditor = (team: Team) => {
    setEditingTeam(team);
    setEditName(team.name);
    setEditLogo(team.logoUrl || "");
  };

  const handleSaveEditTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam || !editName.trim()) return;

    await fetch(`/api/teams/${editingTeam._id}`, {
      method: "PUT",
      body: JSON.stringify({ name: editName, logoUrl: editLogo }),
      headers: { "Content-Type": "application/json" },
    });

    setEditingTeam(null);
    mutateTeams();
    mutateMatches();
  };

  // --- DRAW ACTIONS ---
  const handleStartDraw = async () => {
    setIsDrawing(true);
    setIsShuffling(true);
    setDrawError("");

    await new Promise((resolve) => setTimeout(resolve, 1550));

    try {
      const res = await fetch("/api/draw", { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        setDrawError(json.error || "Failed to draw numbers.");
        setIsShuffling(false);
      } else {
        setRevealedIds(new Set());
        setIsShuffling(false);
        await mutateTeams();
      }
    } catch (err: any) {
      setDrawError(err.message || "An error occurred.");
      setIsShuffling(false);
    } finally {
      setIsDrawing(false);
    }
  };

  const handleResetDraw = async () => {
    if (!confirm("Are you sure? This will delete all draw numbers and wipe the current tournament bracket!")) return;
    setIsResetting(true);
    setDrawError("");
    try {
      const res = await fetch("/api/draw", { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        setDrawError(json.error || "Failed to reset draw.");
      } else {
        setRevealedIds(new Set());
        await mutateTeams();
        await mutateMatches();
      }
    } catch (err: any) {
      setDrawError(err.message || "An error occurred.");
    } finally {
      setIsResetting(false);
    }
  };

  const toggleReveal = (id: string) => {
    const team = teams.find((t) => t._id === id);
    if (!team || team.drawNumber === null || team.drawNumber === undefined) return;

    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRevealAllDraw = () => {
    const drawnTeams = teams.filter((t) => t.drawNumber !== null && t.drawNumber !== undefined);
    drawnTeams.forEach((team, index) => {
      setTimeout(() => {
        setRevealedIds((prev) => {
          const next = new Set(prev);
          next.add(team._id);
          return next;
        });
      }, index * 200);
    });
  };

  // --- SETTINGS ACTIONS ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await fetch("/api/config", {
        method: "POST",
        body: JSON.stringify({ key: "tournamentName", value: tempName }),
        headers: { "Content-Type": "application/json" },
      });
      await fetch("/api/config", {
        method: "POST",
        body: JSON.stringify({ key: "tournamentType", value: tempType }),
        headers: { "Content-Type": "application/json" },
      });
      alert("Settings saved successfully!");
      mutateConfig();
    } catch (err) {
      console.error(err);
      alert("Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleRegenerateSchedule = async () => {
    if (
      !confirm(
        `Warning: This will DELETE all existing matches and generate a new ${
          tempType === "round-robin" ? "Round Robin League Schedule" : "Knockout Bracket"
        } based on registered teams. All match scores and history will be cleared. Continue?`
      )
    )
      return;

    setIsGenerating(true);
    try {
      // 1. Save settings first
      await fetch("/api/config", {
        method: "POST",
        body: JSON.stringify({ key: "tournamentName", value: tempName }),
        headers: { "Content-Type": "application/json" },
      });
      await fetch("/api/config", {
        method: "POST",
        body: JSON.stringify({ key: "tournamentType", value: tempType }),
        headers: { "Content-Type": "application/json" },
      });
      await mutateConfig();

      // 2. Generate matches
      const res = await fetch("/api/matches/generate", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        alert("Matches and schedules generated successfully!");
      } else {
        alert(json.error || "Failed to generate matches.");
      }
      mutateMatches();
      mutateTeams();
    } catch (err) {
      console.error(err);
      alert("An error occurred during generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  // --- BRACKET CANVAS ACTIONS (FOR SINGLE ELIMINATION MATCH CONTROLLER) ---
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

  // --- OPEN MATCH EDITOR MODAL ---
  const openMatchEditor = (match: Match) => {
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

    setIsSavingMatch(true);
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
      setIsSavingMatch(false);
    }
  };

  // Helper renderers
  const renderLogoPlaceholder = (name: string, size = "w-8 h-8 text-xs") => {
    const initials = name ? name.substring(0, 2).toUpperCase() : "VS";
    return (
      <div className={`${size} rounded-full bg-slate-700 flex items-center justify-center font-bold text-white border border-slate-600 shrink-0`}>
        {initials}
      </div>
    );
  };

  // Group matches by round
  const rounds: { [key: number]: Match[] } = {};
  matches.forEach((match: Match) => {
    if (!rounds[match.round]) rounds[match.round] = [];
    rounds[match.round].push(match);
  });
  const roundKeys = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const totalRounds = roundKeys.length;

  const hasDrawn = teams.some((t) => t.drawNumber !== null && t.drawNumber !== undefined);
  const allRevealed = teams.length > 0 && teams.every((t) => t.drawNumber !== null && revealedIds.has(t._id));

  // Render bracket match card inside canvas
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
          onClick={() => openMatchEditor(match)}
          className="match-card w-64 bg-slate-900/90 hover:bg-slate-800/80 hover:scale-[1.02] border transition-all duration-300 rounded-2xl overflow-hidden shadow-xl cursor-pointer border-slate-800/80"
        >
          <div className="bg-slate-950/75 px-3 py-1.5 text-[9px] text-slate-450 font-bold flex justify-between border-b border-slate-800/60">
            <span>MATCH #{match.matchNumber}</span>
            <span
              className={`uppercase tracking-widest font-black ${
                match.status === "completed"
                  ? "text-emerald-450"
                  : match.status === "ongoing"
                  ? "text-amber-450 animate-pulse"
                  : "text-slate-550"
              }`}
            >
              {match.status}
            </span>
          </div>

          <div className="flex flex-col">
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
                    <div className="w-6 h-6 rounded-full bg-slate-850 border border-dashed border-slate-750 flex items-center justify-center text-slate-650 font-bold text-[8px]">BYE</div>
                    <span className="text-xs text-slate-550 font-semibold italic">Bye/TBD</span>
                  </>
                )}
              </div>
              <span className={`text-xs font-bold font-mono ${isWinnerA ? "text-blue-450" : "text-slate-550"}`}>
                {match.scoreA !== null ? match.scoreA : "-"}
              </span>
            </div>

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
                    <div className="w-6 h-6 rounded-full bg-slate-850 border border-dashed border-slate-750 flex items-center justify-center text-slate-650 font-bold text-[8px]">BYE</div>
                    <span className="text-xs text-slate-550 font-semibold italic">Bye/TBD</span>
                  </>
                )}
              </div>
              <span className={`text-xs font-bold font-mono ${isWinnerB ? "text-blue-450" : "text-slate-550"}`}>
                {match.scoreB !== null ? match.scoreB : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-5 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-2.5 text-white">
            <Settings className="w-7 h-7 text-blue-400" /> Admin Scheduler Panel
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure format settings, manage team registrations, draw team numbers, and update scores.
          </p>
        </div>

        {/* Tab switch controller */}
        <div className="flex gap-1 bg-slate-900 border border-slate-800/80 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab("teams")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "teams" ? "bg-blue-650 text-white shadow-lg shadow-blue-500/10" : "text-slate-400 hover:text-slate-205"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Teams CRUD</span>
          </button>
          <button
            onClick={() => setActiveTab("draw")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "draw" ? "bg-blue-650 text-white shadow-lg shadow-blue-500/10" : "text-slate-400 hover:text-slate-205"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Random Draw</span>
          </button>
          <button
            onClick={() => setActiveTab("matches")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "matches" ? "bg-blue-650 text-white shadow-lg shadow-blue-500/10" : "text-slate-400 hover:text-slate-205"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Match Editor</span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeTab === "settings" ? "bg-blue-650 text-white shadow-lg shadow-blue-500/10" : "text-slate-400 hover:text-slate-205"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* --- TAB BODY RENDERERS --- */}
      <div className="flex-1 overflow-hidden flex flex-col">
        
        {/* TAB 1: TEAMS MANAGER */}
        {activeTab === "teams" && (
          <div className="grid md:grid-cols-3 gap-6 items-stretch flex-1 overflow-y-auto pr-1">
            {/* Team Register Form */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 flex flex-col justify-between h-fit">
              <div className="space-y-4">
                <div>
                  <h3 className="text-md font-extrabold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-450" /> Register New Team
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Add a new participant to the roster.</p>
                </div>

                <form onSubmit={handleAddTeam} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Team Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Jakarta Bhayangkara"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-semibold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Team Logo File</label>
                    <div className="relative border border-dashed border-slate-800 bg-slate-950/40 rounded-xl p-3.5 flex flex-col items-center justify-center text-center cursor-pointer hover:border-slate-700 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, false)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      {newTeamLogo ? (
                        <div className="flex items-center gap-3">
                          <img src={newTeamLogo} alt="Preview" className="w-10 h-10 rounded-full object-cover border border-slate-700 shadow-lg" />
                          <span className="text-[10px] text-blue-400 font-bold">Logo Uploaded</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400">Click to upload logo</p>
                          <p className="text-[9px] text-slate-500">Max size 1MB (PNG, JPG)</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-650 hover:bg-blue-600 text-white font-extrabold py-2.5 rounded-xl transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
                  >
                    <Plus className="w-4 h-4" /> Register Team
                  </button>
                </form>
              </div>
            </div>

            {/* Registered Teams Table */}
            <div className="md:col-span-2 glass-panel overflow-hidden border border-slate-800/80 rounded-3xl shadow-xl flex flex-col min-h-[400px]">
              <div className="bg-slate-950/40 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-md font-extrabold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-455" /> Registered Teams ({teams.length})
                </h3>
              </div>

              <div className="overflow-y-auto flex-1 max-h-[500px]">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/30 text-xs uppercase text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5 font-semibold">Team</th>
                      <th className="px-6 py-3.5 font-semibold text-center w-28">Draw Slot</th>
                      <th className="px-6 py-3.5 font-semibold text-center w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/30">
                    {teams.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-16 text-center text-slate-550 italic">
                          No teams registered. Add teams to begin.
                        </td>
                      </tr>
                    ) : (
                      teams.map((team) => (
                        <tr key={team._id} className="hover:bg-slate-800/10 transition-colors">
                          <td className="px-6 py-4.5 font-bold text-white">
                            <div className="flex items-center gap-3">
                              {team.logoUrl ? (
                                <img src={team.logoUrl} alt={team.name} className="w-8 h-8 rounded-full object-cover border border-slate-700" />
                              ) : (
                                renderLogoPlaceholder(team.name, "w-8 h-8 text-xs")
                              )}
                              <span>{team.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4.5 text-center font-mono font-black text-slate-400 text-xs">
                            {team.drawNumber !== null && team.drawNumber !== undefined ? `#${team.drawNumber}` : "-"}
                          </td>
                          <td className="px-6 py-4.5 text-center">
                            <div className="flex justify-center gap-1.5">
                              <button
                                onClick={() => openTeamEditor(team)}
                                className="p-2 hover:bg-blue-500/10 text-slate-400 hover:text-blue-400 rounded-xl transition-all"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTeam(team._id)}
                                className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-xl transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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

        {/* TAB 2: RANDOM DRAW CONSOLE */}
        {activeTab === "draw" && (
          <div className="space-y-6 flex-1 overflow-y-auto pr-1">
            {config.tournamentType === "round-robin" && (
              <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-450 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-extrabold text-amber-400">Notice: Round Robin League Format Selected</p>
                  <p className="text-slate-400 mt-1">
                    The tournament is currently configured as a Round Robin League. Random Draw numbers are only required for Single Elimination knockout seeding. You can still perform the draw, but it will not impact round-robin schedules.
                  </p>
                </div>
              </div>
            )}

            <div className="glass-panel p-6 rounded-3xl border border-slate-800/80 bg-slate-900/10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" /> Seeding Draw Console
                </h3>
                <p className="text-xs text-slate-400">
                  Assign random slot numbers to all {teams.length} registered teams. These slots define seeding slots.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleResetDraw}
                  disabled={isResetting || isDrawing}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-200 font-extrabold px-5 py-3 rounded-2xl transition-all text-xs flex items-center gap-2 border border-slate-700/50 disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" /> Reset Draw
                </button>
                <button
                  onClick={handleStartDraw}
                  disabled={isDrawing || teams.length < 2}
                  className="bg-blue-650 hover:bg-blue-600 text-white font-extrabold px-6 py-3 rounded-2xl transition-all text-xs flex items-center gap-2 shadow-lg shadow-blue-500/10 disabled:opacity-50"
                >
                  <Play className="w-4 h-4" /> {isShuffling ? "Shuffling Slots..." : "Start Random Draw"}
                </button>
              </div>
            </div>

            {drawError && <div className="text-red-500 text-xs font-bold text-center bg-red-950/20 p-3 rounded-xl border border-red-900/30">{drawError}</div>}

            {/* Mystery card deck layout */}
            {teams.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-bold text-slate-400">Mystery Card Board</span>
                  {hasDrawn && !allRevealed && (
                    <button onClick={handleRevealAllDraw} className="text-xs font-extrabold text-blue-450 hover:underline">
                      Reveal All Slots
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {teams.map((team) => {
                    const isDrawn = team.drawNumber !== null && team.drawNumber !== undefined;
                    const isRevealed = revealedIds.has(team._id);

                    return (
                      <div
                        key={team._id}
                        onClick={() => toggleReveal(team._id)}
                        className="perspective w-full aspect-[3/4] cursor-pointer"
                      >
                        <div
                          className={`relative w-full h-full duration-700 transform-style-3d ${
                            isRevealed ? "rotate-y-180" : ""
                          } ${isShuffling ? "animate-shake" : ""}`}
                        >
                          {/* Card Front (Mystery Side) */}
                          <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700/60 rounded-2xl flex flex-col items-center justify-center p-3 shadow-xl">
                            <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center border border-slate-700 text-slate-500 font-bold mb-2">?</div>
                            <span className="text-[10px] text-center font-bold text-slate-350 truncate w-full">{team.name}</span>
                          </div>

                          {/* Card Back (Revealed Draw Side) */}
                          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-blue-900/30 to-slate-950 border border-blue-500/30 rounded-2xl flex flex-col items-center justify-center p-3 shadow-xl shadow-blue-500/5">
                            {team.logoUrl ? (
                              <img src={team.logoUrl} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-slate-700" />
                            ) : (
                              renderLogoPlaceholder(team.name, "w-10 h-10 text-xs")
                            )}
                            <span className="text-[10px] text-center font-bold text-slate-200 truncate w-full mt-2">{team.name}</span>
                            <span className="mt-2 text-xl font-mono font-black text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">
                              Slot #{team.drawNumber}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MATCH EDITOR CONTROLLER */}
        {activeTab === "matches" && (
          <div className="flex-1 flex flex-col overflow-hidden relative min-h-[450px]">
            {/* If Round Robin: List Editor */}
            {config.tournamentType === "round-robin" ? (
              <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                <div className="bg-slate-950/40 px-6 py-4 border border-slate-800 rounded-2xl flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="text-md font-extrabold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-455" /> Round Robin Matches
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Click any match to record scores and update status.</p>
                  </div>
                </div>

                {matches.length === 0 ? (
                  <div className="glass-panel p-16 text-center text-slate-550 border border-slate-800 rounded-2xl">
                    <Calendar className="mx-auto h-12 w-12 text-slate-800 mb-3" />
                    No matches generated. Go to Settings tab to create matches.
                  </div>
                ) : (
                  <div className="space-y-8 pb-12">
                    {roundKeys.map((roundNum) => {
                      const roundMatches = rounds[roundNum] || [];

                      return (
                        <div key={`admin-round-${roundNum}`} className="space-y-3">
                          <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 px-1">
                            <span className="bg-blue-650 text-white text-[9px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full">Round {roundNum}</span>
                            <span className="text-[9px] text-slate-500 font-bold">({roundMatches.length} Matches)</span>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {roundMatches.map((match) => {
                              const isWinnerA = match.status === "completed" && match.scoreA !== null && match.scoreB !== null && match.scoreA > match.scoreB;
                              const isWinnerB = match.status === "completed" && match.scoreA !== null && match.scoreB !== null && match.scoreB > match.scoreA;

                              return (
                                <div
                                  key={match._id}
                                  onClick={() => openMatchEditor(match)}
                                  className={`glass-panel p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between cursor-pointer hover:scale-[1.02] ${
                                    match.status === "ongoing"
                                      ? "border-amber-500/50 bg-amber-950/5 shadow-amber-550/5 animate-pulse-glow"
                                      : "border-slate-800/60 bg-slate-900/10 hover:border-slate-700/50"
                                  }`}
                                >
                                  <div className="flex justify-between items-center text-[8px] text-slate-500 font-bold border-b border-slate-850/50 pb-2 mb-3">
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
                                      <span className={`text-xs font-mono font-bold ${isWinnerA ? "text-blue-455" : "text-slate-550"}`}>
                                        {match.scoreA !== null ? match.scoreA : "-"}
                                      </span>
                                    </div>

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
                                      <span className={`text-xs font-mono font-bold ${isWinnerB ? "text-blue-455" : "text-slate-550"}`}>
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
            ) : (
              /* If Single Elimination: Draggable Bracket Canvas */
              <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Canvas Controls */}
                <div className="absolute top-2 right-4 z-10 flex gap-1 bg-slate-800/80 border border-slate-700/50 p-1 rounded-xl shadow-lg shrink-0">
                  <button onClick={zoomIn} className="btn-control p-2 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"><ZoomIn className="w-4 h-4" /></button>
                  <button onClick={zoomOut} className="btn-control p-2 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"><ZoomOut className="w-4 h-4" /></button>
                  <button onClick={resetZoom} className="btn-control p-2 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold px-3"><Maximize2 className="w-3.5 h-3.5" /><span>Fit</span></button>
                </div>

                {/* Canvas Board */}
                <div
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className={`flex-1 relative overflow-hidden bg-slate-950/85 border border-slate-800/85 rounded-3xl shadow-inner min-h-[450px] cursor-grab ${
                    isDragging ? "cursor-grabbing" : ""
                  }`}
                  style={{
                    backgroundImage: `radial-gradient(rgba(100, 116, 139, 0.1) 1.5px, transparent 1.5px)`,
                    backgroundSize: "24px 24px",
                  }}
                >
                  {matches.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-550">
                      <GitMerge className="h-16 w-16 text-slate-800 mb-2" />
                      <span className="text-xs">No bracket created. Go to Settings tab to generate matches.</span>
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
                                <div className="absolute top-2 left-0 right-0 text-center font-black text-slate-500 uppercase tracking-widest text-[9px]">Round {roundIndex}</div>
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
        )}

        {/* TAB 4: SETTINGS & CONFIG */}
        {activeTab === "settings" && (
          <div className="grid md:grid-cols-2 gap-6 items-start flex-1 overflow-y-auto pr-1">
            {/* Global Settings Configuration */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 bg-slate-900/10 space-y-6">
              <div>
                <h3 className="text-md font-extrabold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-blue-450" /> Tournament Parameters
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Edit league profile, scheduler rules, and metadata.</p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Tournament Name</label>
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Scheduler Format</label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Round Robin Option */}
                    <div
                      onClick={() => setTempType("round-robin")}
                      className={`border p-4 rounded-2xl cursor-pointer transition-all duration-300 flex flex-col justify-between min-h-[100px] ${
                        tempType === "round-robin"
                          ? "border-blue-550 bg-blue-900/10 shadow-lg shadow-blue-500/5"
                          : "border-slate-800 bg-slate-950/40 hover:border-slate-700/60"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-white">Round Robin League</span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${tempType === "round-robin" ? "border-blue-500 bg-blue-500" : "border-slate-655"}`}>
                          {tempType === "round-robin" && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">
                        Every team plays every other team once. Rankings are compiled into a league table based on scores.
                      </p>
                    </div>

                    {/* Single Elimination Option */}
                    <div
                      onClick={() => setTempType("single-elimination")}
                      className={`border p-4 rounded-2xl cursor-pointer transition-all duration-300 flex flex-col justify-between min-h-[100px] ${
                        tempType === "single-elimination"
                          ? "border-blue-550 bg-blue-900/10 shadow-lg shadow-blue-500/5"
                          : "border-slate-800 bg-slate-950/40 hover:border-slate-700/60"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-white">Knockout Bracket</span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${tempType === "single-elimination" ? "border-blue-500 bg-blue-500" : "border-slate-655"}`}>
                          {tempType === "single-elimination" && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">
                        Teams are paired in a knockout tree. Loser is eliminated; winner advances. Symmetrical wings.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="w-full bg-blue-650 hover:bg-blue-600 text-white font-extrabold py-2.5 rounded-xl transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> {isSavingSettings ? "Saving Settings..." : "Save Parameters"}
                </button>
              </form>
            </div>

            {/* Schedule Generation Card */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-800 bg-slate-900/10 space-y-6">
              <div>
                <h3 className="text-md font-extrabold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-500" /> Match Generator
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Generate or reset matches according to selected parameters.</p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl text-xs space-y-2 leading-relaxed">
                  <p className="font-bold text-slate-200">Current Schedule Status:</p>
                  <p className="text-slate-400">Registered Teams: <strong className="text-white">{teams.length}</strong></p>
                  <p className="text-slate-400">Existing Matches: <strong className="text-white">{matches.length}</strong></p>
                  <p className="text-slate-400">Current Config Type: <strong className="text-blue-400 capitalize">{config.tournamentType.replace("-", " ")}</strong></p>
                </div>

                <div className="bg-red-950/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-slate-400 leading-relaxed">
                    <p className="font-extrabold text-red-400">Warning: Destructive Action</p>
                    <p className="mt-1">
                      Generating a schedule will wipe out any existing scores, standings, and matches. Make sure registrations and draw numbers are finalized before generating.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleRegenerateSchedule}
                  disabled={isGenerating || teams.length < 2}
                  className="w-full bg-amber-650 hover:bg-amber-600 text-white font-extrabold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" /> {isGenerating ? "Generating..." : "Save Parameters & Generate Matches"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- TEAM EDIT MODAL --- */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-slate-950/60 px-6 py-4 flex justify-between items-center border-b border-slate-800">
              <h3 className="font-extrabold text-white text-md">Edit Team</h3>
              <button onClick={() => setEditingTeam(null)} className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTeam} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Team Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Team Logo File</label>
                <div className="relative border border-dashed border-slate-800 bg-slate-950/40 rounded-xl p-3.5 flex flex-col items-center justify-center text-center cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, true)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {editLogo ? (
                    <div className="flex items-center gap-3">
                      <img src={editLogo} alt="Preview" className="w-10 h-10 rounded-full object-cover border border-slate-700 shadow-lg" />
                      <span className="text-[10px] text-blue-400 font-bold">Change Logo</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-450">Click to upload logo</p>
                      <p className="text-[9px] text-slate-550">Max size 1MB</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-350 font-extrabold py-2.5 rounded-xl transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-650 hover:bg-blue-600 text-white font-extrabold py-2.5 rounded-xl transition-all text-xs shadow-lg shadow-blue-500/10"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- INLINE MATCH EDIT MODAL --- */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
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
                      <option value="">-- Bye/TBD --</option>
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
                      <option value="">-- Bye/TBD --</option>
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
                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">Match Status</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 border border-slate-850 rounded-xl">
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

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMatch(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-350 font-extrabold py-2.5 rounded-xl transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingMatch}
                  className="flex-1 bg-blue-650 hover:bg-blue-600 text-white font-extrabold py-2.5 rounded-xl transition-all disabled:opacity-50 text-xs shadow-lg shadow-blue-500/10"
                >
                  {isSavingMatch ? "Saving..." : "Save Match"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
