import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import { StudyGuideData, SavedSubject, FileInput } from '../types';
import { BookOpen, CheckCircle, HelpCircle, FileText, Activity, Image as ImageIcon, FileQuestion, ArrowLeft, ChevronDown, ChevronUp, Cpu, Award, Upload, X, Paperclip, Files, TrendingUp } from 'lucide-react';

interface ResultsViewProps {
  subject: SavedSubject;
  onReset: () => void;
  onUploadMore: (newMaterials: FileInput[], newSyllabus: FileInput[], newPapers: FileInput[]) => Promise<void>;
  isGenerating: boolean;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ subject, onReset, onUploadMore, isGenerating }) => {
  const data = subject.generatedData || {} as StudyGuideData;
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newMaterials, setNewMaterials] = useState<FileInput[]>([]);
  const [newSyllabus, setNewSyllabus] = useState<FileInput[]>([]);
  const [newPapers, setNewPapers] = useState<FileInput[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  const [activeTab, setActiveTab] = useState<string>(data.selected_outputs[0] || 'Overview');
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});

  // Quiz State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [isQuizFinished, setIsQuizFinished] = useState(false);

  // Regeneration localized timer
  const [localSeconds, setLocalSeconds] = useState(0);
  useEffect(() => {
    let interval: any = null;
    if (isGenerating) {
      setLocalSeconds(0);
      interval = setInterval(() => {
        setLocalSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setLocalSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating]);

  if (isGenerating) {
    const getGeneratingStatus = (seconds: number) => {
      if (seconds < 8) return { step: 1, text: "Merging newly uploaded academic files..." };
      if (seconds < 16) return { step: 2, text: "Structuring syllabus alignments..." };
      if (seconds < 24) return { step: 3, text: "Grounding topics with old exams context..." };
      if (seconds < 32) return { step: 4, text: "Synthesizing expanded modules and notes..." };
      if (seconds < 40) return { step: 5, text: "Generating new quiz questions & solutions..." };
      if (seconds < 48) return { step: 6, text: "Predicting repeated core paper topics..." };
      return { step: 7, text: "Assembling updated learning board..." };
    };

    const status = getGeneratingStatus(localSeconds);

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl border border-gray-100 shadow-[0_20px_60px_rgba(0,0,0,0.15)] flex flex-col items-center">
          
          {/* Animated Spinner Icon with dynamic timer inside */}
          <div className="relative w-32 h-32 mb-8 flex items-center justify-center bg-white rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-50">
            <div className="absolute inset-1.5 border-[3px] border-gray-100 rounded-full"></div>
            {/* Dynamic spin based on four Google colors */}
            <div className="absolute inset-1.5 border-[3px] border-t-[#4285F4] border-r-[#EA4335] border-b-[#FBBC05] border-l-[#34A853] rounded-full animate-spin"></div>
            
            <div className="text-center z-10">
              <span className="block text-3xl font-extrabold text-gray-900 tracking-tight leading-none">{localSeconds}s</span>
              <span className="block text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1">Elapsed</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-2 text-gray-900 tracking-tight text-center">Merging & Re-Synthesizing</h2>
          
          {/* Dynamic Active Step Badge */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-green-50 text-[#34A853] rounded-full text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34A853] animate-pulse"></span>
            <span>Step {status.step} of 7 • {Math.min(Math.round((status.step / 7) * 100), 99)}%</span>
          </div>

          {/* Current Status message */}
          <p className="text-sm font-semibold text-gray-800 text-center leading-relaxed h-12 flex items-center justify-center max-w-xs mb-4">
            "{status.text}"
          </p>

          <p className="text-xs text-gray-400 font-medium text-center max-w-xs leading-relaxed">
            We are combining your previously uploaded course materials with the newly added files to build a unified study experience.
          </p>
        </div>
      </div>
    );
  }

  const tabs = ['Overview', ...data.selected_outputs];

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <h3 className="text-xl font-bold mb-5 text-gray-900 tracking-tight flex items-center">
          <span className="w-1.5 h-6 bg-[#4285F4] rounded-full mr-3"></span>
          Subjects Processed
        </h3>
        {data.subjects?.map((subject, idx) => (
          <div key={idx} className="p-5 bg-blue-50/20 rounded-xl border border-blue-50">
            <h4 className="font-semibold text-base text-gray-900">{subject.name}</h4>
            {subject.modules_completed?.length > 0 && (
              <p className="text-xs font-medium text-gray-500 mt-1.5">Completed Modules: {subject.modules_completed.join(', ')}</p>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <h3 className="text-xl font-bold mb-5 text-gray-900 tracking-tight flex items-center">
          <span className="w-1.5 h-6 bg-[#34A853] rounded-full mr-3"></span>
          Modules Breakdown
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {data.modules?.map((mod, idx) => (
            <div key={idx} className="p-5 bg-[#fbfbfb] rounded-xl border border-gray-100">
              <h4 className="font-semibold text-xs text-[#34A853] mb-3 uppercase tracking-wider bg-green-50 inline-block px-2.5 py-1 rounded-md">Module {mod.module_number}</h4>
              <div className="space-y-2.5 text-xs text-gray-600">
                <p><span className="font-semibold text-gray-900">First Half:</span> {mod.first_half}</p>
                <p><span className="font-semibold text-gray-900">Second Half:</span> {mod.second_half}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDetailedNotes = () => (
    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
      <h3 className="text-xl font-bold mb-6 text-gray-900 flex items-center tracking-tight">
        <FileText className="w-5 h-5 mr-3 text-[#4285F4]" />
        Detailed Notes
      </h3>
      <div className="markdown-body prose max-w-none text-gray-700 font-normal leading-relaxed text-sm space-y-4">
        {data.detailed_notes ? (
          <Markdown>{data.detailed_notes}</Markdown>
        ) : (
          "No detailed notes generated."
        )}
      </div>
    </div>
  );

  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswers[currentQuestionIndex]) return; // Prevent changing answer
    setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: answer }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < (data.mcqs?.length || 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setIsQuizFinished(true);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setIsQuizFinished(false);
  };

  const renderMCQs = () => {
    if (!data.mcqs || data.mcqs.length === 0) {
      return <p className="text-gray-500 font-medium text-sm">No MCQs generated.</p>;
    }

    if (isQuizFinished) {
      const score = data.mcqs.reduce((acc, mcq, idx) => {
        return acc + (selectedAnswers[idx] === mcq.answer ? 1 : 0);
      }, 0);

      const wrongAnswers = data.mcqs.filter((mcq, idx) => selectedAnswers[idx] !== mcq.answer);

      const percentage = Math.round((score / data.mcqs.length) * 100);
      let feedbackMessage = "";
      let feedbackColor = "";
      if (percentage >= 90) {
        feedbackMessage = "Exceptional Mastery! You are highly prepared for this exam.";
        feedbackColor = "text-[#34A853]";
      } else if (percentage >= 75) {
        feedbackMessage = "Good Progress! Minor review of incorrect concepts is advised.";
        feedbackColor = "text-[#4285F4]";
      } else {
        feedbackMessage = "Revise Recommended. Focus on the core explanations shown below to bridge gaps.";
        feedbackColor = "text-[#EA4335]";
      }

      // Generate areas to improve based on incorrect answers' terms
      const suggestedTopicsSet = new Set<string>();
      wrongAnswers.forEach(item => {
        // Simple extraction of noun key phrases or contextual words from question
        const words = item.question
          .replace(/[?.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
          .split(/\s+/);
        const keywords = words.filter(w => w.length > 5 && !['question', 'following', 'correct', 'incorrect', 'statement', 'explain', 'which', 'there', 'their', 'would', 'about'].includes(w.toLowerCase()));
        
        if (keywords.length > 0) {
          // Take the two most descriptive words
          suggestedTopicsSet.add(keywords.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "));
        }
      });
      const suggestedTopics = Array.from(suggestedTopicsSet).slice(0, 4);

      return (
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center tracking-tight border-b border-gray-100 pb-4">
            <CheckCircle className="w-5 h-5 mr-3 text-[#34A853]" />
            Quiz Results
          </h3>
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] max-w-lg mx-auto">
            <div className="text-center">
              <Award className="w-12 h-12 text-[#FBBC05] mx-auto mb-4 animate-bounce" />
              <h4 className="text-lg font-semibold text-gray-500 mb-1">Your Score</h4>
              <p className="text-5xl font-extrabold text-gray-900 mb-2">
                {score} <span className="text-gray-300 text-3xl">/</span> {data.mcqs.length}
              </p>
              <div className="inline-block px-3.5 py-1 bg-gray-50 rounded-full border border-gray-100 text-xs font-mono font-bold mb-4">
                SCORE: {percentage}%
              </div>
              <p className={`text-sm font-semibold mb-6 ${feedbackColor}`}>{feedbackMessage}</p>
            </div>

            {/* Areas To Improve Box */}
            {wrongAnswers.length > 0 && (
              <div className="mt-6 p-5 border border-[#EA4335]/20 bg-[#EA4335]/5 rounded-2xl text-left">
                <h5 className="text-xs font-bold text-[#EA4335] uppercase tracking-wider mb-2.5 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-1.5" />
                  Target Areas to Improve
                </h5>
                <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                  Based on your missed questions, we recommend focusing revision efforts on these specific conceptual domains:
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedTopics.length > 0 ? (
                    suggestedTopics.map((topic, i) => (
                      <span key={i} className="px-3 py-1 bg-white border border-[#EA4335]/10 text-xs font-semibold text-gray-700 rounded-lg shadow-sm">
                        📚 {topic}
                      </span>
                    ))
                  ) : (
                    <span className="px-3 py-1 bg-white border border-gray-100 text-xs font-semibold text-gray-600 rounded-lg">
                      📖 Specific Question Explanations (Shown Below)
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {wrongAnswers.length > 0 && (
              <div className="text-left mt-8 border-t border-gray-100 pt-6">
                <h5 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Review incorrect answers</h5>
                <ul className="space-y-3.5">
                  {wrongAnswers.map((mcq, idx) => (
                    <li key={idx} className="bg-rose-50/30 p-4.5 rounded-xl border border-rose-100">
                      <p className="font-semibold text-gray-900 text-sm mb-2">{mcq.question}</p>
                      <p className="text-xs text-rose-700 font-semibold mb-2">Correct Answer: <span className="bg-white px-2 py-0.5 rounded border border-rose-100 font-mono text-[11px]">{mcq.answer}</span></p>
                      <p className="text-xs text-gray-500 font-normal leading-relaxed"><span className="font-semibold text-gray-700">Explanation:</span> {mcq.explanation}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-center mt-8 pt-4 border-t border-gray-100">
              <button 
                onClick={resetQuiz}
                className="px-6 py-2.5 bg-[#0a192f] hover:bg-[#122c4f] text-white font-semibold rounded-xl text-sm transition-all shadow-sm"
              >
                Retake Quiz
              </button>
            </div>
          </div>
        </div>
      );
    }

    const currentMcq = data.mcqs[currentQuestionIndex];
    const hasAnswered = !!selectedAnswers[currentQuestionIndex];
    const isCorrect = selectedAnswers[currentQuestionIndex] === currentMcq.answer;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
          <h3 className="text-xl font-bold text-gray-900 flex items-center tracking-tight">
            <CheckCircle className="w-5 h-5 mr-3 text-[#4285F4]" />
            Practice Assessment
          </h3>
          <span className="font-mono text-xs text-[#4285F4] bg-blue-50 px-3 py-1 rounded-full font-semibold">
            {currentQuestionIndex + 1} / {data.mcqs.length}
          </span>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <p className="font-semibold text-lg mb-6 text-gray-900 leading-snug">{currentMcq.question}</p>
          
          <div className="space-y-3 mb-6">
            {currentMcq.options?.map((opt, oIdx) => {
              let btnClass = "bg-[#fbfbfb] border-gray-100 text-gray-700 hover:border-[#4285F4] hover:bg-white";
              if (hasAnswered) {
                if (opt === currentMcq.answer) {
                  btnClass = "bg-green-50/40 border-green-300 text-green-900";
                } else if (opt === selectedAnswers[currentQuestionIndex]) {
                  btnClass = "bg-red-50/40 border-red-300 text-red-900";
                } else {
                  btnClass = "bg-gray-50/50 border-gray-100 text-gray-400 opacity-60";
                }
              } else if (selectedAnswers[currentQuestionIndex] === opt) {
                 btnClass = "bg-[#0a192f] border-[#0a192f] text-white";
              }

              return (
                <button 
                  key={oIdx} 
                  onClick={() => handleAnswerSelect(opt)}
                  disabled={hasAnswered}
                  className={`w-full text-left p-4 rounded-xl border font-medium transition-all text-sm flex items-center justify-between ${btnClass}`}
                >
                  <span>{opt}</span>
                  {hasAnswered && opt === currentMcq.answer && <span className="w-1.5 h-1.5 bg-[#34A853] rounded-full shrink-0 ml-2"></span>}
                </button>
              );
            })}
          </div>

          {hasAnswered && (
            <div className={`p-6 rounded-xl border animate-in fade-in slide-in-from-bottom-2 ${isCorrect ? 'bg-green-50/20 border-green-100 text-green-950' : 'bg-red-50/20 border-red-100 text-red-950'}`}>
              <div className="flex items-center mb-3">
                <h4 className={`text-sm font-semibold tracking-wide uppercase ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                  {isCorrect ? 'Correct Answer' : 'Incorrect'}
                </h4>
              </div>
              
              {!isCorrect && (
                <p className="text-xs text-red-900 font-medium mb-3">
                  The correct answer is: <span className="font-semibold bg-white px-2 py-0.5 rounded border border-red-100">{currentMcq.answer}</span>
                </p>
              )}

              <div className="bg-white/80 p-4 rounded-lg border border-gray-100 text-xs">
                <p className="font-semibold text-gray-700 mb-1 uppercase tracking-wider text-[10px]">Explanation</p>
                <p className="text-gray-600 leading-relaxed font-normal">{currentMcq.explanation}</p>
              </div>

              <button 
                onClick={handleNextQuestion}
                className={`mt-5 w-full py-2.5 rounded-lg font-semibold text-white text-sm transition-all shadow-sm ${isCorrect ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {currentQuestionIndex < data.mcqs.length - 1 ? 'Next Question' : 'View Results'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFormulas = () => (
    <div className="grid gap-6 md:grid-cols-2">
      {data.formulas?.map((formula, idx) => (
        <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <h4 className="font-semibold text-sm text-gray-900 mb-3 bg-yellow-50/50 inline-block px-2.5 py-0.5 rounded-md text-[#B28200]">{formula.name}</h4>
          <div className="p-4 bg-gray-900 rounded-xl mb-4 overflow-x-auto">
            <code className="text-yellow-400 font-mono text-sm font-medium">{formula.formula}</code>
          </div>
          <p className="text-gray-500 font-normal text-xs leading-relaxed">{formula.description}</p>
        </div>
      ))}
      {(!data.formulas || data.formulas.length === 0) && (
        <p className="text-gray-500 font-medium text-sm col-span-2">No formulas generated.</p>
      )}
    </div>
  );

  const renderDiagrams = () => (
    <div className="space-y-6">
      {data.diagrams?.map((diagram, idx) => (
        <div key={idx} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <h4 className="font-semibold text-base text-gray-900 mb-1.5">{diagram.title}</h4>
          <p className="text-gray-500 font-medium text-xs mb-5">{diagram.description}</p>
          {diagram.ascii_or_mermaid && (
            <div className="p-5 bg-gray-50/50 rounded-xl border border-gray-100 overflow-x-auto">
              <pre className="text-xs font-mono text-gray-700 font-medium whitespace-pre-wrap">{diagram.ascii_or_mermaid}</pre>
            </div>
          )}
        </div>
      ))}
      {(!data.diagrams || data.diagrams.length === 0) && (
        <p className="text-gray-500 font-medium text-sm">No diagrams generated.</p>
      )}
    </div>
  );

  const renderHotQuestions = () => (
    <div className="space-y-6">
      {data.hot_questions?.map((hq, idx) => (
        <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] relative overflow-hidden pl-8">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-[#EA4335]"></div>
          <h4 className="font-semibold text-base text-gray-900 mb-3 flex items-start">
            <HelpCircle className="w-5 h-5 mr-2.5 text-[#EA4335] shrink-0 mt-0.5" />
            {hq.question}
          </h4>
          <div className="markdown-body text-gray-600 font-normal text-xs leading-relaxed space-y-2">
            <Markdown>{hq.answer}</Markdown>
          </div>
        </div>
      ))}
      {(!data.hot_questions || data.hot_questions.length === 0) && (
        <p className="text-gray-500 font-medium text-sm">No hot questions generated.</p>
      )}
    </div>
  );

  const toggleQuestion = (id: string) => {
    setExpandedQuestions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderQuestionWithAnswer = (q: any, idx: number, prefix: string) => {
    const qId = `${prefix}-${idx}`;
    const isExpanded = expandedQuestions[qId];

    return (
      <div key={idx} className="mb-4 bg-white rounded-2xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.01)] overflow-hidden">
        <div 
          className="flex justify-between items-center p-5 cursor-pointer hover:bg-gray-50/40 transition-colors"
          onClick={() => toggleQuestion(qId)}
        >
          <div className="flex flex-1 items-center pr-4">
            <span className="font-mono text-sm text-[#4285F4] mr-3 font-semibold">{idx + 1}.</span>
            <p className="text-gray-800 text-sm font-semibold leading-snug">{q.question}</p>
          </div>
          <div className="flex items-center shrink-0">
            <span className="bg-[#0a192f]/5 text-[#0a192f] px-2.5 py-1 rounded-md text-xs font-semibold mr-3">
              {q.marks} Marks
            </span>
            <div className="text-gray-400">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>
        
        {isExpanded && (
          <div className="space-y-4 p-5 pt-0 pl-11 border-t border-gray-50 bg-gray-50/20">
            <div className="pt-4 space-y-4">
              {q.answer_guide?.definition_or_meaning && (
                <div>
                  <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Definition / Meaning</h5>
                  <p className="text-gray-600 text-xs font-normal leading-relaxed">{q.answer_guide.definition_or_meaning}</p>
                </div>
              )}

              {q.answer_guide?.formula_or_syntax && q.answer_guide.formula_or_syntax !== "N/A" && (
                <div>
                  <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Formula / Syntax</h5>
                  <div className="bg-gray-900 p-3 rounded-lg">
                    <code className="text-yellow-400 font-mono text-xs">{q.answer_guide.formula_or_syntax}</code>
                  </div>
                </div>
              )}

              {q.answer_guide?.example && q.answer_guide.example !== "N/A" && (
                <div>
                  <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Example</h5>
                  <div className="bg-white p-3 rounded-lg border border-gray-100">
                    <p className="text-gray-600 text-xs whitespace-pre-wrap">{q.answer_guide.example}</p>
                  </div>
                </div>
              )}

              {q.answer_guide?.mermaid_diagram && q.answer_guide.mermaid_diagram !== "N/A" && (
                <div>
                  <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Diagram Model</h5>
                  <div className="bg-white p-3 rounded-lg border border-gray-100 overflow-x-auto">
                    <pre className="text-gray-600 font-mono text-xs whitespace-pre-wrap">{q.answer_guide.mermaid_diagram}</pre>
                  </div>
                </div>
              )}

              {q.answer_guide?.pdf_reference && q.answer_guide.pdf_reference !== "N/A" && (
                <div>
                  <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Document Reference</h5>
                  <p className="text-gray-600 text-xs font-normal">{q.answer_guide.pdf_reference}</p>
                </div>
              )}

              {q.answer_guide?.external_links && q.answer_guide.external_links.length > 0 && q.answer_guide.external_links[0] !== "N/A" && (
                <div>
                  <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">External Resources</h5>
                  <ul className="list-disc list-inside text-xs text-blue-600 space-y-1">
                    {q.answer_guide.external_links.map((link: string, i: number) => (
                      <li key={i}><a href={link} target="_blank" rel="noopener noreferrer" className="hover:underline">{link}</a></li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {q.answer_guide?.advantages && q.answer_guide.advantages.length > 0 && q.answer_guide.advantages[0] !== "N/A" && (
                  <div className="p-3 bg-green-50/10 rounded-lg border border-green-50">
                    <h5 className="text-[10px] font-semibold text-green-700 uppercase tracking-wider mb-1">Advantages</h5>
                    <ul className="list-disc list-inside text-gray-600 text-xs space-y-1">
                      {q.answer_guide.advantages.map((adv: string, i: number) => (
                        <li key={i}>{adv}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {q.answer_guide?.limitations && q.answer_guide.limitations.length > 0 && q.answer_guide.limitations[0] !== "N/A" && (
                  <div className="p-3 bg-red-50/10 rounded-lg border border-red-50">
                    <h5 className="text-[10px] font-semibold text-red-700 uppercase tracking-wider mb-1">Limitations</h5>
                    <ul className="list-disc list-inside text-gray-600 text-xs space-y-1">
                      {q.answer_guide.limitations.map((lim: string, i: number) => (
                        <li key={i}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {q.answer_guide?.detailed_explanation && (
                <div>
                  <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Concept Explanation</h5>
                  <div className="markdown-body text-gray-600 text-xs leading-relaxed space-y-2">
                    <Markdown>{q.answer_guide.detailed_explanation}</Markdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderQuestionPaper = () => {
    const qp = data.question_paper;
    if (!qp) return <p className="text-gray-500 font-medium text-sm">No question paper generated.</p>;

    return (
      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] max-w-4xl mx-auto">
        <div className="text-center mb-8 border-b border-gray-100 pb-6">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Practice Examination Sheet</h2>
          <p className="text-gray-400 font-medium mt-1 text-xs uppercase tracking-wider">Smart Study Synthesizer</p>
        </div>

        {qp.mid_term?.questions && qp.mid_term.questions.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Section A: Mid Term Format</h3>
            <div className="space-y-3">
              {qp.mid_term.questions.map((q: any, idx: number) => renderQuestionWithAnswer(q, idx, 'mid'))}
            </div>
          </div>
        )}

        {qp.end_term && (qp.end_term.twelve_mark?.length > 0 || qp.end_term.eight_mark?.length > 0) && (
          <div className="space-y-6">
            {qp.end_term.twelve_mark?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Section B: 12 Mark Formats</h3>
                <div className="space-y-3">
                  {qp.end_term.twelve_mark.map((q: any, idx: number) => renderQuestionWithAnswer(q, idx, 'end-12'))}
                </div>
              </div>
            )}

            {qp.end_term.eight_mark?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Section C: 8 Mark Formats</h3>
                <div className="space-y-3">
                  {qp.end_term.eight_mark.map((q: any, idx: number) => renderQuestionWithAnswer(q, idx, 'end-8'))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Overview': return renderOverview();
      case 'Detailed Notes': return renderDetailedNotes();
      case 'MCQs': return renderMCQs();
      case 'Formulas': return renderFormulas();
      case 'Diagrams': return renderDiagrams();
      case 'Hot Questions': return renderHotQuestions();
      case 'Question Paper': return renderQuestionPaper();
      default: return <div className="text-gray-400">Select a tab to view content.</div>;
    }
  };

  const handleLocalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'materials' | 'syllabus' | 'papers') => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const filePromises = Array.from(selectedFiles).map(async (file) => {
      return new Promise<FileInput>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve({
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            data: base64String
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    try {
      const processedFiles = await Promise.all(filePromises);
      if (type === 'materials') {
        setNewMaterials(prev => [...prev, ...processedFiles]);
      } else if (type === 'syllabus') {
        setNewSyllabus(prev => [...prev, ...processedFiles]);
      } else {
        setNewPapers(prev => [...prev, ...processedFiles]);
      }
    } catch (err) {
      setUploadError("Failed to read files. Please try again.");
    }
  };

  const handleMergeSubmit = async () => {
    if (newMaterials.length === 0 && newSyllabus.length === 0 && newPapers.length === 0) {
      setUploadError("Please select at least one file to upload.");
      return;
    }
    setUploadError(null);
    setIsMerging(true);
    try {
      await onUploadMore(newMaterials, newSyllabus, newPapers);
      setNewMaterials([]);
      setNewSyllabus([]);
      setNewPapers([]);
      setIsUploadModalOpen(false);
    } catch (err: any) {
      setUploadError(err.message || "Failed to merge and regenerate study materials.");
    } finally {
      setIsMerging(false);
    }
  };

  const getTabColor = (tabName: string) => {
    switch (tabName) {
      case 'Detailed Notes': return '#4285F4'; // Blue
      case 'MCQs': return '#EA4335'; // Red
      case 'Formulas': return '#FBBC05'; // Yellow
      case 'Diagrams': return '#34A853'; // Green
      case 'Question Paper': return '#4285F4'; // Blue
      case 'Hot Questions': return '#EA4335'; // Red
      default: return '#34A853'; // Green (Overview)
    }
  };

  return (
    <div className="flex h-screen bg-transparent overflow-hidden p-4 md:p-8">
      {/* Sidebar */}
      <div className="w-64 border border-gray-100 flex flex-col bg-white shrink-0 shadow-[0_10px_40px_rgba(0,0,0,0.02)] rounded-3xl overflow-hidden mr-6 md:mr-8">
        <div className="p-6 border-b border-gray-100 bg-[#fdf7f4]/40">
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Academic Lab</h1>
          <p className="text-[10px] font-semibold text-[#34A853] mt-1.5 flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34A853] mr-1.5 animate-pulse"></span>
            Materials Synced
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto py-5 px-3.5 space-y-1">
          {tabs.map(tab => {
            const isSelected = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full text-left px-4 py-3 text-xs font-semibold rounded-xl transition-all duration-200 border ${
                  isSelected 
                    ? 'bg-gray-50 text-gray-900 border-gray-200/60 shadow-sm' 
                    : 'border-transparent text-gray-500 hover:bg-gray-50/50 hover:text-gray-800'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getTabColor(tab) }}></span>
                  <span>{tab}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Ingested Documents List */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 max-h-48 overflow-y-auto">
          <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center">
            <Paperclip className="w-2.5 h-2.5 mr-1" />
            Ingested Files ({(subject.files || []).length + (subject.syllabusFiles || []).length + (subject.previousPapers || []).length})
          </h4>
          <div className="space-y-1 text-[10px] text-gray-500 font-medium">
            {(subject.syllabusFiles || []).map((f, i) => (
              <div key={`s-${i}`} className="flex items-center text-[#4285F4] truncate" title={f.name}>
                <FileText className="w-2.5 h-2.5 mr-1 shrink-0" />
                <span className="truncate">{f.name} (Syllabus)</span>
              </div>
            ))}
            {(subject.files || []).map((f, i) => (
              <div key={`m-${i}`} className="flex items-center text-gray-700 truncate" title={f.name}>
                <FileText className="w-2.5 h-2.5 mr-1 shrink-0" />
                <span className="truncate">{f.name}</span>
              </div>
            ))}
            {(subject.previousPapers || []).map((f, i) => (
              <div key={`p-${i}`} className="flex items-center text-[#EA4335] truncate" title={f.name}>
                <FileQuestion className="w-2.5 h-2.5 mr-1 shrink-0" />
                <span className="truncate">{f.name} (Paper)</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 border-t border-gray-100">
          <button 
            onClick={onReset} 
            className="w-full flex items-center justify-center px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Classroom Menu
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-white border border-gray-100 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.02)]">
        <div className="absolute inset-0 opacity-[0.01] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0a192f 2px, transparent 2px)', backgroundSize: '24px 24px' }}></div>
        <div className="max-w-4xl mx-auto px-6 py-10 md:px-10 md:py-12 relative z-10">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-5 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{activeTab}</h2>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Viewing <span className="font-semibold text-gray-700">{subject.name}</span> ({subject.examType})
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center px-4 py-2 bg-[#4285F4] hover:bg-[#357ae8] text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Upload More Files
              </button>
            </div>
          </div>
          {renderContent()}
        </div>
      </div>

      {/* Upload More Files Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-gray-100 max-w-md w-full p-6 shadow-[0_20px_50px_rgba(0,0,0,0.15)] relative">
            <button 
              onClick={() => {
                setIsUploadModalOpen(false);
                setUploadError(null);
                setNewMaterials([]);
                setNewSyllabus([]);
                setNewPapers([]);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-gray-900 tracking-tight flex items-center mb-1">
              <Upload className="w-5 h-5 mr-2 text-[#4285F4]" />
              Upload More Files
            </h3>
            <p className="text-[11px] text-gray-500 font-medium mb-5">
              Add new documents to merge with <span className="font-semibold text-gray-700">{subject.name}</span>.
            </p>

            {uploadError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 font-medium rounded-xl text-xs">
                {uploadError}
              </div>
            )}

            <div className="space-y-3 mb-6">
              {/* Materials */}
              <div className="p-3 border border-gray-100 rounded-xl bg-gray-50/50">
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">New Study Materials</label>
                <input 
                  type="file" 
                  multiple 
                  onChange={(e) => handleLocalFileUpload(e, 'materials')} 
                  className="w-full text-xs text-gray-600 font-medium file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-[#0a192f] file:text-white hover:file:bg-[#122c4f] cursor-pointer text-[10px]" 
                />
                {newMaterials.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {newMaterials.map((f, i) => (
                      <p key={i} className="text-[10px] text-[#34A853] font-semibold flex items-center truncate">
                        <CheckCircle className="w-3 h-3 mr-1 shrink-0" /> {f.name}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Syllabus */}
              <div className="p-3 border border-gray-100 rounded-xl bg-gray-50/50">
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">New Syllabus (Optional)</label>
                <input 
                  type="file" 
                  multiple 
                  onChange={(e) => handleLocalFileUpload(e, 'syllabus')} 
                  className="w-full text-xs text-gray-600 font-medium file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-[#4285F4]/10 file:text-[#4285F4] hover:file:bg-[#4285F4]/20 cursor-pointer text-[10px]" 
                />
                {newSyllabus.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {newSyllabus.map((f, i) => (
                      <p key={i} className="text-[10px] text-[#4285F4] font-semibold flex items-center truncate">
                        <CheckCircle className="w-3 h-3 mr-1 shrink-0" /> {f.name}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Papers */}
              <div className="p-3 border border-gray-100 rounded-xl bg-gray-50/50">
                <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">New Question Papers (Optional)</label>
                <input 
                  type="file" 
                  multiple 
                  onChange={(e) => handleLocalFileUpload(e, 'papers')} 
                  className="w-full text-xs text-gray-600 font-medium file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-[#EA4335]/10 file:text-[#EA4335] hover:file:bg-[#EA4335]/20 cursor-pointer text-[10px]" 
                />
                {newPapers.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {newPapers.map((f, i) => (
                      <p key={i} className="text-[10px] text-[#EA4335] font-semibold flex items-center truncate">
                        <CheckCircle className="w-3 h-3 mr-1 shrink-0" /> {f.name}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex space-x-2">
              <button 
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadError(null);
                  setNewMaterials([]);
                  setNewSyllabus([]);
                  setNewPapers([]);
                }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 font-semibold rounded-xl text-xs transition-all"
                disabled={isMerging}
              >
                Cancel
              </button>
              <button 
                onClick={handleMergeSubmit}
                className="flex-1 py-2.5 bg-[#4285F4] hover:bg-[#357ae8] text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center space-x-1 shadow-sm"
                disabled={isMerging}
              >
                {isMerging ? (
                  <>
                    <Cpu className="w-3.5 h-3.5 animate-spin" />
                    <span>Merging...</span>
                  </>
                ) : (
                  <>
                    <span>Merge & Re-Generate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
