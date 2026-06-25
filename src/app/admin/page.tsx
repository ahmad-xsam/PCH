"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Trash2, Edit2, Settings, Network } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminPage() {
  const { data: teamsData, mutate: mutateTeams } = useSWR("/api/teams", fetcher);
  const { data: matchesData, mutate: mutateMatches } = useSWR("/api/matches", fetcher);

  const [newTeamName, setNewTeamName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName) return;
    await fetch("/api/teams", {
      method: "POST",
      body: JSON.stringify({ name: newTeamName }),
      headers: { "Content-Type": "application/json" },
    });
    setNewTeamName("");
    mutateTeams();
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    await fetch(`/api/teams/${id}`, { method: "DELETE" });
    mutateTeams();
  };

  const handleUpdateMatchScore = async (id: string, scoreA: number | null, scoreB: number | null, status: string) => {
    await fetch(`/api/matches/${id}`, {
      method: "PUT",
      body: JSON.stringify({ scoreA, scoreB, status }),
      headers: { "Content-Type": "application/json" },
    });
    mutateMatches();
    mutateTeams(); // Scores might affect standings
  };

  const handleGenerateBracket = async () => {
    if (!confirm("Warning: This will DELETE all existing matches and generate a new knockout bracket based on registered teams. Continue?")) return;
    setIsGenerating(true);
    await fetch("/api/matches/generate", { method: "POST" });
    mutateMatches();
    setIsGenerating(false);
  };

  const handleDeleteAllMatches = async () => {
     if (!confirm("DELETE ALL MATCHES? This cannot be undone.")) return;
     // simple workaround to delete all: wait for API or just delete one by one
     // For safety, we can just let generate bracket override them.
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
          Admin <span className="text-gradient">Panel</span>
        </h1>
        <p className="mt-2 text-slate-400">Manage teams and brackets.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Teams Management */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-700/50">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400"/> Manage Teams
          </h2>
          
          <form onSubmit={handleAddTeam} className="flex gap-2 mb-6">
            <input 
              type="text" 
              placeholder="Team Name" 
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-1">
              <Plus className="w-4 h-4"/> Add
            </button>
          </form>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {teamsData?.data?.map((team: any) => (
              <div key={team._id} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700/30">
                <span className="font-medium text-slate-200">{team.name}</span>
                <button onClick={() => handleDeleteTeam(team._id)} className="text-red-400 hover:text-red-300 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Matches Management */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-700/50">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-xl font-bold flex items-center gap-2">
               <Network className="w-5 h-5 text-purple-400"/> Bracket Matches
             </h2>
             <button 
                onClick={handleGenerateBracket} 
                disabled={isGenerating}
                className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
             >
                {isGenerating ? "Generating..." : "Auto-Generate Bracket"}
             </button>
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {matchesData?.data?.length === 0 && <p className="text-slate-400 text-sm">No matches yet. Click Generate Bracket.</p>}
            
            {matchesData?.data?.map((match: any) => (
              <div key={match._id} className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/30 space-y-3">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Match #{match.matchNumber} (Round {match.round} - Pos {match.position})</span>
                  <span className={`px-2 py-0.5 rounded uppercase font-bold tracking-wider ${match.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                     {match.status}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-right text-sm font-medium">{match.teamA?.name || 'TBD'}</div>
                  <input 
                    type="number" 
                    className="w-12 bg-slate-900 border border-slate-600 rounded text-center py-1"
                    defaultValue={match.scoreA === null ? '' : match.scoreA}
                    onBlur={(e) => handleUpdateMatchScore(match._id, e.target.value === '' ? null : parseInt(e.target.value), match.scoreB, match.status)}
                  />
                  <span className="text-slate-500">-</span>
                  <input 
                    type="number" 
                    className="w-12 bg-slate-900 border border-slate-600 rounded text-center py-1"
                    defaultValue={match.scoreB === null ? '' : match.scoreB}
                    onBlur={(e) => handleUpdateMatchScore(match._id, match.scoreA, e.target.value === '' ? null : parseInt(e.target.value), match.status)}
                  />
                  <div className="flex-1 text-left text-sm font-medium">{match.teamB?.name || 'TBD'}</div>
                </div>

                <div className="flex justify-center mt-2">
                  <select 
                    className={`text-xs px-2 py-1 rounded bg-slate-900 border ${match.status === 'completed' ? 'border-emerald-500 text-emerald-400' : 'border-slate-600 text-slate-300'}`}
                    value={match.status}
                    onChange={(e) => handleUpdateMatchScore(match._id, match.scoreA, match.scoreB, e.target.value)}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
