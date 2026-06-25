"use client";

import useSWR from "swr";
import { GitMerge } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function BracketPage() {
  const { data, error, isLoading } = useSWR("/api/matches", fetcher, { refreshInterval: 5000 });

  if (error) return <div className="text-red-500 p-4 text-center glass-panel rounded-xl">Failed to load matches</div>;

  // Group matches by round
  const rounds: { [key: number]: any[] } = {};
  if (data?.data) {
    data.data.forEach((match: any) => {
      if (!rounds[match.round]) rounds[match.round] = [];
      rounds[match.round].push(match);
    });
  }

  const roundKeys = Object.keys(rounds).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 h-full flex flex-col">
      <div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
          Tournament <span className="text-gradient">Bracket</span>
        </h1>
        <p className="mt-2 text-slate-400">Live knockout stage.</p>
      </div>

      <div className="glass-panel rounded-2xl border border-slate-700/50 shadow-2xl p-6 flex-1 overflow-x-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : roundKeys.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <GitMerge className="mx-auto h-12 w-12 text-slate-600 mb-3" />
            No bracket generated yet.
          </div>
        ) : (
          <div className="flex gap-12 min-w-max p-4">
            {roundKeys.map((roundIndex, i) => {
              const isFinal = i === roundKeys.length - 1;
              const matchesInRound = rounds[roundIndex].sort((a, b) => a.position - b.position);

              return (
                <div key={roundIndex} className="flex flex-col justify-around w-64 relative">
                  <div className="absolute -top-8 left-0 right-0 text-center font-bold text-slate-400 uppercase tracking-widest text-xs">
                    {isFinal ? "Final" : `Round ${roundIndex}`}
                  </div>
                  
                  {matchesInRound.map((match: any, matchIdx: number) => {
                     // Determine if it's the top or bottom branch to draw connector
                     const isTopBranch = match.position % 2 !== 0;
                     
                     return (
                      <div key={match._id} className="relative py-4 flex-1 flex flex-col justify-center">
                        {/* Connector lines to next round */}
                        {!isFinal && (
                          <div 
                            className={`absolute w-6 right-[-24px] border-r-2 border-slate-600/50
                              ${isTopBranch ? 'top-[50%] h-[50%] border-t-2 rounded-tr-lg' : 'bottom-[50%] h-[50%] border-b-2 rounded-br-lg'}
                            `} 
                          />
                        )}
                        {/* Connector line from previous round */}
                        {i > 0 && (
                          <div className="absolute w-6 left-[-24px] top-[50%] border-t-2 border-slate-600/50" />
                        )}

                        {/* Match Card */}
                        <div className={`relative z-10 bg-slate-800/80 border ${match.status === 'completed' ? 'border-slate-500/50' : 'border-slate-700/80'} rounded-lg overflow-hidden shadow-lg`}>
                          
                          <div className="bg-slate-900/50 px-3 py-1.5 text-[10px] text-slate-400 font-medium flex justify-between border-b border-slate-700/50">
                            <span>Match {match.matchNumber}</span>
                            <span className={match.status === 'completed' ? 'text-emerald-400' : ''}>{match.status}</span>
                          </div>

                          <div className="flex flex-col">
                            {/* Team A */}
                            <div className={`flex justify-between items-center px-3 py-2 border-b border-slate-700/30 ${match.status === 'completed' && match.scoreA > match.scoreB ? 'bg-blue-500/10' : ''}`}>
                              <span className={`text-sm truncate pr-2 ${match.status === 'completed' && match.scoreA > match.scoreB ? 'text-white font-bold' : 'text-slate-300'}`}>
                                {match.teamA?.name || 'TBD'}
                              </span>
                              <span className={`text-sm font-mono ${match.status === 'completed' && match.scoreA > match.scoreB ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>
                                {match.scoreA !== null ? match.scoreA : '-'}
                              </span>
                            </div>

                            {/* Team B */}
                            <div className={`flex justify-between items-center px-3 py-2 ${match.status === 'completed' && match.scoreB > match.scoreA ? 'bg-blue-500/10' : ''}`}>
                              <span className={`text-sm truncate pr-2 ${match.status === 'completed' && match.scoreB > match.scoreA ? 'text-white font-bold' : 'text-slate-300'}`}>
                                {match.teamB?.name || 'TBD'}
                              </span>
                              <span className={`text-sm font-mono ${match.status === 'completed' && match.scoreB > match.scoreA ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>
                                {match.scoreB !== null ? match.scoreB : '-'}
                              </span>
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
