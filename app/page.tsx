"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
// UI IMPORTS
import { ConnectModal } from "@iota/dapp-kit";
// CUSTOM HOOK IMPORT
import { useTypeeContract } from "@/hooks/useTypeeContract";

// --- CONFIG ---
const TIME_LIMIT = 60;
const CHARS_PER_LINE = 50; 

const WORDS_POOL = [
  "the", "be", "of", "and", "a", "to", "in", "he", "have", "it", "that", "for", "they", "with", "as", "not", "on", "she", "at", "by", "this", "we", "you", "do", "but", "from", "or", "which", "one", "would", "all", "will", "there", "say", "who", "make", "when", "can", "more", "if", "no", "man", "out", "other", "so", "what", "time", "up", "go", "about", "than", "into", "could", "state", "only", "new", "year", "some", "take", "come", "these", "know", "see", "use", "get", "like", "then", "first", "any", "work", "now", "may", "such", "give", "over", "think", "most", "even", "find", "day", "also", "after", "way", "many", "must", "look", "before", "great", "back", "through", "long", "where", "much", "should", "well", "people", "down", "own", "just", "because", "good", "each", "those", "feel", "seem", "how", "high", "too", "place", "little", "world", "very", "still", "nation", "hand", "old", "life", "tell", "write", "become", "here", "show", "house", "both", "between", "need", "mean", "call", "develop", "under", "last", "right", "move", "thing", "general", "school", "never", "same", "another", "begin", "while", "number", "part", "turn", "real", "leave", "might", "want", "point", "form", "off", "child", "few", "small", "since", "against", "ask", "late", "home", "interest", "large", "person", "end", "open", "public", "follow", "during", "present", "without", "again", "hold", "govern", "around", "possible", "head", "consider", "word", "program", "problem", "however", "lead", "system", "set", "order", "eye", "plan", "run", "keep", "face", "fact", "group", "play", "stand", "increase", "early", "course", "change", "help", "line"
];

export default function TypeePage() {
  // --- HOOKS ---
  const { 
      isMinting, 
      mintedObjectId, 
      mintScore, 
      fetchHistory, 
      historyData, 
      isLoadingHistory, 
      isConnected, 
      userAddress 
  } = useTypeeContract();
  
  // --- UI STATE ---
  const [viewMode, setViewMode] = useState<"game" | "mintSuccess" | "history">("game");

  // --- GAME STATE ---
  const [wordList, setWordList] = useState<string[]>([]); 
  const [userInput, setUserInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [stats, setStats] = useState({ wpm: 0, acc: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // --- LOGIC: Setup ---
  const generateTest = useCallback(() => {
    const newWords = Array.from({ length: 150 }, () => WORDS_POOL[Math.floor(Math.random() * WORDS_POOL.length)]);
    setWordList(newWords);
    setUserInput("");
    setIsActive(false);
    setIsFinished(false);
    setTimeLeft(TIME_LIMIT);
    setStats({ wpm: 0, acc: 0 });
    setViewMode("game");
    
    // Clear existing timer if any
    if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }
    
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    generateTest();
  }, [generateTest]);

  // --- LOGIC: Handle Actions ---
  const onMintClick = () => {
      mintScore(stats.wpm, stats.acc, () => {
          setViewMode("mintSuccess");
      });
  };

  const onHistoryClick = () => {
      setViewMode("history");
      fetchHistory(); 
  };

  // --- LOGIC: Finish Test ---
  const finishTest = useCallback(() => {
    setIsActive(false);
    setIsFinished(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const targetString = wordList.join(" ");
    const timeMin = (TIME_LIMIT - timeLeft) / 60;
    
    let correctChars = 0;
    const minLen = Math.min(userInput.length, targetString.length);
    for (let i = 0; i < minLen; i++) {
      if (userInput[i] === targetString[i]) correctChars++;
    }

    // Fallback if time is 0 (finished perfectly)
    const finalTimeMin = timeMin === 0 ? (TIME_LIMIT / 60) : timeMin;
    const wpm = Math.round((correctChars / 5) / finalTimeMin);
    const acc = userInput.length > 0 ? Math.round((correctChars / userInput.length) * 100) : 100;

    setStats({ wpm: isNaN(wpm) ? 0 : wpm, acc });
  }, [userInput, timeLeft, wordList]);

  // --- LOGIC: TIMER STABIL (FIXED BUG) ---
  useEffect(() => {
    if (!isActive) return;

    // Interval jalan terus tanpa dependency timeLeft
    timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
            if (prev <= 1) {
                // Waktu habis
                clearInterval(timerRef.current!);
                return 0;
            }
            return prev - 1;
        });
    }, 1000);

    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]); // Dependency cuma isActive, jadi gak reset-reset pas ngetik

  // Trigger finish saat timeLeft 0
  useEffect(() => {
      if (timeLeft === 0 && isActive) {
          finishTest();
      }
  }, [timeLeft, isActive, finishTest]);


  // --- LOGIC: Input Handler ---
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFinished) return;
    const val = e.target.value;
    
    // Start timer lebih responsif (gak cuma pas length 1)
    if (!isActive && val.length > 0) {
        setIsActive(true);
    }
    
    setUserInput(val);
  };

  // --- LOGIC: Rendering Lines ---
  const linesOfWords = useMemo(() => {
    if (wordList.length === 0) return [];
    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentLineLength = 0;
    wordList.forEach((word) => {
      if (currentLineLength + word.length + 1 > CHARS_PER_LINE) {
        lines.push(currentLine);
        currentLine = [word];
        currentLineLength = word.length;
      } else {
        currentLine.push(word);
        currentLineLength += word.length + 1; 
      }
    });
    if (currentLine.length > 0) lines.push(currentLine);
    return lines;
  }, [wordList]);

  const currentLineIndex = useMemo(() => {
    if (userInput.length === 0) return 0;
    let charCount = 0;
    for (let i = 0; i < linesOfWords.length; i++) {
      const lineStr = linesOfWords[i].join(" ");
      if (userInput.length < charCount + lineStr.length + 1) return i;
      charCount += lineStr.length + 1;
    }
    return 0;
  }, [userInput, linesOfWords]);

  const getLineStartCharIndex = (lineIdx: number) => {
    let charIdx = 0;
    for (let i = 0; i < lineIdx; i++) {
      charIdx += linesOfWords[i].join(" ").length + 1; 
    }
    return charIdx;
  };

  // --- RENDER ---
  return (
    <div 
      className="min-h-screen bg-[#323437] flex flex-col items-center justify-center p-8 font-mono"
      onClick={() => !isFinished && viewMode === 'game' && inputRef.current?.focus()}
    >
      <div className="w-full max-w-4xl flex flex-col">
        
        {/* HEADER */}
        <div className="w-full flex justify-between items-start mb-12">
          <div className="flex flex-col cursor-pointer" onClick={() => { setViewMode("game"); generateTest(); }}>
             <h1 className="text-3xl font-bold text-[#d1d0c5]">typee</h1>
             <span className="text-xs text-[#646669] mt-1">on IOTA Testnet</span>
          </div>

          <div className="flex items-center gap-4">
             {viewMode === "game" && !isFinished && (
                <div className="text-3xl text-[#e2b714] font-bold mr-4">{timeLeft}s</div>
             )}

             {isConnected && (
                <button 
                  onClick={onHistoryClick}
                  className={`px-3 py-2 text-sm rounded font-bold transition-all ${viewMode === 'history' ? 'text-[#e2b714]' : 'text-[#646669] hover:text-[#d1d0c5]'}`}
                >
                  History
                </button>
             )}
             
             <ConnectModal 
                trigger={
                   <button className="px-4 py-2 bg-[#2c2e31] text-[#d1d0c5] text-sm rounded hover:bg-[#d1d0c5] hover:text-[#323437] transition-all font-bold">
                      {isConnected && userAddress ? `${userAddress.slice(0,6)}...${userAddress.slice(-4)}` : "Connect Wallet"}
                   </button>
                }
             />
          </div>
        </div>

        {/* === MAIN CONTENT === */}

        {/* 1. MINT SUCCESS VIEW */}
        {viewMode === "mintSuccess" && (
            <div className="w-full flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-[#e2b714] text-6xl mb-6">✓</div>
                <h2 className="text-3xl text-[#d1d0c5] font-bold mb-2">Minting Successful!</h2>
                
                <div className="flex gap-8 my-6">
                    <div className="text-center">
                        <span className="text-4xl font-bold text-[#e2b714]">{stats.wpm}</span>
                        <p className="text-xs text-[#646669] uppercase">wpm</p>
                    </div>
                    <div className="text-center">
                        <span className="text-4xl font-bold text-[#e2b714]">{stats.acc}%</span>
                        <p className="text-xs text-[#646669] uppercase">acc</p>
                    </div>
                </div>

                <div className="bg-[#2c2e31] p-6 rounded-xl w-full max-w-lg mb-8 border border-[#646669]/30">
                    <div className="text-xs text-[#646669] break-all">
                        <span className="block mb-1 font-bold text-[#d1d0c5]">Object ID:</span>
                        <span className="font-mono text-[#e2b714]">{mintedObjectId || "Loading ID..."}</span>
                    </div>
                    <div className="border-t border-[#646669]/30 my-4"></div>
                    <a 
                        href={`https://explorer.iota.org/object/${mintedObjectId}?network=testnet`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2 bg-[#e2b714]/10 text-[#e2b714] rounded hover:bg-[#e2b714]/20 transition-colors text-sm font-bold"
                    >
                        View Object on IOTA Explorer ↗
                    </a>
                </div>

                <div className="flex gap-4">
                    <button 
                        onClick={onHistoryClick}
                        className="px-6 py-3 border border-[#646669] text-[#646669] font-bold rounded-xl hover:text-[#d1d0c5] hover:border-[#d1d0c5] transition-all"
                    >
                        View History
                    </button>
                    <button 
                        onClick={generateTest}
                        className="px-8 py-3 bg-[#e2b714] text-[#323437] font-bold rounded-xl hover:bg-[#d1a812] transition-all"
                    >
                        New Test
                    </button>
                </div>
            </div>
        )}

        {/* 2. HISTORY VIEW */}
        {viewMode === "history" && (
            <div className="w-full animate-in fade-in duration-300">
                <h2 className="text-2xl text-[#d1d0c5] font-bold mb-6 flex items-center gap-2">
                    <span className="text-[#e2b714]">/</span> My Minted Scores
                </h2>

                {isLoadingHistory ? (
                    <div className="text-[#646669] text-center py-20">Loading blockchain data...</div>
                ) : historyData.length === 0 ? (
                    <div className="text-[#646669] text-center py-20 border border-dashed border-[#646669] rounded-xl">
                        No scores minted yet. Go play!
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {historyData.map((nft) => (
                            <div key={nft.id} className="bg-[#2c2e31] p-4 rounded-lg border border-[#646669]/20 hover:border-[#e2b714]/50 transition-all group">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <p className="text-4xl text-[#e2b714] font-bold">{nft.wpm}</p>
                                        <p className="text-xs text-[#646669]">WPM</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl text-[#d1d0c5] font-bold">{nft.accuracy}%</p>
                                        <p className="text-xs text-[#646669]">ACC</p>
                                    </div>
                                </div>
                                <div className="border-t border-[#646669]/20 mt-2 pt-2 flex justify-between items-center">
                                    <span className="text-[10px] text-[#646669]">ID: {nft.id.slice(0, 8)}...</span>
                                    <a 
                                        href={`https://explorer.iota.org/object/${nft.id}?network=testnet`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[10px] text-[#d1d0c5] opacity-0 group-hover:opacity-100 hover:text-[#e2b714] transition-opacity"
                                    >
                                        View on Explorer ↗
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                <div className="mt-8 text-center">
                     <button onClick={generateTest} className="text-[#646669] hover:text-[#d1d0c5] underline text-sm">
                        Back to Typing Test
                     </button>
                </div>
            </div>
        )}

        {/* 3. GAME VIEW */}
        {viewMode === "game" && (
            <>
                {isFinished ? (
                    // RESULT OVERLAY (IN-PLACE)
                    <div className="w-full flex flex-col items-center justify-center animate-in fade-in duration-300 py-10">
                        <div className="grid grid-cols-2 gap-20 mb-12 text-center">
                            <div>
                                <p className="text-8xl text-[#e2b714] font-bold mb-2">{stats.wpm}</p>
                                <p className="text-2xl text-[#646669]">wpm</p>
                            </div>
                            <div>
                                <p className="text-8xl text-[#e2b714] font-bold mb-2">{stats.acc}%</p>
                                <p className="text-2xl text-[#646669]">acc</p>
                            </div>
                        </div>
                        
                        <div className="flex gap-4 items-center">
                            <button 
                                onClick={generateTest} 
                                autoFocus 
                                className="px-10 py-4 bg-[#646669] text-[#d1d0c5] text-xl font-bold rounded-xl hover:bg-[#d1d0c5] hover:text-[#323437] transition-colors"
                            >
                                Restart
                            </button>

                            {isConnected ? (
                                <button 
                                    onClick={onMintClick}
                                    disabled={isMinting}
                                    className={`px-10 py-4 text-[#323437] text-xl font-bold rounded-xl transition-all flex items-center gap-2
                                        ${isMinting ? "bg-[#e2b714]/50 cursor-wait" : "bg-[#e2b714] hover:bg-[#d1a812]"}
                                    `}
                                >
                                    {isMinting ? "Minting..." : "Mint Score"}
                                </button>
                            ) : (
                                <div className="text-sm text-[#646669] px-4 border-l border-[#646669]">
                                    Connect wallet<br/>to mint score
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // TYPING AREA
                    <>
                        <input
                            ref={inputRef}
                            type="text"
                            value={userInput}
                            onChange={handleInput}
                            className="absolute opacity-0 top-0 left-0"
                            autoFocus
                            autoComplete="off"
                        />
                        <div className="w-full relative overflow-hidden text-left" style={{ height: '150px' }}> 
                            {linesOfWords.map((lineWords, lineIdx) => {
                                if (lineIdx < currentLineIndex || lineIdx >= currentLineIndex + 3) return null;
                                const startCharIdx = getLineStartCharIndex(lineIdx);
                                return (
                                <div key={lineIdx} className="mb-2 text-3xl leading-relaxed whitespace-nowrap">
                                    {lineWords.map((word, wIdx) => {
                                        let charsBeforeInThisLine = 0;
                                        for(let k=0; k<wIdx; k++) charsBeforeInThisLine += lineWords[k].length + 1;
                                        const wordStartGlobalIdx = startCharIdx + charsBeforeInThisLine;
                                        return (
                                        <span key={wIdx} className="inline-block mr-[0.5em]">
                                            {word.split("").map((char, charOffset) => {
                                                const absoluteIdx = wordStartGlobalIdx + charOffset;
                                                let color = "text-[#646669]";
                                                let border = "";
                                                const isTyped = absoluteIdx < userInput.length;
                                                const isCurrent = absoluteIdx === userInput.length;
                                                if (isTyped) color = userInput[absoluteIdx] === char ? "text-[#d1d0c5]" : "text-[#ca4754]";
                                                if (isCurrent && isActive) border = "border-l-2 border-[#e2b714] animate-pulse";
                                                return <span key={charOffset} className={`${color} ${border}`}>{char}</span>
                                            })}
                                            {(() => {
                                                const spaceIdx = wordStartGlobalIdx + word.length;
                                                if (spaceIdx === userInput.length && isActive) return <span className="border-l-2 border-[#e2b714] animate-pulse inline-block h-[0.8em] align-middle ml-1 translate-y-[10%]"></span>
                                                return null;
                                            })()}
                                        </span>
                                        )
                                    })}
                                </div>
                                )
                            })}
                        </div>
                        <div className="mt-12 text-[#646669] text-sm text-center w-full">
                            <button onClick={generateTest} className="hover:text-[#d1d0c5] transition-colors focus:outline-none" tabIndex={0}>
                                <span className="bg-[#2c2e31] px-2 py-1 rounded text-[#d1d0c5] mx-1">Tab</span> + <span className="bg-[#2c2e31] px-2 py-1 rounded text-[#d1d0c5] mx-1">Enter</span> to restart
                            </button>
                        </div>
                    </>
                )}
            </>
        )}

      </div>
    </div>
  );
}